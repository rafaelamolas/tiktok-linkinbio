// Store compartilhado do CRM Aplicações VIP.
//
// Layout v2 (B0 — 2026-09-10): registro-por-chave + índice ZSET.
// Substitui o layout v1 (lista inteira em uma STRING) que tinha race condition:
// duas escritas concorrentes liam a lista inteira, modificavam local, e a última
// a escrever sobrescrevia os writes da outra (perda silenciosa de dado).
//
// Layout novo:
//   crm-vip:app:{id}     → STRING JSON com o registro individual
//   crm-vip:index        → ZSET (score=epochRecebidoEm, member=id) pra ordenação
//   crm-vip:aplicacoes   → LEGACY (v1) — preservado, só lido pra migração inicial
//   crm-vip:migrated-v2  → flag idempotente da migração
//
// Migração é transparente e idempotente: roda no máximo 1 vez por vida do Redis,
// não deleta o legacy (rollback fácil), roda em pipeline (1 round-trip).
//
// Redis via ioredis + fallback in-memory (padrão herdado do Viajômetro).
// Sem REDIS_URL, dados não persistem entre invocações serverless — só serve
// pra teste local/preview. Em produção, REDIS_URL deve apontar pra Upstash.

import Redis from "ioredis";

// ---------- Chaves ----------
const KEY_RECORD = (id) => `crm-vip:app:${id}`;
const KEY_INDEX = "crm-vip:index";
const KEY_LEGACY = "crm-vip:aplicacoes";
const KEY_MIGRATED = "crm-vip:migrated-v2";

const MAX_APLICACOES = 5000;
const REDIS_TIMEOUT_MS = 4000;

// ---------- Cliente Redis ----------
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false
    })
  : null;

// ---------- Fallback in-memory ----------
// records: { [id]: record }
// index:   [{ id, score }]  (score = epoch de recebidoEm)
// migrated: true depois da 1ª tentativa de migração no processo (fallback só)
const MEM = globalThis.__crmVipMem || (globalThis.__crmVipMem = {
  records: {},
  index: [],
  migrated: false
});
let warnedFallback = false;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("redis_timeout")), ms))
  ]);
}

function warnOnce(reason) {
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn("[crm-vip] Redis indisponível, usando fallback em memória:", reason);
  }
}

function toScore(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

// Mantém MEM dentro do cap. Remove os mais antigos por score ascendente.
function trimMem() {
  if (MEM.index.length <= MAX_APLICACOES) return;
  MEM.index.sort((a, b) => a.score - b.score); // mais antigo primeiro
  const excedente = MEM.index.length - MAX_APLICACOES;
  for (let i = 0; i < excedente; i++) {
    const { id } = MEM.index[i];
    delete MEM.records[id];
  }
  MEM.index = MEM.index.slice(excedente);
}

// ---------- Migração transparente (v1 → v2) ----------
// Chamada na 1ª operação. Idempotente via flag.
async function ensureMigrated() {
  if (!redis) {
    // fallback in-memory: nada pra migrar (sem dado persistente)
    if (MEM.migrated) return;
    MEM.migrated = true;
    return;
  }
  try {
    const already = await withTimeout(redis.get(KEY_MIGRATED), REDIS_TIMEOUT_MS);
    if (already) return;

    const raw = await withTimeout(redis.get(KEY_LEGACY), REDIS_TIMEOUT_MS);
    if (raw) {
      let list = [];
      try { list = JSON.parse(raw); } catch {}
      if (Array.isArray(list) && list.length) {
        const pipe = redis.pipeline();
        let migrados = 0;
        for (const rec of list) {
          if (!rec || !rec.id) continue;
          pipe.set(KEY_RECORD(rec.id), JSON.stringify(rec));
          pipe.zadd(KEY_INDEX, toScore(rec.recebidoEm), rec.id);
          migrados++;
        }
        await withTimeout(pipe.exec(), REDIS_TIMEOUT_MS * 2);
        console.warn(
          `[crm-vip] Migração v1→v2 executada: ${migrados} registros movidos. ` +
          `Legacy preservado em ${KEY_LEGACY} pra rollback.`
        );
      }
    }
    await withTimeout(redis.set(KEY_MIGRATED, "1"), REDIS_TIMEOUT_MS);
  } catch (e) {
    warnOnce("migração falhou: " + (e.message || e));
  }
}

// ---------- Helpers de leitura do fallback ----------
function memGetAll() {
  return [...MEM.index]
    .sort((a, b) => b.score - a.score)
    .map(({ id }) => MEM.records[id])
    .filter(Boolean);
}

function memUpsert(record) {
  const score = toScore(record.recebidoEm);
  MEM.records[record.id] = record;
  MEM.index = MEM.index.filter((x) => x.id !== record.id).concat({ id: record.id, score });
  trimMem();
}

// ---------- API PÚBLICA ----------

export async function getAplicacoes() {
  await ensureMigrated();
  if (!redis) {
    warnOnce("REDIS_URL ausente");
    return memGetAll();
  }
  try {
    const ids = await withTimeout(
      redis.zrevrange(KEY_INDEX, 0, MAX_APLICACOES - 1),
      REDIS_TIMEOUT_MS
    );
    if (!ids || ids.length === 0) return [];
    const keys = ids.map((id) => KEY_RECORD(id));
    const raws = await withTimeout(redis.mget(...keys), REDIS_TIMEOUT_MS);
    return raws
      .map((raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } })
      .filter(Boolean);
  } catch (e) {
    warnOnce(e.message || e);
    return memGetAll();
  }
}

export async function addAplicacao(record) {
  if (!record || !record.id) throw new Error("record inválido: precisa de id");
  await ensureMigrated();
  // fallback recebe sempre (garantia mínima durante a request)
  memUpsert(record);
  if (!redis) return record;
  try {
    const pipe = redis.pipeline();
    pipe.set(KEY_RECORD(record.id), JSON.stringify(record));
    pipe.zadd(KEY_INDEX, toScore(record.recebidoEm), record.id);
    await withTimeout(pipe.exec(), REDIS_TIMEOUT_MS);
  } catch (e) {
    warnOnce(e.message || e);
  }
  return record;
}

export async function updateAplicacao(id, patch) {
  if (!id) return null;
  await ensureMigrated();

  // 1) carrega estado atual (prioriza Redis pra evitar sobrescrita cega)
  let current = null;
  if (redis) {
    try {
      const raw = await withTimeout(redis.get(KEY_RECORD(id)), REDIS_TIMEOUT_MS);
      if (raw) { try { current = JSON.parse(raw); } catch {} }
    } catch (e) {
      warnOnce(e.message || e);
    }
  }
  if (!current && MEM.records[id]) current = MEM.records[id];
  if (!current) return null;

  // 2) merge
  const updated = { ...current, ...patch, atualizadoEm: new Date().toISOString() };

  // 3) escreve
  memUpsert(updated);
  if (!redis) return updated;
  try {
    const pipe = redis.pipeline();
    pipe.set(KEY_RECORD(id), JSON.stringify(updated));
    pipe.zadd(KEY_INDEX, toScore(updated.recebidoEm), id);
    await withTimeout(pipe.exec(), REDIS_TIMEOUT_MS);
  } catch (e) {
    warnOnce(e.message || e);
  }
  return updated;
}

export function usingFallback() {
  return !redis || !process.env.REDIS_URL;
}

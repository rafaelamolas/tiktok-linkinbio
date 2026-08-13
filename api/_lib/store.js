// Store compartilhado do CRM Aplicações VIP.
// Redis via ioredis + fallback in-memory (padrão herdado do Viajômetro).
// Sem REDIS_URL, dados não persistem entre invocações serverless — só serve
// pra teste local/preview. Em produção, ligar Upstash no projeto (Marketplace).

import Redis from "ioredis";

const APLICACOES_KEY = "crm-vip:aplicacoes";
const MAX_APLICACOES = 5000;

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false
    })
  : null;

const MEM = globalThis.__crmVipMem || (globalThis.__crmVipMem = { aplicacoes: [] });
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

async function readList() {
  if (!redis) { warnOnce("REDIS_URL ausente"); return MEM.aplicacoes.slice(); }
  try {
    const raw = await withTimeout(redis.get(APLICACOES_KEY), 4000);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    warnOnce(e.message || e);
    return MEM.aplicacoes.slice();
  }
}

async function writeList(list) {
  const trimmed = list.slice(-MAX_APLICACOES);
  MEM.aplicacoes = trimmed;
  if (!redis) return;
  try {
    await withTimeout(redis.set(APLICACOES_KEY, JSON.stringify(trimmed)), 4000);
  } catch (e) {
    warnOnce(e.message || e);
  }
}

export async function getAplicacoes() {
  return await readList();
}

export async function addAplicacao(record) {
  const list = await readList();
  list.push(record);
  await writeList(list);
  return record;
}

export async function updateAplicacao(id, patch) {
  const list = await readList();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...patch, atualizadoEm: new Date().toISOString() };
  list[idx] = updated;
  await writeList(list);
  return updated;
}

export function usingFallback() {
  return !redis || !process.env.REDIS_URL;
}

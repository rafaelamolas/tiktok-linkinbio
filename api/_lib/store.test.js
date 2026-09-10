// Testes locais do store.js (B0 — 2026-09-10).
// Roda em fallback in-memory (sem REDIS_URL). Foco: validar API pública +
// ordenação + upsert + updateAplicacao.
//
// Uso: node --test api/_lib/store.test.js

import { test } from "node:test";
import assert from "node:assert/strict";

// Garante que NÃO tem REDIS_URL — força fallback in-memory
delete process.env.REDIS_URL;

// Reset do MEM global entre suites (importante porque store.js usa globalThis)
function resetMem() {
  if (globalThis.__crmVipMem) {
    globalThis.__crmVipMem.records = {};
    globalThis.__crmVipMem.index = [];
    globalThis.__crmVipMem.migrated = false;
  }
}

const { getAplicacoes, addAplicacao, updateAplicacao, usingFallback } =
  await import("./store.js");

test("usingFallback retorna true sem REDIS_URL", () => {
  resetMem();
  assert.equal(usingFallback(), true);
});

test("getAplicacoes retorna [] quando vazio", async () => {
  resetMem();
  const lista = await getAplicacoes();
  assert.deepEqual(lista, []);
});

test("addAplicacao persiste e getAplicacoes retorna", async () => {
  resetMem();
  const rec = {
    id: "abc123",
    recebidoEm: "2026-09-10T12:00:00.000Z",
    classe: "QUENTE",
    q1: "Fulana Teste",
    status: "aberto"
  };
  const returned = await addAplicacao(rec);
  assert.equal(returned.id, "abc123");
  const lista = await getAplicacoes();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].q1, "Fulana Teste");
});

test("addAplicacao múltiplo — ordena por recebidoEm desc", async () => {
  resetMem();
  await addAplicacao({ id: "a", recebidoEm: "2026-09-01T10:00:00.000Z", q1: "Antigo" });
  await addAplicacao({ id: "b", recebidoEm: "2026-09-10T10:00:00.000Z", q1: "Novo" });
  await addAplicacao({ id: "c", recebidoEm: "2026-09-05T10:00:00.000Z", q1: "Meio" });
  const lista = await getAplicacoes();
  assert.equal(lista.length, 3);
  assert.equal(lista[0].q1, "Novo");   // mais recente primeiro
  assert.equal(lista[1].q1, "Meio");
  assert.equal(lista[2].q1, "Antigo");
});

test("addAplicacao com mesmo id sobrescreve (upsert)", async () => {
  resetMem();
  await addAplicacao({ id: "x", recebidoEm: "2026-09-10T10:00:00.000Z", q1: "V1" });
  await addAplicacao({ id: "x", recebidoEm: "2026-09-10T10:00:00.000Z", q1: "V2" });
  const lista = await getAplicacoes();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].q1, "V2");
});

test("updateAplicacao — merge com patch + atualizadoEm novo", async () => {
  resetMem();
  await addAplicacao({
    id: "z",
    recebidoEm: "2026-09-10T10:00:00.000Z",
    classe: "MEDIO",
    status: "aberto",
    notas: ""
  });
  const antes = Date.now();
  const updated = await updateAplicacao("z", { status: "em_andamento", notas: "liguei ontem" });
  assert.equal(updated.id, "z");
  assert.equal(updated.status, "em_andamento");
  assert.equal(updated.notas, "liguei ontem");
  assert.equal(updated.classe, "MEDIO"); // preservado
  assert.ok(new Date(updated.atualizadoEm).getTime() >= antes);
});

test("updateAplicacao — id inexistente retorna null", async () => {
  resetMem();
  const r = await updateAplicacao("nao-existe", { status: "fechado" });
  assert.equal(r, null);
});

test("addAplicacao sem id lança erro", async () => {
  resetMem();
  await assert.rejects(async () => await addAplicacao({ recebidoEm: "2026-09-10T10:00:00.000Z" }));
  await assert.rejects(async () => await addAplicacao(null));
});

test("updateAplicacao sem id retorna null", async () => {
  resetMem();
  const r = await updateAplicacao(null, { status: "fechado" });
  assert.equal(r, null);
});

test("getAplicacoes reflete update no lugar certo da ordem", async () => {
  resetMem();
  await addAplicacao({ id: "a", recebidoEm: "2026-09-01T10:00:00.000Z", q1: "A" });
  await addAplicacao({ id: "b", recebidoEm: "2026-09-05T10:00:00.000Z", q1: "B" });
  await updateAplicacao("a", { status: "fechado" });
  const lista = await getAplicacoes();
  // "b" continua sendo mais recente que "a" (updates NÃO alteram recebidoEm)
  assert.equal(lista[0].id, "b");
  assert.equal(lista[1].id, "a");
  assert.equal(lista[1].status, "fechado");
});

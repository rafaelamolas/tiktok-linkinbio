// Vercel Serverless Function — leitura e atualização das aplicações do CRM VIP.
// Autenticação por senha simples via env var CRM_VIP_PASSWORD.
//
// GET  /api/aplicacoes?password=XXX             → lista todas as aplicações
// POST /api/aplicacoes?password=XXX&id=YYY      → atualiza status e/ou notas
//
// Body do POST (JSON): { status?: string, notas?: string }
// status ∈ { 'aberto', 'em_andamento', 'fechado', 'perdido' }

import { getAplicacoes, updateAplicacao, usingFallback } from './_lib/store.js';

// senha default de emergência — SEMPRE configurar CRM_VIP_PASSWORD nas env vars
const FALLBACK_PASSWORD = 'sofia-crm-vip-troque-esta-senha';
const VALID_STATUS = new Set(['aberto', 'em_andamento', 'fechado', 'perdido']);

function authOK(req) {
  const configured = process.env.CRM_VIP_PASSWORD || FALLBACK_PASSWORD;
  const sent = String(req.query?.password || req.headers?.['x-crm-password'] || '');
  if (!sent || sent.length !== configured.length) return false;
  // comparação constant-time trivial
  let diff = 0;
  for (let i = 0; i < configured.length; i++) diff |= sent.charCodeAt(i) ^ configured.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  if (!authOK(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (usingFallback()) {
    res.setHeader('X-CRM-Storage', 'memory-fallback');
  }

  if (req.method === 'GET') {
    const lista = await getAplicacoes();
    lista.sort((a, b) => (b.recebidoEm || '').localeCompare(a.recebidoEm || ''));
    return res.status(200).json({ ok: true, total: lista.length, aplicacoes: lista });
  }

  if (req.method === 'POST') {
    const id = String(req.query?.id || '');
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const patch = {};
    if (body.status !== undefined) {
      if (!VALID_STATUS.has(String(body.status))) {
        return res.status(400).json({ ok: false, error: 'invalid_status' });
      }
      patch.status = String(body.status);
    }
    if (body.notas !== undefined) {
      patch.notas = String(body.notas).slice(0, 5000);
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ ok: false, error: 'nothing_to_update' });
    }

    const updated = await updateAplicacao(id, patch);
    if (!updated) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.status(200).json({ ok: true, aplicacao: updated });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}

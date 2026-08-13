// Vercel Serverless Function — recebe a aplicação da Consultoria VIP,
// classifica o lead, persiste no CRM e notifica a Rafaela no Telegram.

import { addAplicacao } from './_lib/store.js';

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function classificar(respostas) {
  // Regra Rafaela 2026-08-13: classificação depende SÓ do gasto (q3).
  // q10 (pronta pra investir) não qualifica mais a persona.
  const gasto = respostas.q3;
  if (gasto === 'Acima de R$30 mil') return 'QUENTE';
  if (gasto === 'Até R$10 mil') return 'FRIO';
  return 'MEDIO';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  let respostas = req.body;
  if (typeof respostas === 'string') {
    try {
      respostas = JSON.parse(respostas);
    } catch (e) {
      res.status(400).json({ ok: false, error: 'invalid_json' });
      return;
    }
  }
  if (!respostas || typeof respostas !== 'object') {
    res.status(400).json({ ok: false, error: 'invalid_body' });
    return;
  }

  // validação mínima dos campos obrigatórios
  const obrigatorios = ['q1', 'q2', 'q13', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q12'];
  const faltando = obrigatorios.filter((k) => !respostas[k] || !String(respostas[k]).trim());
  if (faltando.length) {
    res.status(400).json({ ok: false, error: 'missing_fields', fields: faltando });
    return;
  }

  const classe = classificar(respostas);

  // persiste no CRM (silenciosamente — nunca bloqueia a resposta pro cliente)
  const registro = {
    id: randomId(),
    recebidoEm: new Date().toISOString(),
    classe,
    q1: String(respostas.q1 || ''),
    q2: String(respostas.q2 || ''),
    q13: String(respostas.q13 || ''),
    q3: String(respostas.q3 || ''),
    q4: String(respostas.q4 || ''),
    q5: String(respostas.q5 || ''),
    q6: String(respostas.q6 || ''),
    q7: String(respostas.q7 || ''),
    q8: String(respostas.q8 || ''),
    q9: String(respostas.q9 || ''),
    q10: String(respostas.q10 || ''),
    q11: String(respostas.q11 || ''),
    q12: String(respostas.q12 || ''),
    status: 'aberto',
    notas: '',
    atualizadoEm: new Date().toISOString()
  };
  try {
    await addAplicacao(registro);
  } catch (err) {
    console.error('Falha ao persistir aplicação no CRM:', err);
  }

  const emoji = { QUENTE: '🟢', MEDIO: '🟡', FRIO: '🔴' }[classe] || '⚪';

  const texto =
    `${emoji} <b>NOVA APLICAÇÃO VIP — ${classe}</b>\n\n` +
    `👤 ${escapeHtml(respostas.q1)}\n` +
    `📱 ${escapeHtml(respostas.q2)}\n` +
    `📸 ${escapeHtml(respostas.q13)}\n\n` +
    `💳 Gasto/mês: ${escapeHtml(respostas.q3)}\n` +
    `🎯 Usa milhas: ${escapeHtml(respostas.q4)}\n` +
    `✈️ Objetivo: ${escapeHtml(respostas.q5)}\n` +
    `🏦 Banco: ${escapeHtml(respostas.q6)}\n` +
    `👑 Já voou executiva: ${escapeHtml(respostas.q7)}\n` +
    `⏰ Tempo/semana: ${escapeHtml(respostas.q8)}\n\n` +
    `💭 Por que particular > curso:\n${escapeHtml(respostas.q9)}\n\n` +
    `💰 Pronta pra R$4.000: ${escapeHtml(respostas.q10)}\n\n` +
    (respostas.q11 && String(respostas.q11).trim()
      ? `📝 Extra:\n${escapeHtml(respostas.q11)}\n\n`
      : '') +
    `📍 Veio de: ${escapeHtml(respostas.q12)}`;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  let telegramOk = false;
  if (token && chatId) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: 'HTML'
        })
      });
      telegramOk = resp.ok;
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error('Falha ao enviar Telegram:', resp.status, body);
      }
    } catch (err) {
      console.error('Erro ao notificar Telegram:', err);
    }
  } else {
    console.error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausentes nas env vars.');
  }

  res.status(200).json({ ok: true, classe, telegramOk });
}

// Vercel Serverless Function — recebe a aplicação da Consultoria VIP,
// classifica o lead e notifica a Rafaela no Telegram.

function classificar(respostas) {
  const gasto = respostas.q3;
  const pronta = respostas.q10;

  if (
    (gasto === 'De R$20 a R$30 mil' || gasto === 'Acima de R$30 mil') &&
    pronta === 'Sim, já sei que é retorno garantido'
  ) {
    return 'QUENTE';
  }
  if (gasto === 'Até R$10 mil' || pronta === 'Ainda não tenho certeza') {
    return 'FRIO';
  }
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
  const obrigatorios = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q12'];
  const faltando = obrigatorios.filter((k) => !respostas[k] || !String(respostas[k]).trim());
  if (faltando.length) {
    res.status(400).json({ ok: false, error: 'missing_fields', fields: faltando });
    return;
  }

  const classe = classificar(respostas);

  const emoji = { QUENTE: '🟢', MEDIO: '🟡', FRIO: '🔴' }[classe] || '⚪';

  const texto =
    `${emoji} <b>NOVA APLICAÇÃO VIP — ${classe}</b>\n\n` +
    `👤 ${escapeHtml(respostas.q1)}\n` +
    `📱 ${escapeHtml(respostas.q2)}\n\n` +
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

  const debug = {
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
    tokenLen: token ? token.length : 0,
    chatIdVal: chatId || null,
    telegramStatus: null,
    telegramBody: null
  };

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
      debug.telegramStatus = resp.status;
      const body = await resp.text().catch(() => '');
      debug.telegramBody = body.slice(0, 200);
      telegramOk = resp.ok;
    } catch (err) {
      debug.telegramBody = `EXCEPTION: ${String(err).slice(0, 200)}`;
    }
  }

  res.status(200).json({ ok: true, classe, telegramOk, debug });
}

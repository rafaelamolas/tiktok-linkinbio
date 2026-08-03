/* ==========================================================================
   Aplicação VIP — formulário estilo Typeform (uma pergunta por vez)
   ========================================================================== */

(function () {
  'use strict';

  var DESAFIO_URL = 'https://milhassemsegredo.com/m7d-rafa-tiktok';
  var OTHER_LABEL = 'Outro';

  var QUESTIONS = [
    {
      id: 'q1',
      type: 'text',
      label: 'Qual seu nome completo?',
      placeholder: 'Nome completo',
      required: true
    },
    {
      id: 'q2',
      type: 'text',
      label: 'Qual seu WhatsApp?',
      hint: 'Com DDI se você estiver fora do Brasil.',
      placeholder: '(11) 91234-5678',
      required: true,
      validate: function (v) {
        var digits = v.replace(/\D/g, '');
        return digits.length >= 8;
      },
      errorText: 'Digite um WhatsApp válido, com DDD (ou DDI se for do exterior).'
    },
    {
      id: 'q3',
      type: 'radio',
      label: 'Quanto você gasta em média por mês no cartão de crédito?',
      required: true,
      options: ['Até R$10 mil', 'De R$10 a R$20 mil', 'De R$20 a R$30 mil', 'Acima de R$30 mil']
    },
    {
      id: 'q4',
      type: 'radio',
      label: 'Você usa milhas hoje?',
      required: true,
      options: [
        'Nunca usei',
        'Uso pouco, sem estratégia',
        'Uso mas sinto que poderia MUITO mais',
        'Uso bem, quero elevar pro nível avançado'
      ]
    },
    {
      id: 'q5',
      type: 'radio-other',
      label: 'Qual seu principal objetivo com milhas?',
      required: true,
      options: ['Viajar mais barato', 'Viajar em executiva/primeira', 'Levar minha família em viagens grandes'],
      otherPlaceholder: 'Conte qual é o seu objetivo'
    },
    {
      id: 'q6',
      type: 'radio',
      label: 'Qual é o principal banco que você trabalha hoje?',
      required: true,
      options: [
        'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa',
        'C6 Bank', 'Inter', 'BTG Pactual', 'XP', 'Nubank', 'Outro'
      ]
    },
    {
      id: 'q7',
      type: 'radio',
      label: 'Você já voou de executiva usando pontos?',
      required: true,
      options: ['Não, é um sonho', 'Sim, uma vez', 'Sim, algumas vezes', 'Sim, faz parte da rotina']
    },
    {
      id: 'q8',
      type: 'radio',
      label: 'Quanto tempo por semana você conseguiria dedicar a estudar/gerir milhas sozinha?',
      required: true,
      options: ['Nenhum — quero terceirizar', 'Até 1 hora', '2 a 5 horas', 'Mais de 5 horas']
    },
    {
      id: 'q9',
      type: 'textarea',
      label: 'Por que você escolheria Consultoria Particular ao invés do Curso Online?',
      placeholder: 'Conte com suas palavras...',
      required: true,
      minLength: 20,
      errorText: 'Conta um pouquinho mais (mínimo 20 caracteres).'
    },
    {
      id: 'q10',
      type: 'radio',
      label: 'Está pronta pra investir R$4.000 na Consultoria VIP?',
      required: true,
      options: ['Sim, já sei que é retorno garantido', 'Sim, se fizer sentido pra mim', 'Ainda não tenho certeza']
    },
    {
      id: 'q11',
      type: 'textarea',
      label: 'Algo mais que eu deveria saber antes da nossa conversa?',
      placeholder: 'Opcional',
      required: false
    },
    {
      id: 'q12',
      type: 'radio',
      label: 'Como você me conheceu?',
      required: true,
      options: ['Pelo Instagram', 'Indicação de amigo', 'Pelo TikTok', 'Outro']
    }
  ];

  var TOTAL = QUESTIONS.length;
  var current = 0;
  var answers = {};
  var radioSelection = {};
  var otherText = {};

  // ---- Classificação (espelha api/apply.js) ----
  function classificar(respostas) {
    var gasto = respostas.q3;
    var pronta = respostas.q10;

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

  // ---- DOM refs ----
  var heroSection = document.getElementById('hero');
  var formSection = document.getElementById('form-section');
  var resultSection = document.getElementById('result-section');
  var btnStart = document.getElementById('btn-start');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var questionCard = document.getElementById('question-card');
  var errorMsg = document.getElementById('error-msg');
  var progressFill = document.getElementById('progress-fill');
  var qNum = document.getElementById('q-num');
  var qTotal = document.getElementById('q-total');

  qTotal.textContent = TOTAL;

  btnStart.addEventListener('click', function () {
    heroSection.hidden = true;
    formSection.hidden = false;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btnPrev.addEventListener('click', handlePrev);
  btnNext.addEventListener('click', handleNext);

  document.addEventListener('keydown', function (e) {
    if (formSection.hidden) return;
    var active = document.activeElement;
    var tag = active ? active.tagName : '';
    var isTextArea = tag === 'TEXTAREA';
    var isTextInput = tag === 'INPUT' && active.type === 'text';
    var isRadio = tag === 'INPUT' && active.type === 'radio';

    if (e.key === 'Enter') {
      if (isTextArea) return; // permite quebra de linha
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowRight' && !isTextArea && !isTextInput && !isRadio) {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft' && !isTextArea && !isTextInput && !isRadio) {
      e.preventDefault();
      handlePrev();
    }
  });

  function render() {
    var q = QUESTIONS[current];
    errorMsg.textContent = '';
    qNum.textContent = current + 1;
    progressFill.style.width = Math.round(((current + 1) / TOTAL) * 100) + '%';

    questionCard.innerHTML = '';

    var label = document.createElement('h2');
    label.className = 'question-label';
    label.textContent = q.label;
    questionCard.appendChild(label);

    if (q.hint) {
      var hint = document.createElement('p');
      hint.className = 'muted';
      hint.style.marginTop = '-12px';
      hint.style.marginBottom = '18px';
      hint.style.fontSize = '13px';
      hint.textContent = q.hint;
      questionCard.appendChild(hint);
    }

    if (q.type === 'text') {
      renderTextInput(q);
    } else if (q.type === 'textarea') {
      renderTextarea(q);
    } else if (q.type === 'radio') {
      renderRadio(q, false);
    } else if (q.type === 'radio-other') {
      renderRadio(q, true);
    }

    btnPrev.disabled = current === 0;
    btnNext.textContent = current === TOTAL - 1 ? 'Enviar aplicação' : 'Próxima →';
    btnNext.classList.toggle('is-submit', current === TOTAL - 1);

    // foco automático em inputs de texto (não em radios, pra não disparar seleção sem querer)
    var firstField = questionCard.querySelector('input[type="text"], textarea');
    if (firstField) {
      setTimeout(function () {
        firstField.focus();
      }, 10);
    }
  }

  function renderTextInput(q) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-input';
    input.placeholder = q.placeholder || '';
    input.value = answers[q.id] || '';
    input.autocomplete = q.id === 'q1' ? 'name' : 'tel';
    input.addEventListener('input', function () {
      answers[q.id] = input.value;
      errorMsg.textContent = '';
    });
    questionCard.appendChild(input);
  }

  function renderTextarea(q) {
    var textarea = document.createElement('textarea');
    textarea.className = 'field-textarea';
    textarea.placeholder = q.placeholder || '';
    textarea.value = answers[q.id] || '';
    textarea.addEventListener('input', function () {
      answers[q.id] = textarea.value;
      errorMsg.textContent = '';
      updateCharCount();
    });
    questionCard.appendChild(textarea);

    if (q.minLength) {
      var count = document.createElement('p');
      count.className = 'char-count';
      count.id = 'char-count';
      questionCard.appendChild(count);
      updateCharCount();
    }

    function updateCharCount() {
      var el = document.getElementById('char-count');
      if (!el) return;
      var len = (answers[q.id] || '').length;
      el.textContent = len + ' / ' + q.minLength + ' caracteres mínimos';
      el.style.color = len >= q.minLength ? '#666' : '#c8102e';
    }
  }

  function renderRadio(q, hasOther) {
    var list = document.createElement('div');
    list.className = 'options-list';

    var selected = radioSelection[q.id] || '';
    var renderOptions = hasOther ? q.options.concat([OTHER_LABEL]) : q.options;

    renderOptions.forEach(function (opt, idx) {
      var optionEl = document.createElement('label');
      optionEl.className = 'radio-option' + (selected === opt ? ' selected' : '');

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = q.id;
      input.value = opt;
      input.checked = selected === opt;

      input.addEventListener('change', function () {
        selectRadioOption(q, opt, hasOther);
      });

      var span = document.createElement('span');
      span.textContent = opt;

      optionEl.appendChild(input);
      optionEl.appendChild(span);
      list.appendChild(optionEl);
    });

    questionCard.appendChild(list);

    var isOtherSelected = hasOther && selected === OTHER_LABEL;
    if (hasOther && isOtherSelected) {
      var otherInput = document.createElement('input');
      otherInput.type = 'text';
      otherInput.className = 'field-input radio-option-other-input';
      otherInput.placeholder = q.otherPlaceholder || 'Conte mais...';
      otherInput.value = otherText[q.id] || '';
      otherInput.addEventListener('input', function () {
        otherText[q.id] = otherInput.value;
        answers[q.id] = otherInput.value;
        errorMsg.textContent = '';
      });
      questionCard.appendChild(otherInput);
    }
  }

  function selectRadioOption(q, opt, hasOther) {
    radioSelection[q.id] = opt;
    errorMsg.textContent = '';

    if (hasOther && opt === OTHER_LABEL) {
      answers[q.id] = otherText[q.id] || '';
    } else {
      answers[q.id] = opt;
    }
    render();
  }

  function validateCurrent() {
    var q = QUESTIONS[current];
    var value = answers[q.id];

    if (!q.required) return true;

    if (q.type === 'radio-other') {
      var sel = radioSelection[q.id];
      if (!sel) {
        errorMsg.textContent = 'Escolha uma opção pra continuar.';
        return false;
      }
      if (sel === OTHER_LABEL && !(otherText[q.id] || '').trim()) {
        errorMsg.textContent = 'Conta um pouquinho mais no campo "Outro".';
        return false;
      }
      return true;
    }

    if (q.type === 'radio') {
      if (!value) {
        errorMsg.textContent = 'Escolha uma opção pra continuar.';
        return false;
      }
      return true;
    }

    if (!value || !String(value).trim()) {
      errorMsg.textContent = 'Esse campo é obrigatório.';
      return false;
    }

    if (q.minLength && String(value).trim().length < q.minLength) {
      errorMsg.textContent = q.errorText || ('Mínimo de ' + q.minLength + ' caracteres.');
      return false;
    }

    if (q.validate && !q.validate(String(value).trim())) {
      errorMsg.textContent = q.errorText || 'Valor inválido.';
      return false;
    }

    return true;
  }

  function handlePrev() {
    if (current === 0) return;
    current -= 1;
    render();
  }

  function handleNext() {
    if (!validateCurrent()) return;

    if (current === TOTAL - 1) {
      submitApplication();
      return;
    }

    current += 1;
    render();
  }

  function submitApplication() {
    btnNext.disabled = true;
    btnPrev.disabled = true;
    btnNext.innerHTML = '<span class="spinner"></span>Enviando...';

    var payload = {};
    QUESTIONS.forEach(function (q) {
      payload[q.id] = answers[q.id] || '';
    });

    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        var classe = data && data.classe ? data.classe : classificar(payload);
        showResult(classe, payload);
      })
      .catch(function () {
        // fallback: mesmo se a API falhar, não deixa a pessoa sem resposta
        var classe = classificar(payload);
        showResult(classe, payload);
      });
  }

  function firstName(fullName) {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
  }

  function showResult(classe, payload) {
    formSection.hidden = true;
    resultSection.hidden = false;
    resultSection.innerHTML = '';

    var nome = firstName(payload.q1) || '';

    var wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    wrap.style.paddingTop = '12px';

    if (classe === 'QUENTE') {
      wrap.innerHTML =
        '<div class="result-icon gold">✓</div>' +
        '<h1 class="result-title">Aplicação recebida!</h1>' +
        '<div class="result-body">' +
        '<p>Obrigada, ' + escapeHtml(nome) + '.</p>' +
        '<p>Analiso teu perfil com cuidado e te chamo no WhatsApp em até 24h pra agendar nossa conversa.</p>' +
        '</div>' +
        '<p class="result-signature">Um abraço,<br>Rafa</p>';
    } else if (classe === 'MEDIO') {
      wrap.innerHTML =
        '<div class="result-icon navy">✓</div>' +
        '<h1 class="result-title">Aplicação recebida!</h1>' +
        '<div class="result-body">' +
        '<p>Obrigada, ' + escapeHtml(nome) + '.</p>' +
        '<p>Analiso teu perfil com atenção e te chamo no WhatsApp em até 48h.</p>' +
        '</div>' +
        '<p class="result-signature">Um abraço,<br>Rafa</p>';
    } else {
      wrap.innerHTML =
        '<div class="result-icon gray">i</div>' +
        '<h1 class="result-title">Obrigada pela sua aplicação' + (nome ? ', ' + escapeHtml(nome) : '') + '.</h1>' +
        '<div class="result-body">' +
        '<p>Pelo teu perfil, o melhor caminho AGORA é o Desafio Milhas em 7 dias.</p>' +
        '<p>Em 7 dias você já economiza mais do que o valor investido — e sai com um plano concreto pra sua próxima viagem.</p>' +
        '<p>Quando fizer sentido subir pra Consultoria VIP, eu tô aqui.</p>' +
        '</div>';

      var cta = document.createElement('a');
      cta.href = DESAFIO_URL;
      cta.target = '_blank';
      cta.rel = 'noopener';
      cta.className = 'btn btn-gold';
      cta.style.marginTop = '28px';
      cta.innerHTML = '<div class="btn-title" style="justify-content:center;">Começar pelo Desafio (R$97)</div>';
      wrap.appendChild(document.createElement('div')); // spacer via margin already
      wrap.appendChild(cta);
    }

    resultSection.appendChild(wrap);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();

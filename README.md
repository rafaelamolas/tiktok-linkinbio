# TikTok Link-in-Bio — Rafaela Molás

Link-in-bio próprio (substitui o link direto pro Desafio na bio do TikTok) +
formulário de aplicação para a Consultoria VIP de Milhas.

## Estrutura

```
public/
├── index.html              Link-in-bio (3 CTAs: Desafio, Revolut, Consultoria VIP)
├── aplicacao-vip.html       Formulário de aplicação (estilo Typeform, 12 perguntas)
├── styles.css               Estilo global — paleta "passaporte + boarding pass"
├── linkinbio.js              Pequena animação de entrada dos links
├── form.js                   Lógica do formulário: navegação, validação, classificação, envio
└── assets/
    ├── rafaela.jpg           Foto de perfil
    └── favicon.svg           Aviãozinho dourado

api/
└── apply.js                 Serverless Function: recebe a aplicação, classifica o lead
                              (QUENTE / MEDIO / FRIO) e notifica a Rafaela via Telegram

vercel.json                  outputDirectory=public
```

## Rodar local

Site puro em HTML/CSS/JS. Para ver funcionando de verdade (com a API),
use a CLI da Vercel:

```
vercel dev
```

Abrir `public/index.html` direto no navegador (`file://`) funciona para
navegar entre as páginas, mas o envio do formulário (`/api/apply`) só
funciona com o site servido (via `vercel dev` ou já em produção).

## Classificação do lead

`classificar()` (duplicada em `public/form.js` e `api/apply.js`, mesma lógica):

- **QUENTE** — gasto mensal ≥ R$20 mil E já está pronta ("retorno garantido")
- **FRIO** — gasto até R$10 mil OU ainda não tem certeza do investimento
- **MEDIO** — todo o resto

A tela final do formulário muda de acordo com a classificação. Leads FRIO
recebem um CTA pro Desafio Milhas 7 Dias em vez de "aguarde contato".

## Variáveis de ambiente (Vercel)

| Variável | Descrição |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do bot que notifica a Rafaela |
| `TELEGRAM_CHAT_ID` | Chat ID da Rafaela (Sofia) no Telegram |

<!-- redeploy trigger 2026-08-03 -->

## Deploy

Deploy no Vercel (`vercel --prod`). `outputDirectory` aponta pra `public/`;
a pasta `api/` é detectada automaticamente como Serverless Functions.

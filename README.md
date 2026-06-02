# Triador AI

Despeje o caos. A IA organiza em 5 buckets acionáveis: **Prioridade**, **ROI Alto**, **Delega**, **Depois**, **Descarta**.

Triador AI é uma ferramenta de triagem cognitiva pra empreendedores que vivem afogados em demandas heterogêneas. Em vez de exigir que você decida prioridade, urgência e ROI antes de cadastrar (como Todoist, Notion, Trello), o Triador inverte o modelo: você despeja o caos bruto (texto solto, foto da mesa, transcrição mental) e a IA classifica.

---

## Pré-requisitos

- **Node.js** 20+ (testado em 24)
- **pnpm** 9+
- **Git**

---

## Setup local

```bash
# 1. Clonar o repositório
git clone <url-do-repo>
cd Triador-AI

# 2. Instalar dependências
pnpm install

# 3. Iniciar servidor de desenvolvimento
pnpm dev
```

Abra http://localhost:3000 no navegador.

> Nas próximas stories (1.2+) será necessário configurar `.env.local` com credenciais do Supabase e Anthropic. Veja `.env.example` quando existir.

---

## Comandos disponíveis

| Comando | O que faz |
|---------|-----------|
| `pnpm dev` | Inicia dev server (Turbopack) em http://localhost:3000 |
| `pnpm build` | Build de produção |
| `pnpm start` | Roda o build local |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript estrito (sem emit) |

---

## Stack

- **Next.js** 16 (App Router) + **React** 19 + **TypeScript** estrito
- **Tailwind CSS** 4 + **Shadcn/ui** (preset Base UI)
- **Phosphor Icons** (regra do projeto: **nunca Lucide**)
- **next-themes** pra dark mode (default: system)
- **Supabase** (DB + Auth + Storage) — chega na Story 1.2
- **Anthropic Claude API** — chega na Story 2.1
- Deploy automático via **Vercel** em push para `main`

---

## Documentação

| Doc | Descrição |
|-----|-----------|
| [docs/prd.md](./docs/prd.md) | Product Requirements Document (5 épicos, 27 stories) |
| [docs/architecture.md](./docs/architecture.md) | Arquitetura fullstack (20 seções) |
| [docs/front-end-spec.md](./docs/front-end-spec.md) | UI/UX spec + design system |
| [docs/stories/](./docs/stories/) | Stories executáveis por épico |

---

## Deploy

URL de produção: _a preencher após Yuri conectar Vercel (Task 8 da Story 1.1)_

---

## Convenções

- **Conventional Commits:** `tipo(escopo): mensagem [Story X.Y]`
  Ex: `feat: setup inicial Next.js [Story 1.1]`
- **TypeScript estrito**: sem `any`. Use `unknown` + narrowing.
- **Server Components por padrão**. Vire `'use client'` só quando precisar de hooks ou interatividade.
- **Ícones**: SEMPRE [Phosphor Icons](https://phosphoricons.com/). Lucide é banido via ESLint.

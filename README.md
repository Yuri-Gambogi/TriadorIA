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

> A partir da Story 1.2 é necessário configurar `.env.local` com credenciais do Supabase. Copia `.env.example` pra `.env.local` e preenche com as chaves do seu projeto Supabase (Dashboard → Settings → API + Settings → Database).

---

## Comandos disponíveis

| Comando             | O que faz                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`          | Inicia dev server (Turbopack) em http://localhost:3000                                   |
| `pnpm build`        | Build de produção                                                                        |
| `pnpm start`        | Roda o build local                                                                       |
| `pnpm lint`         | ESLint                                                                                   |
| `pnpm typecheck`    | TypeScript estrito (sem emit)                                                            |
| `pnpm format`       | Prettier — formata todo o código                                                         |
| `pnpm format:check` | Prettier — só verifica (CI-friendly)                                                     |
| `pnpm db:studio`    | Abre Drizzle Studio em http://localhost:4983 (visualiza tabelas)                         |
| `pnpm db:push`      | Aplica schema Drizzle direto no banco (uso em dev)                                       |
| `pnpm db:generate`  | Gera migration a partir do schema TS (uso em fluxo de migrations gerenciado por Drizzle) |
| `pnpm db:migrate`   | Aplica migrations pendentes                                                              |

---

## Stack

- **Next.js** 16 (App Router) + **React** 19 + **TypeScript** estrito
- **Tailwind CSS** 4 + **Shadcn/ui** (preset Base UI)
- **Phosphor Icons** (regra do projeto: **nunca Lucide**)
- **next-themes** pra dark mode (default: system)
- **Supabase** (PostgreSQL 16 + Auth + Storage + RLS) — ativo a partir da Story 1.2
- **Drizzle ORM** (postgres.js driver) — tipos compartilhados entre código e banco
- **Husky + commitlint + lint-staged + Prettier** — pre-commit hooks pra qualidade
- **Anthropic Claude API** — chega na Story 2.1
- Deploy automático via **Vercel** em push para `main`

---

## Banco de dados (Supabase + Drizzle)

**Schema:** definido em SQL puro em `supabase/migrations/*.sql` (source-of-truth) e refletido em TypeScript em `lib/db/schema.ts` (gera tipos).

**Aplicar migration nova:**

1. Cria arquivo `supabase/migrations/{YYYYMMDDHHMMSS}_descricao.sql`
2. Atualiza `lib/db/schema.ts` pra refletir
3. Aplica via Supabase Dashboard → SQL Editor (cola o SQL e roda)
4. Valida com `pnpm db:studio` (abre Drizzle Studio)

**Row-Level Security (RLS):** ativo em todas as tabelas. Server-side **nunca** filtra `user_id` manualmente — confia no RLS. Service role bypassa RLS (uso apenas em cron jobs/webhooks).

**Tabelas:**

- `profiles` — estende `auth.users` (plan, criterios_personalizados, onboarding_completed)
- `triagens` — sessões de captura (texto bruto, status, custo Claude)
- `itens` — itens classificados por triagem (texto, bucket, justificativa)

---

## Documentação

| Doc                                                | Descrição                                            |
| -------------------------------------------------- | ---------------------------------------------------- |
| [docs/prd.md](./docs/prd.md)                       | Product Requirements Document (5 épicos, 27 stories) |
| [docs/architecture.md](./docs/architecture.md)     | Arquitetura fullstack (20 seções)                    |
| [docs/front-end-spec.md](./docs/front-end-spec.md) | UI/UX spec + design system                           |
| [docs/stories/](./docs/stories/)                   | Stories executáveis por épico                        |

---

## Deploy

- **Produção:** https://triador-ia.vercel.app
- Deploy automático via Vercel em cada push para `main`
- Repositório: https://github.com/Yuri-Gambogi/TriadorIA

---

## Convenções

- **Conventional Commits:** `tipo(escopo): mensagem [Story X.Y]`
  Ex: `feat: setup inicial Next.js [Story 1.1]`
- **TypeScript estrito**: sem `any`. Use `unknown` + narrowing.
- **Server Components por padrão**. Vire `'use client'` só quando precisar de hooks ou interatividade.
- **Ícones**: SEMPRE [Phosphor Icons](https://phosphoricons.com/). Lucide é banido via ESLint.

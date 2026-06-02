# Triador AI — Fullstack Architecture Document

**Versão:** 0.1 (YOLO Draft)
**Autor:** Aria (Architect) com Yuri Gambogi
**Data:** 2026-06-01
**Status:** Draft — aguardando revisão do usuário
**Documentos relacionados:** [PRD v0.1](./prd.md)

---

## 1. Introduction

Este documento define a arquitetura fullstack completa do **Triador AI** — backend, frontend e integração entre eles. É a fonte única de verdade pra todo o desenvolvimento. Foi projetado pra permitir que agentes de IA (e o Yuri) executem o build sem ambiguidade.

A abordagem é **unificada**: em vez de separar arquitetura de backend e frontend em documentos diferentes, este doc trata o sistema como um todo, porque o Triador AI é um Next.js fullstack — frontend e backend convivem no mesmo runtime.

### 1.1 Starter Template

**N/A — Greenfield project.** O Triador AI será inicializado com `create-next-app@latest` (Next.js 15 com TypeScript, Tailwind, App Router e ESLint), sem usar starter de terceiros (T3, Vercel templates, etc.). Justificativa: o escopo é controlável e o stack já está bem definido no PRD — adicionar um starter genérico traria mais opinião do que valor.

### 1.2 Change Log

| Data       | Versão | Descrição                                                | Autor |
|------------|--------|----------------------------------------------------------|-------|
| 2026-06-01 | 0.1    | Criação inicial em modo YOLO baseado no PRD v0.1         | Aria  |

---

## 2. High Level Architecture

### 2.1 Technical Summary

O Triador AI é uma aplicação **Next.js fullstack serverless** hospedada na Vercel, com Supabase fornecendo banco PostgreSQL, autenticação, storage de imagens e Row-Level Security. A camada de inteligência usa a **Claude API** (Sonnet 4.6 como padrão, com prompt caching agressivo) para classificar entradas de texto e imagem em 5 buckets acionáveis. Frontend e backend coexistem no mesmo monorepo Next.js usando App Router: rotas de UI em `app/`, Route Handlers em `app/api/`, e Server Components quando o dado pode vir direto do servidor. A integração entre frontend e backend é tipada end-to-end via TypeScript estrito + Zod + Drizzle ORM (gerando tipos a partir do schema do Postgres). Esta arquitetura cumpre os goals do PRD — baixo overhead de operação no MVP (tier gratuito de Vercel + Supabase), escalabilidade automática serverless, e custo previsível por triagem (< US$ 0.05 com cache de prompt).

### 2.2 Platform and Infrastructure Choice

**Plataforma:** Vercel (frontend + serverless API) + Supabase (BaaS) + Anthropic Claude API
**Serviços-chave:**
- **Vercel:** hospedagem, edge functions, preview deployments, analytics
- **Supabase:** PostgreSQL 16 + Auth (email/Google OAuth) + Storage (imagens) + RLS + pgvector (embeddings)
- **Anthropic Claude API:** Sonnet 4.6 (classificação padrão), Opus 4.7 (casos complexos sob demanda), vision multimodal
- **Stripe** (Epic 5): Checkout + Customer Portal + Webhooks
- **GitHub Actions:** CI (lint, typecheck, testes), deploy via Vercel integration
- **Sentry** (Epic 5): error tracking em produção

**Deployment Host e Regiões:**
- Vercel: edge global, com região primária `iad1` (Washington DC) — proximidade ao us-east-1 da AWS
- Supabase: região `us-east-1` (mesma região do Vercel pra minimizar latência DB)
- Justificativa: latência cruzando regiões custa mais que centavos por requisição em Claude API; alinhar regiões mantém p95 baixo

**Alternativas avaliadas:**
- **AWS full stack (Lambda + API Gateway + RDS + S3 + Cognito):** rejeitado — overhead operacional alto pra um iniciante; sem benefício no MVP
- **Cloudflare Workers + D1 + R2:** rejeitado — D1 ainda imaturo pra workloads transacionais; Vector está em beta
- **Railway + Postgres gerenciado:** rejeitado — Vercel oferece preview deployments melhores e Supabase é mais completo (auth + storage no mesmo serviço)

### 2.3 Repository Structure

**Estrutura:** Monorepo simples (sem Turborepo/Nx no MVP)
**Ferramenta de monorepo:** Nenhuma (npm workspaces apenas se necessário no Epic 5)
**Organização de pacotes:** Single-app — o Next.js já é fullstack, então o "monorepo" é apenas o repositório com `apps/web` no MVP. Adicionar Turborepo só quando aparecer um segundo app (ex: dashboard admin separado).

Justificativa: Yuri é iniciante. Turborepo é genial mas adiciona conceitos (workspaces, dependências entre pacotes, cache distribuído) que custam mais que ajudam no MVP. Começamos simples, evoluímos quando dor real aparecer.

### 2.4 High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Usuários"
        U_Desktop[Desktop Browser]
        U_Mobile[Mobile PWA]
    end

    subgraph "Vercel Edge Network"
        CDN[Vercel CDN + Edge]
        NextApp[Next.js 15 App<br/>App Router]
        APIRoutes[API Route Handlers<br/>/api/*]
        EdgeFn[Edge Functions<br/>auth, rate limit]
    end

    subgraph "Supabase Cloud"
        Auth[Supabase Auth<br/>Email + Google OAuth]
        DB[(PostgreSQL 16<br/>+ pgvector + RLS)]
        Storage[Supabase Storage<br/>Imagens]
    end

    subgraph "Anthropic"
        ClaudeAPI[Claude API<br/>Sonnet 4.6 / Opus 4.7<br/>+ Vision]
    end

    subgraph "Stripe (Epic 5)"
        StripeCheckout[Stripe Checkout]
        StripePortal[Customer Portal]
    end

    subgraph "Observabilidade"
        VercelAnalytics[Vercel Analytics]
        Sentry[Sentry<br/>Epic 5]
    end

    U_Desktop --> CDN
    U_Mobile --> CDN
    CDN --> NextApp
    NextApp --> APIRoutes
    NextApp --> EdgeFn
    EdgeFn --> Auth
    APIRoutes --> Auth
    APIRoutes --> DB
    APIRoutes --> Storage
    APIRoutes --> ClaudeAPI
    APIRoutes --> StripeCheckout
    NextApp --> StripePortal
    StripeCheckout -.webhook.-> APIRoutes
    NextApp --> VercelAnalytics
    APIRoutes --> Sentry
```

### 2.5 Architectural Patterns

- **Serverless Fullstack (Next.js App Router):** Frontend SSR/RSC + API Route Handlers no mesmo runtime, deployado como serverless functions na Vercel. _Rationale:_ elimina drift entre FE e BE, simplifica deploy, e a Vercel cobra só quando há tráfego (perfeito pra MVP de baixo volume).
- **Server Components first, Client Components quando necessário:** Renderiza no servidor sempre que possível; vira Client Component apenas quando há interatividade (drag-and-drop, forms, animações). _Rationale:_ reduz bundle JS no cliente, melhora First Contentful Paint, e dados vêm pré-renderizados (zero loading state pra leitura).
- **Engine de Classificação como Pure Function:** A engine vive em `lib/engine/` como uma função pura `classificar(texto, criterios) → itens[]`. Não conhece HTTP, banco ou usuário — apenas entrada e saída. _Rationale:_ testabilidade máxima (mocka só a Claude API), reutilizável (chamável de API route, server action, ou edge function).
- **Repository Pattern (leve) com Drizzle:** Acesso ao banco passa por funções em `lib/db/queries/` (ex: `getTriagensByUser`, `insertItens`). Nunca usa o cliente Supabase diretamente em rotas. _Rationale:_ centraliza queries, facilita migração futura de ORM, e dá um ponto único pra adicionar cache.
- **Row-Level Security (RLS) como defesa primária:** Toda tabela tem policies que filtram por `auth.uid()`. O backend confia no RLS — não duplica a lógica de "este registro é deste usuário?" em código. _Rationale:_ defense in depth; mesmo se houver bug em rota, o banco recusa. Crítico pra multi-tenant futuro.
- **Tipagem end-to-end (Zod no boundary, Drizzle no DB):** Zod valida payloads de API. Drizzle gera tipos do schema. Tipos compartilhados ficam em `lib/types/`. _Rationale:_ erros de contrato viram erros de compilação, não bugs em produção.
- **Optimistic UI no drag-and-drop:** Movimentação entre buckets atualiza UI imediatamente, com rollback se a API falhar. _Rationale:_ percepção de velocidade é não-negociável em ferramenta de produtividade.
- **Prompt caching obrigatório:** System prompts da Claude API usam cache control. _Rationale:_ corta ~80% do custo em chamadas repetidas — diferença entre US$ 0.04 e US$ 0.20 por triagem.
- **Feature flags via env vars:** Features novas (ex: captura por imagem do Epic 4) entram atrás de flags antes de ir pra produção. _Rationale:_ permite deploy contínuo sem expor recursos incompletos.

---

## 3. Tech Stack

> **AVISO:** Esta é a tabela DEFINITIVA. Toda implementação deve usar exatamente estas versões.

| Categoria | Tecnologia | Versão | Propósito | Justificativa |
|-----------|------------|--------|-----------|---------------|
| **Frontend Language** | TypeScript | 5.6+ | Linguagem do frontend | Type safety estrito, padrão da indústria |
| **Frontend Framework** | Next.js | 15.x (App Router) | Framework fullstack React | RSC, streaming, edge runtime, ecossistema maduro |
| **UI Library** | React | 19.x | Biblioteca de UI | Necessária pelo Next.js 15 |
| **UI Component Library** | Shadcn/ui | latest | Componentes acessíveis | Copy-paste (sem dependência runtime), Radix por baixo, customizável |
| **CSS Framework** | Tailwind CSS | 4.x | Estilização utility-first | Velocidade de prototipação, design tokens, dark mode trivial |
| **Iconografia** | Phosphor Icons | 2.x | Ícones SVG premium | **Regra do usuário: SVG premium, nunca Lucide.** Phosphor tem 9k+ ícones, peso variável |
| **State Management (client)** | Zustand | 5.x | Estado global leve | API simples, sem boilerplate, persist middleware pronto |
| **State Management (server)** | React Server Components + Server Actions | nativo | Dados do servidor | Elimina necessidade de React Query no MVP |
| **Forms** | React Hook Form | 7.x | Gestão de formulários | Performante, integra com Zod |
| **Schema Validation** | Zod | 3.x | Validação de dados | Tipos inferidos, runtime safety, compartilhável FE/BE |
| **Drag-and-Drop** | dnd-kit | 6.x | Drag-and-drop acessível | Acessibilidade por padrão, leve, ativo |
| **Backend Language** | TypeScript | 5.6+ | Linguagem do backend | Compartilha tipos com frontend |
| **Backend Framework** | Next.js Route Handlers | 15.x | API endpoints | Sem dependência extra; mesmo runtime do frontend |
| **API Style** | REST + Zod | — | Estilo de API | Simples, debugável; tRPC seria mais elegante mas adiciona conceito pra iniciante |
| **Database** | PostgreSQL (Supabase) | 16.x | Banco relacional | ACID, JSON nativo, pgvector pra embeddings, RLS poderoso |
| **ORM** | Drizzle ORM | latest | Type-safe SQL builder | Migrations versionadas, tipos gerados do schema, leve |
| **Cache** | Vercel KV (opcional, Epic 3+) | latest | Cache de resultados | Adicionar quando latência exigir; MVP sem cache |
| **File Storage** | Supabase Storage | nativo | Imagens (foto/print) | Integrado com Auth e RLS |
| **Authentication** | Supabase Auth | nativo | Email/senha + Google OAuth | Email magic links, sessions via cookies HTTP-only |
| **AI Provider** | Anthropic Claude API | latest SDK | Classificação + Vision | Modelos: claude-sonnet-4-6 (padrão), claude-opus-4-7 (complexo). Prompt caching obrigatório |
| **Vector Embeddings** | pgvector | 0.7+ | Detecção de duplicatas (Story 3.4) | Extension nativa do Supabase, sem serviço extra |
| **Frontend Testing** | Vitest + React Testing Library | latest | Unit + Component tests | Rápido, ESM-first, compatível com Vite |
| **Backend Testing** | Vitest | latest | Unit tests de lógica/API | Mesmo runner do frontend |
| **E2E Testing** | Playwright | 1.x | Testes end-to-end | Multi-browser, paralelismo, debugger excelente |
| **Build Tool** | Next.js (Turbopack) | 15.x | Bundler/compiler | Vem com Next; Turbopack default em dev |
| **Package Manager** | pnpm | 9.x | Gerenciador de pacotes | Mais rápido e eficiente que npm; suporte a workspaces futuro |
| **Linter** | ESLint | 9.x (flat config) | Lint de código | Padrão da indústria |
| **Formatter** | Prettier | 3.x | Formatação | Sem debate sobre estilo |
| **Git Hooks** | Husky + lint-staged | latest | Pre-commit validation | Bloqueia commit com lint/typecheck falhando |
| **CI/CD** | GitHub Actions + Vercel | nativo | CI + Deploy automático | Vercel deployment via Git integration, Actions para lint/test |
| **Monitoring (FE)** | Vercel Analytics + Speed Insights | nativo | Web vitals + traffic | Plug-and-play, suficiente no MVP |
| **Monitoring (BE)** | Supabase Logs + Vercel Logs | nativo | Logs estruturados | Free tier suficiente |
| **Error Tracking** | Sentry (Epic 5) | latest | Errors em produção | Adicionar quando houver usuários externos |
| **Payments** | Stripe (Epic 5) | latest | Checkout + assinaturas | Padrão de SaaS |
| **Conventional Commits** | Commitlint | latest | Padronização de commits | Habilita changelog automático |

---

## 4. Data Models

Modelos principais compartilhados entre frontend e backend (definidos em `lib/types/models.ts`).

### 4.1 User

**Propósito:** Representa um usuário autenticado. Gerenciado pelo Supabase Auth; tabela `auth.users` é nativa do Supabase. Estendemos com tabela `public.profiles` para dados de aplicação.

**Atributos-chave:**
- `id`: UUID — referência ao `auth.users.id`
- `email`: string — email do usuário
- `display_name`: string | null — nome exibido na UI
- `plan`: enum (`'free'` | `'pro'`) — plano atual (default: `'free'`)
- `criterios_personalizados`: jsonb | null — critérios editados em Story 3.1
- `onboarding_completed`: boolean — controla exibição do onboarding
- `created_at`: timestamptz
- `updated_at`: timestamptz

**TypeScript Interface:**
```typescript
export type Plan = 'free' | 'pro';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  plan: Plan;
  criteriosPersonalizados: CriteriosPersonalizados | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriteriosPersonalizados {
  prioridade?: string;
  roiAlto?: string;
  delega?: string;
  depois?: string;
  descarta?: string;
}
```

**Relationships:**
- 1 User → N Triagens
- 1 User → N FeedbackLoop entries

---

### 4.2 Triagem

**Propósito:** Uma sessão de triagem — quando o usuário despeja conteúdo e o sistema classifica.

**Atributos-chave:**
- `id`: UUID
- `user_id`: UUID — FK para `auth.users.id`
- `texto_bruto`: text | null — conteúdo original digitado
- `imagem_url`: text | null — URL da imagem anexada (Epic 4)
- `status`: enum (`'pendente'` | `'classificando'` | `'classificada'` | `'erro'`)
- `tokens_input`: integer — tokens consumidos no input (telemetria)
- `tokens_output`: integer — tokens consumidos no output
- `custo_estimado_usd`: numeric — custo da chamada Claude
- `modelo_usado`: string — ex: `'claude-sonnet-4-6'`
- `created_at`: timestamptz
- `classified_at`: timestamptz | null

**TypeScript Interface:**
```typescript
export type StatusTriagem = 'pendente' | 'classificando' | 'classificada' | 'erro';

export interface Triagem {
  id: string;
  userId: string;
  textoBruto: string | null;
  imagemUrl: string | null;
  status: StatusTriagem;
  tokensInput: number;
  tokensOutput: number;
  custoEstimadoUsd: number;
  modeloUsado: string;
  createdAt: string;
  classifiedAt: string | null;
}
```

**Relationships:**
- N Triagens → 1 User
- 1 Triagem → N Itens

---

### 4.3 Item

**Propósito:** Cada item classificado dentro de uma triagem.

**Atributos-chave:**
- `id`: UUID
- `triagem_id`: UUID — FK para `triagens.id`
- `texto`: text — conteúdo do item após extração
- `bucket`: enum (`'prioridade'` | `'roi_alto'` | `'delega'` | `'depois'` | `'descarta'`)
- `justificativa`: text — explicação curta da IA
- `posicao`: integer — ordem dentro da coluna
- `concluido`: boolean — marcado como done?
- `concluido_at`: timestamptz | null
- `gatilho_retorno`: jsonb | null — para itens em `depois` (Story 3.6): `{ tipo: 'data' | 'condicao', valor: string }`
- `delegacao`: jsonb | null — para itens em `delega` (Story 3.7): `{ destinatario, canal, status }`
- `embedding`: vector(1536) | null — para detecção de duplicatas (Story 3.4)
- `created_at`: timestamptz

**TypeScript Interface:**
```typescript
export type Bucket = 'prioridade' | 'roi_alto' | 'delega' | 'depois' | 'descarta';

export interface GatilhoRetorno {
  tipo: 'data' | 'condicao';
  valor: string;
}

export interface Delegacao {
  destinatario: string;
  canal: 'email' | 'whatsapp' | 'outro';
  status: 'rascunho' | 'enviado';
  mensagem_gerada?: string;
}

export interface Item {
  id: string;
  triagemId: string;
  texto: string;
  bucket: Bucket;
  justificativa: string;
  posicao: number;
  concluido: boolean;
  concluidoAt: string | null;
  gatilhoRetorno: GatilhoRetorno | null;
  delegacao: Delegacao | null;
  createdAt: string;
}
```

**Relationships:**
- N Itens → 1 Triagem
- 1 Item → 1 Embedding (mesmo registro)

---

### 4.4 FeedbackLoop

**Propósito:** Registra cada movimentação manual entre buckets, alimentando o aprendizado (Story 3.2).

**Atributos-chave:**
- `id`: UUID
- `user_id`: UUID
- `item_id`: UUID
- `bucket_anterior`: Bucket
- `bucket_novo`: Bucket
- `texto_item`: text — snapshot pra alimentar few-shot
- `created_at`: timestamptz

**TypeScript Interface:**
```typescript
export interface FeedbackLoop {
  id: string;
  userId: string;
  itemId: string;
  bucketAnterior: Bucket;
  bucketNovo: Bucket;
  textoItem: string;
  createdAt: string;
}
```

---

## 5. API Specification

API REST minimalista usando Next.js Route Handlers. Toda rota:
- Valida payload com **Zod** antes de processar
- Autentica via cookie do Supabase (helper em `lib/auth/`)
- Retorna `ApiError` padronizado (ver seção 18) em caso de erro
- Loga estruturado (`requestId`, `userId`, `latency`)

### 5.1 Endpoints (REST)

```yaml
openapi: 3.0.0
info:
  title: Triador AI API
  version: 0.1.0
  description: API REST do Triador AI servida via Next.js Route Handlers
servers:
  - url: https://triador.ai/api
    description: Produção
  - url: http://localhost:3000/api
    description: Desenvolvimento local

paths:
  /triagens:
    post:
      summary: Cria nova triagem (texto e/ou imagem)
      security: [{ cookieAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                textoBruto: { type: string, maxLength: 50000 }
                imagemPath: { type: string, description: "path no Supabase Storage, se houver" }
      responses:
        '201':
          description: Triagem criada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Triagem'

    get:
      summary: Lista triagens do usuário
      security: [{ cookieAuth: [] }]
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
        - name: cursor
          in: query
          schema: { type: string, description: "cursor de paginação (created_at + id)" }
        - name: dataInicio
          in: query
          schema: { type: string, format: date }
        - name: dataFim
          in: query
          schema: { type: string, format: date }
        - name: q
          in: query
          schema: { type: string, description: "busca textual nos itens" }
      responses:
        '200':
          description: Lista paginada

  /triagens/{id}:
    get:
      summary: Detalhes de uma triagem com seus itens
      security: [{ cookieAuth: [] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Triagem + itens

  /triagens/{id}/classificar:
    post:
      summary: Aciona classificação Claude API
      security: [{ cookieAuth: [] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Itens classificados
        '402':
          description: Limite do plano free atingido
        '503':
          description: Claude API indisponível

  /triagens/{id}/exportar:
    get:
      summary: Exporta triagem como markdown ou PDF
      security: [{ cookieAuth: [] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: formato
          in: query
          required: true
          schema: { type: string, enum: [markdown, pdf] }
      responses:
        '200':
          description: Arquivo

  /itens/{id}:
    patch:
      summary: Atualiza item (bucket, posição, concluído, gatilho, delegação)
      security: [{ cookieAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                bucket: { type: string, enum: [prioridade, roi_alto, delega, depois, descarta] }
                posicao: { type: integer }
                concluido: { type: boolean }
                gatilhoRetorno: { type: object, nullable: true }
                delegacao: { type: object, nullable: true }
      responses:
        '200':
          description: Item atualizado

  /itens/{id}/gerar-mensagem-delegacao:
    post:
      summary: Gera texto pronto pra delegar (Story 3.7)
      security: [{ cookieAuth: [] }]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                destinatario: { type: string }
                canal: { type: string, enum: [email, whatsapp, outro] }
      responses:
        '200':
          description: Mensagem gerada

  /perfil/criterios:
    get:
      summary: Lê critérios pessoais
      security: [{ cookieAuth: [] }]
    put:
      summary: Atualiza critérios pessoais
      security: [{ cookieAuth: [] }]

  /upload/imagem:
    post:
      summary: Gera signed URL pra upload no Supabase Storage
      security: [{ cookieAuth: [] }]
      responses:
        '200':
          description: Signed URL + path
          content:
            application/json:
              schema:
                type: object
                properties:
                  uploadUrl: { type: string }
                  path: { type: string }

  /stripe/checkout:
    post:
      summary: Cria sessão de Checkout do Stripe (Epic 5)
      security: [{ cookieAuth: [] }]

  /stripe/portal:
    post:
      summary: Cria sessão do Customer Portal (Epic 5)
      security: [{ cookieAuth: [] }]

  /stripe/webhook:
    post:
      summary: Webhook do Stripe — atualiza plano do usuário (Epic 5)
      security: [{ stripeSignature: [] }]

components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: sb-access-token
    stripeSignature:
      type: apiKey
      in: header
      name: stripe-signature
```

---

## 6. Components

### 6.1 Engine de Classificação (`lib/engine/`)

**Responsabilidade:** Função pura que recebe texto bruto + critérios e devolve itens classificados em 5 buckets. Não conhece HTTP, banco, nem usuário.

**Interfaces:**
- `classificarTexto(input: { texto: string, criterios?, exemplosUsuario?, modelo? }) → Promise<ItemClassificado[]>`
- `extrairItensDeImagem(input: { imagemUrl, criterios?, modelo? }) → Promise<ItemClassificado[]>`
- `gerarMensagemDelegacao(input: { item, destinatario, canal }) → Promise<string>`

**Dependências:** Anthropic SDK
**Tech:** TypeScript puro, sem imports de Next.js ou Supabase
**Testabilidade:** mocka apenas a Claude API

### 6.2 Camada de Dados (`lib/db/`)

**Responsabilidade:** Toda interação com Postgres. Define schema (Drizzle), expõe funções de query por feature.

**Interfaces:**
- `lib/db/schema.ts` — definição Drizzle de todas as tabelas
- `lib/db/queries/triagens.ts` — `createTriagem`, `getTriagensByUser`, `getTriagemById`, etc.
- `lib/db/queries/itens.ts` — `insertItens`, `updateItem`, `markConcluido`
- `lib/db/queries/feedback.ts` — `recordFeedback`, `getUltimosExemplos`

**Dependências:** Drizzle, postgres.js, Supabase service role key (para edge cases)
**Tech:** Drizzle ORM, queries SQL tipadas

### 6.3 Camada de Autenticação (`lib/auth/`)

**Responsabilidade:** Centraliza acesso à sessão Supabase. Helpers para Server Components, Route Handlers e middleware.

**Interfaces:**
- `getServerSession()` — para Server Components/Server Actions
- `getApiSession(request)` — para Route Handlers, retorna 401 se ausente
- `requireUser()` — wrapper que lança erro tipado se não autenticado
- `middleware.ts` (na raiz) — refresh de sessão em toda request

**Dependências:** @supabase/ssr, cookies()
**Tech:** Supabase SSR helpers

### 6.4 UI Components (`components/`)

**Responsabilidade:** Componentes React reutilizáveis (board, item card, captura, etc.)

**Subdiretórios:**
- `components/ui/` — Shadcn primitives (Button, Input, Dialog, etc.)
- `components/triador/` — domain-specific (BucketColumn, ItemCard, CaptureBox, BoardView, ImageUploader, DiaView)
- `components/layout/` — Header, Footer, AppShell

**Tech:** React 19 Server/Client Components, Tailwind, Phosphor Icons

### 6.5 State Stores (`stores/`)

**Responsabilidade:** Estado client-side global (Zustand).

**Stores:**
- `useUploadStore` — estado do upload de imagem
- `useBoardStore` — estado otimista do drag-and-drop (sincroniza com servidor)
- `useUserSettingsStore` — critérios pessoais em memória (sincroniza com servidor on save)

**Tech:** Zustand 5 com middleware `persist` quando aplicável

### 6.6 API Layer (`app/api/`)

**Responsabilidade:** Route Handlers que validam, autenticam, chamam queries/engine, retornam JSON tipado.

**Convenção:** uma pasta por recurso. Ex: `app/api/triagens/route.ts` (GET/POST), `app/api/triagens/[id]/route.ts` (GET), `app/api/triagens/[id]/classificar/route.ts` (POST).

### 6.7 Component Diagram

```mermaid
graph LR
    subgraph "UI Layer"
        Pages[App Router Pages]
        Components[components/]
        Stores[stores/ - Zustand]
    end

    subgraph "API Layer"
        Routes[app/api/* - Route Handlers]
        Middleware[middleware.ts]
    end

    subgraph "Domain/Service Layer"
        Engine[lib/engine/ - Classificação Pura]
        Auth[lib/auth/ - Sessão]
        Validators[lib/validators/ - Zod schemas]
    end

    subgraph "Data Layer"
        Queries[lib/db/queries/]
        Schema[lib/db/schema.ts - Drizzle]
    end

    subgraph "External"
        Claude[Claude API]
        Supabase[Supabase: DB + Auth + Storage]
        Stripe[Stripe]
    end

    Pages --> Components
    Components --> Stores
    Components --> Routes
    Pages --> Queries
    Routes --> Middleware
    Routes --> Auth
    Routes --> Validators
    Routes --> Engine
    Routes --> Queries
    Engine --> Claude
    Auth --> Supabase
    Queries --> Schema
    Schema --> Supabase
    Routes --> Stripe
```

---

## 7. External APIs

### 7.1 Anthropic Claude API

- **Propósito:** Classificação semântica de texto e extração visual de imagens
- **Documentação:** https://docs.anthropic.com/claude/reference
- **Base URL:** https://api.anthropic.com
- **Autenticação:** Header `x-api-key` com `ANTHROPIC_API_KEY` (env var, server-side only)
- **Rate Limits:** Tier 1 inicial — 50 RPM, 50k input TPM, 10k output TPM. Suficiente pro MVP. Upgrade automático conforme uso.
- **Modelos usados:**
  - `claude-sonnet-4-6` (padrão — classificação rápida)
  - `claude-opus-4-7` (sob demanda — texto longo > 3000 tokens ou casos ambíguos)

**Endpoints:**
- `POST /v1/messages` — classificação e extração (com tool use estruturado)

**Integração:**
- SDK oficial `@anthropic-ai/sdk`
- **Prompt caching ativo** no system prompt (cache_control: `{type: "ephemeral"}`)
- Streaming desabilitado no MVP (classificação é fast enough sem stream)
- Tool use com JSON schema para garantir saída estruturada
- Retry com backoff exponencial em 529 (overloaded) — máximo 3 tentativas

### 7.2 Supabase

- **Propósito:** DB, Auth, Storage
- **Documentação:** https://supabase.com/docs
- **Autenticação:**
  - Cliente browser: anon key + cookie de sessão
  - Cliente server (privilegiado): service role key (apenas server-side)
- **Rate Limits:** generosos no free tier (500MB DB, 1GB storage, 50k MAU)

**SDKs:**
- `@supabase/ssr` — helpers para Next.js App Router
- `@supabase/supabase-js` — cliente base

### 7.3 Stripe (Epic 5)

- **Propósito:** Cobrança de assinaturas
- **Documentação:** https://stripe.com/docs/api
- **Autenticação:** secret key (server-side) + publishable key (client)
- **Webhooks:** assinados via `stripe-signature` header

**Endpoints usados:**
- `POST /v1/checkout/sessions`
- `POST /v1/billing_portal/sessions`
- Webhook events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## 8. Core Workflows

### 8.1 Fluxo principal — Capturar e classificar texto

```mermaid
sequenceDiagram
    actor U as Usuário
    participant FE as Next.js Client
    participant API as Route Handler<br/>/api/triagens
    participant DB as Supabase Postgres
    participant ENG as Engine<br/>(lib/engine)
    participant LLM as Claude API

    U->>FE: Digita texto + clica "Triar"
    FE->>API: POST /api/triagens { textoBruto }
    API->>API: Valida com Zod
    API->>API: requireUser() — pega sessão
    API->>DB: INSERT triagens (status='pendente')
    DB-->>API: triagem.id
    API-->>FE: 201 { triagem }
    FE->>FE: navigate /triador/[id]
    FE->>API: POST /api/triagens/[id]/classificar
    API->>DB: UPDATE status='classificando'
    API->>DB: SELECT criterios + últimos 10 feedbacks
    API->>ENG: classificarTexto({texto, criterios, exemplos})
    ENG->>LLM: messages.create (com tool use + cache)
    LLM-->>ENG: itens estruturados
    ENG-->>API: ItemClassificado[]
    API->>DB: INSERT itens (todos)
    API->>DB: UPDATE triagens (status='classificada', custo, tokens)
    API-->>FE: 200 { itens }
    FE->>FE: render board kanban
```

### 8.2 Fluxo de imagem (Epic 4)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant FE as Client
    participant API as /api/upload/imagem
    participant SS as Supabase Storage
    participant API2 as /api/triagens/[id]/classificar
    participant ENG as Engine
    participant LLM as Claude Vision

    U->>FE: Seleciona imagem
    FE->>API: POST /api/upload/imagem
    API-->>FE: { uploadUrl, path }
    FE->>SS: PUT uploadUrl (binary)
    SS-->>FE: 200
    FE->>API: POST /api/triagens { imagemPath: path }
    API->>API: cria triagem
    FE->>API2: POST classificar
    API2->>SS: gera signed URL de leitura
    API2->>ENG: extrairItensDeImagem({imagemUrl})
    ENG->>LLM: messages.create (multimodal)
    LLM-->>ENG: itens classificados
    ENG-->>API2: ItemClassificado[]
    API2->>DB: persist
    API2-->>FE: itens
```

### 8.3 Fluxo de drag-and-drop com aprendizado

```mermaid
sequenceDiagram
    actor U as Usuário
    participant FE as Client
    participant Store as Zustand Store
    participant API as /api/itens/[id]
    participant DB as Postgres

    U->>FE: Arrasta item de "depois" → "prioridade"
    FE->>Store: updateItemOptimistic(id, bucket='prioridade')
    Store->>FE: UI atualiza imediatamente
    FE->>API: PATCH /api/itens/[id] { bucket: 'prioridade' }
    API->>DB: BEGIN TX
    API->>DB: UPDATE itens SET bucket='prioridade'
    API->>DB: INSERT feedback_loop (bucket_anterior, bucket_novo, texto)
    API->>DB: COMMIT
    API-->>FE: 200 { item }
    alt API falha
        FE->>Store: rollback()
        FE->>U: toast "Erro, tente de novo"
    end
```

### 8.4 Erro na Claude API com fallback

```mermaid
sequenceDiagram
    participant API as Route Handler
    participant ENG as Engine
    participant LLM as Claude API

    API->>ENG: classificarTexto()
    ENG->>LLM: messages.create
    LLM-->>ENG: 529 Overloaded
    ENG->>ENG: backoff 1s, retry
    ENG->>LLM: messages.create
    LLM-->>ENG: 529 Overloaded
    ENG->>ENG: backoff 2s, retry
    ENG->>LLM: messages.create
    LLM-->>ENG: 529 Overloaded
    ENG-->>API: throw ClassificationError
    API->>API: log error
    API->>DB: UPDATE status='erro'
    API-->>FE: 503 { error: { code: 'AI_UNAVAILABLE', message: 'Tente novamente em alguns instantes' } }
```

---

## 9. Database Schema

Schema completo em PostgreSQL 16 (Supabase). Migrations versionadas em `supabase/migrations/`.

```sql
-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector para Story 3.4

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE plan_tier AS ENUM ('free', 'pro');
CREATE TYPE bucket_type AS ENUM ('prioridade', 'roi_alto', 'delega', 'depois', 'descarta');
CREATE TYPE status_triagem AS ENUM ('pendente', 'classificando', 'classificada', 'erro');

-- ============================================================
-- profiles — extensão de auth.users
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  plan plan_tier NOT NULL DEFAULT 'free',
  criterios_personalizados jsonb,
  onboarding_completed boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Trigger pra criar profile automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- triagens
-- ============================================================
CREATE TABLE public.triagens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto_bruto text,
  imagem_url text,
  status status_triagem NOT NULL DEFAULT 'pendente',
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  custo_estimado_usd numeric(10, 6) NOT NULL DEFAULT 0,
  modelo_usado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  classified_at timestamptz,
  CHECK (texto_bruto IS NOT NULL OR imagem_url IS NOT NULL)
);

CREATE INDEX idx_triagens_user_created ON triagens(user_id, created_at DESC);
CREATE INDEX idx_triagens_status ON triagens(status) WHERE status IN ('pendente', 'classificando');

-- ============================================================
-- itens
-- ============================================================
CREATE TABLE public.itens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  triagem_id uuid NOT NULL REFERENCES triagens(id) ON DELETE CASCADE,
  texto text NOT NULL,
  bucket bucket_type NOT NULL,
  justificativa text NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  concluido_at timestamptz,
  gatilho_retorno jsonb,
  delegacao jsonb,
  embedding vector(1536), -- para Story 3.4 (Voyage AI ou similar)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itens_triagem ON itens(triagem_id);
CREATE INDEX idx_itens_bucket ON itens(triagem_id, bucket, posicao);
CREATE INDEX idx_itens_concluido ON itens(triagem_id) WHERE concluido = false;
-- Índice de similaridade vetorial (HNSW é mais rápido que IVFFlat)
CREATE INDEX idx_itens_embedding ON itens USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- feedback_loop
-- ============================================================
CREATE TABLE public.feedback_loop (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  bucket_anterior bucket_type NOT NULL,
  bucket_novo bucket_type NOT NULL,
  texto_item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user_created ON feedback_loop(user_id, created_at DESC);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_loop ENABLE ROW LEVEL SECURITY;

-- profiles: usuário só vê o próprio
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- triagens: usuário só vê/manipula próprias
CREATE POLICY "triagens_select_own" ON triagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "triagens_insert_own" ON triagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "triagens_update_own" ON triagens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "triagens_delete_own" ON triagens FOR DELETE USING (auth.uid() = user_id);

-- itens: acesso via dono da triagem
CREATE POLICY "itens_select_own" ON itens FOR SELECT
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_insert_own" ON itens FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_update_own" ON itens FOR UPDATE
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));
CREATE POLICY "itens_delete_own" ON itens FOR DELETE
  USING (EXISTS (SELECT 1 FROM triagens t WHERE t.id = itens.triagem_id AND t.user_id = auth.uid()));

-- feedback_loop: usuário só vê o próprio
CREATE POLICY "feedback_select_own" ON feedback_loop FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feedback_insert_own" ON feedback_loop FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Storage bucket pra imagens (privado)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('triador-uploads', 'triador-uploads', false);

CREATE POLICY "uploads_select_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'triador-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "uploads_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'triador-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "uploads_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'triador-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Path convention para uploads:** `{user_id}/{triagem_id}/{filename}` — RLS usa `storage.foldername(name)[1]` pra validar.

---

## 10. Frontend Architecture

### 10.1 Component Architecture

#### Component Organization

```text
components/
├── ui/                          # Shadcn primitives (gerados via CLI)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── toast.tsx
│   ├── skeleton.tsx
│   └── ...
├── layout/
│   ├── AppShell.tsx             # Header + main + sidebar opcional
│   ├── Header.tsx
│   └── Footer.tsx
├── triador/                     # Domain components
│   ├── CaptureBox.tsx           # Caixa de texto principal
│   ├── ImageUploader.tsx        # Upload de imagem
│   ├── BoardView.tsx            # Container das 5 colunas
│   ├── BucketColumn.tsx         # Uma coluna do kanban
│   ├── ItemCard.tsx             # Card individual
│   ├── ItemCardJustification.tsx
│   ├── DiaView.tsx              # Modo "Visão do Dia"
│   ├── HistoricoLista.tsx
│   ├── CriteriosForm.tsx
│   ├── GatilhoRetornoDialog.tsx
│   └── DelegacaoDialog.tsx
└── shared/
    ├── PhosphorIcon.tsx         # Wrapper tipado pros ícones
    └── LoadingSpinner.tsx
```

#### Component Template (Server Component padrão)

```typescript
// Padrão: Server Component (default no App Router)
// Buscar dados direto via lib/db/queries no servidor

import { getTriagemById } from '@/lib/db/queries/triagens';
import { requireUser } from '@/lib/auth/server';
import { BoardView } from '@/components/triador/BoardView';

interface PageProps {
  params: { id: string };
}

export default async function TriagemPage({ params }: PageProps) {
  const user = await requireUser();
  const triagem = await getTriagemById(params.id, user.id);

  if (!triagem) {
    notFound();
  }

  return <BoardView triagem={triagem} />;
}
```

```typescript
// Client Component quando precisa de interatividade
'use client';

import { useBoardStore } from '@/stores/board';
import { Triagem } from '@/lib/types/models';

interface BoardViewProps {
  triagem: Triagem;
}

export function BoardView({ triagem }: BoardViewProps) {
  const itens = useBoardStore((s) => s.itens);
  // ... DnD logic, etc.
  return <div className="grid grid-cols-5 gap-4">...</div>;
}
```

### 10.2 State Management Architecture

#### State Structure

```typescript
// stores/board.ts
import { create } from 'zustand';
import { Item, Bucket } from '@/lib/types/models';

interface BoardState {
  itens: Item[];
  setItens: (itens: Item[]) => void;
  moveItem: (itemId: string, novoBucket: Bucket, novaPosicao: number) => void;
  rollback: (itemId: string, originalState: Item) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  itens: [],
  setItens: (itens) => set({ itens }),
  moveItem: (itemId, novoBucket, novaPosicao) =>
    set((state) => ({
      itens: state.itens.map((i) =>
        i.id === itemId ? { ...i, bucket: novoBucket, posicao: novaPosicao } : i
      ),
    })),
  rollback: (itemId, originalState) =>
    set((state) => ({
      itens: state.itens.map((i) => (i.id === itemId ? originalState : i)),
    })),
}));
```

#### State Patterns

- **Server-first:** dados que não mudam após render (triagem read-only no histórico) vêm via Server Component, sem store
- **Client store apenas pra estado interativo:** drag-and-drop, formulários complexos, settings em edição
- **Optimistic updates obrigatórios:** PATCH/POST otimistas em todo lugar com rollback em erro
- **Sem React Query no MVP:** Server Actions + revalidatePath cobrem 90% dos casos. Adicionar quando aparecer caso real de cache compartilhado.

### 10.3 Routing Architecture

#### Route Organization

```text
app/
├── (marketing)/                 # Group sem layout autenticado
│   ├── page.tsx                 # Landing /
│   ├── precos/page.tsx          # /precos (Epic 5)
│   └── layout.tsx               # Layout marketing
├── (auth)/
│   ├── login/page.tsx           # /login
│   ├── cadastro/page.tsx        # /cadastro
│   ├── callback/route.ts        # OAuth callback
│   └── layout.tsx               # Layout login (centralizado)
├── (app)/                       # Group autenticado
│   ├── triador/
│   │   ├── page.tsx             # /triador (captura)
│   │   ├── [id]/
│   │   │   ├── page.tsx         # /triador/[id] (board)
│   │   │   └── dia/page.tsx     # /triador/[id]/dia
│   │   └── layout.tsx
│   ├── historico/page.tsx       # /historico
│   ├── configuracoes/
│   │   ├── criterios/page.tsx
│   │   └── conta/page.tsx       # plano, billing
│   ├── onboarding/page.tsx
│   ├── admin/page.tsx           # allowlist
│   └── layout.tsx               # AppShell
├── api/                         # Route Handlers
│   ├── triagens/
│   │   ├── route.ts             # POST, GET
│   │   ├── [id]/
│   │   │   ├── route.ts         # GET
│   │   │   ├── classificar/route.ts
│   │   │   └── exportar/route.ts
│   ├── itens/
│   │   └── [id]/
│   │       ├── route.ts         # PATCH
│   │       └── gerar-mensagem-delegacao/route.ts
│   ├── upload/imagem/route.ts
│   ├── perfil/criterios/route.ts
│   └── stripe/
│       ├── checkout/route.ts
│       ├── portal/route.ts
│       └── webhook/route.ts
├── layout.tsx                   # Root layout (html, body)
├── error.tsx                    # Error boundary global
├── not-found.tsx
└── globals.css
```

#### Protected Route Pattern

```typescript
// middleware.ts (raiz do projeto)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.pathname;
  const isAppRoute = url.startsWith('/triador') || url.startsWith('/historico')
    || url.startsWith('/configuracoes') || url.startsWith('/onboarding');

  if (isAppRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|api/stripe/webhook|.*\\..*).*)'],
};
```

### 10.4 Frontend Services Layer

#### API Client Setup

```typescript
// lib/api/client.ts
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: res.statusText } }));
    throw new ApiError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Erro desconhecido', res.status);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
```

#### Service Example

```typescript
// lib/api/triagens.ts
import { api } from './client';
import type { Triagem, Item } from '@/lib/types/models';

export const triagensApi = {
  criar: (payload: { textoBruto?: string; imagemPath?: string }) =>
    api.post<{ triagem: Triagem }>('/triagens', payload),

  classificar: (id: string) =>
    api.post<{ itens: Item[] }>(`/triagens/${id}/classificar`),

  moverItem: (itemId: string, payload: { bucket?: string; posicao?: number; concluido?: boolean }) =>
    api.patch<{ item: Item }>(`/itens/${itemId}`, payload),
};
```

---

## 11. Backend Architecture

### 11.1 Service Architecture (Serverless)

#### Function Organization

```text
app/api/
├── triagens/
│   ├── route.ts                       # POST /api/triagens, GET /api/triagens
│   ├── [id]/
│   │   ├── route.ts                   # GET /api/triagens/[id]
│   │   ├── classificar/route.ts       # POST classificar
│   │   └── exportar/route.ts          # GET exportar
├── itens/[id]/
│   ├── route.ts                       # PATCH /api/itens/[id]
│   └── gerar-mensagem-delegacao/route.ts
├── upload/imagem/route.ts
├── perfil/criterios/route.ts
└── stripe/
    ├── checkout/route.ts
    ├── portal/route.ts
    └── webhook/route.ts                # bodyParser desabilitado, valida assinatura
```

#### Function Template (Route Handler padrão)

```typescript
// app/api/triagens/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { createTriagem } from '@/lib/db/queries/triagens';
import { withErrorHandler, ApiError } from '@/lib/api/error-handler';
import { logger } from '@/lib/observability/logger';

const CriarTriagemSchema = z.object({
  textoBruto: z.string().max(50_000).optional(),
  imagemPath: z.string().optional(),
}).refine((d) => d.textoBruto || d.imagemPath, {
  message: 'textoBruto ou imagemPath obrigatório',
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireUser();
  const json = await request.json();
  const payload = CriarTriagemSchema.parse(json);

  const triagem = await createTriagem({
    userId: user.id,
    textoBruto: payload.textoBruto ?? null,
    imagemUrl: payload.imagemPath ?? null,
  });

  logger.info('triagem.created', { userId: user.id, triagemId: triagem.id });
  return NextResponse.json({ triagem }, { status: 201 });
});
```

### 11.2 Database Architecture

#### Schema Design
Ver Seção 9. Definido em SQL puro (migrations) + mirrored em Drizzle (`lib/db/schema.ts`).

#### Data Access Layer

```typescript
// lib/db/queries/triagens.ts
import { db } from '@/lib/db/client';
import { triagens, itens } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Triagem } from '@/lib/types/models';

export async function createTriagem(input: {
  userId: string;
  textoBruto: string | null;
  imagemUrl: string | null;
}): Promise<Triagem> {
  const [row] = await db.insert(triagens).values({
    userId: input.userId,
    textoBruto: input.textoBruto,
    imagemUrl: input.imagemUrl,
    status: 'pendente',
  }).returning();
  return toTriagem(row);
}

export async function getTriagemById(id: string, userId: string): Promise<Triagem | null> {
  const [row] = await db.select().from(triagens)
    .where(and(eq(triagens.id, id), eq(triagens.userId, userId)));
  return row ? toTriagem(row) : null;
}

export async function listTriagensByUser(userId: string, opts: {
  limit?: number; cursor?: string;
}): Promise<Triagem[]> {
  const limit = opts.limit ?? 20;
  const rows = await db.select().from(triagens)
    .where(eq(triagens.userId, userId))
    .orderBy(desc(triagens.createdAt))
    .limit(limit);
  return rows.map(toTriagem);
}

function toTriagem(row: typeof triagens.$inferSelect): Triagem {
  return {
    id: row.id,
    userId: row.userId,
    textoBruto: row.textoBruto,
    imagemUrl: row.imagemUrl,
    status: row.status,
    tokensInput: row.tokensInput,
    tokensOutput: row.tokensOutput,
    custoEstimadoUsd: Number(row.custoEstimadoUsd),
    modeloUsado: row.modeloUsado,
    createdAt: row.createdAt.toISOString(),
    classifiedAt: row.classifiedAt?.toISOString() ?? null,
  };
}
```

### 11.3 Authentication and Authorization

#### Auth Flow

```mermaid
sequenceDiagram
    actor U as Usuário
    participant FE as Next.js Client
    participant SB as Supabase Auth
    participant MW as middleware.ts
    participant API as Route Handler

    U->>FE: Submete email/senha em /login
    FE->>SB: signInWithPassword
    SB-->>FE: Session (access + refresh tokens em cookies)
    FE->>FE: redirect /triador
    U->>FE: Navega para /triador
    FE->>MW: GET /triador (com cookies)
    MW->>SB: getUser() (valida JWT)
    SB-->>MW: { user } ou null
    alt user existe
        MW-->>FE: NextResponse.next()
        FE-->>U: Renderiza /triador
    else user null
        MW-->>FE: redirect /login
    end
    Note over U,API: Requisições à API levam cookies automaticamente
    U->>FE: Clica "Triar"
    FE->>API: POST /api/triagens
    API->>SB: requireUser() — getUser()
    SB-->>API: { user }
    API->>API: processa request
```

#### Middleware/Guards

```typescript
// lib/auth/server.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ApiError } from '@/lib/api/error-handler';

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function getServerSession() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getServerSession();
  if (!user) {
    throw new ApiError('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.', 401);
  }
  return user;
}
```

---

## 12. Unified Project Structure

```text
Triador-AI/
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Lint, typecheck, test, build
│       └── e2e.yml                     # Playwright em PRs
├── .vscode/
│   ├── settings.json                   # Format on save, etc.
│   └── extensions.json                 # Recomendados
├── app/                                # Next.js App Router (FE + BE)
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (app)/
│   ├── api/
│   ├── layout.tsx
│   ├── globals.css
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                             # Shadcn primitives
│   ├── layout/
│   ├── triador/                        # Domain
│   └── shared/
├── lib/
│   ├── api/                            # API client (frontend)
│   │   ├── client.ts
│   │   ├── triagens.ts
│   │   └── error-handler.ts            # backend error handler
│   ├── auth/
│   │   └── server.ts
│   ├── db/
│   │   ├── client.ts                   # Drizzle instance
│   │   ├── schema.ts                   # Drizzle schema (mirror das migrations)
│   │   └── queries/
│   │       ├── triagens.ts
│   │       ├── itens.ts
│   │       ├── feedback.ts
│   │       └── perfil.ts
│   ├── engine/                         # Coração do produto
│   │   ├── classificar.ts
│   │   ├── extrair-imagem.ts
│   │   ├── gerar-delegacao.ts
│   │   ├── prompts/
│   │   │   ├── triador-system.md       # System prompt principal
│   │   │   └── delegacao.md
│   │   └── claude.ts                   # Cliente Anthropic
│   ├── types/
│   │   └── models.ts                   # Tipos compartilhados
│   ├── validators/
│   │   └── schemas.ts                  # Zod schemas reutilizáveis
│   ├── observability/
│   │   └── logger.ts                   # Logger estruturado
│   └── utils/
│       ├── cn.ts                       # Tailwind merge
│       └── format.ts                   # Datas, moedas
├── stores/                             # Zustand
│   ├── board.ts
│   ├── upload.ts
│   └── user-settings.ts
├── supabase/
│   ├── migrations/                     # SQL migrations versionadas
│   │   ├── 20260601000000_init.sql
│   │   ├── 20260605000000_pgvector.sql
│   │   └── ...
│   └── config.toml
├── tests/
│   ├── unit/
│   │   ├── engine/
│   │   └── db/
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── captura-texto.spec.ts
│   │   ├── multi-tenant-isolation.spec.ts
│   │   └── fixtures/
│   └── setup.ts
├── docs/
│   ├── prd.md
│   ├── architecture.md                 # este documento
│   ├── security.md                     # auditoria RLS
│   └── stories/                        # criadas pelo @sm
├── scripts/
│   ├── seed-dev.ts                     # Seed data pra desenvolvimento
│   └── check-rls.ts                    # Validação automática de RLS
├── public/
│   ├── icons/                          # SVG premium (Phosphor + custom)
│   ├── og-image.png
│   └── favicon.ico
├── .env.example
├── .env.local                          # Git ignored
├── .gitignore
├── .nvmrc                              # Node 20 LTS
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
├── eslint.config.js
├── prettier.config.js
├── commitlint.config.js
├── vitest.config.ts
├── playwright.config.ts
├── README.md
└── CHANGELOG.md
```

---

## 13. Development Workflow

### 13.1 Local Development Setup

#### Prerequisites

```bash
# Node.js 20 LTS
node --version  # >= 20.x

# pnpm (preferido)
npm install -g pnpm
pnpm --version  # >= 9.x

# Supabase CLI (pra rodar DB local opcionalmente)
brew install supabase/tap/supabase  # ou: scoop install supabase
supabase --version

# Vercel CLI (opcional, pra preview local)
npm install -g vercel
```

#### Initial Setup

```bash
# 1. Clonar repositório
git clone <repo-url> Triador-AI
cd Triador-AI

# 2. Instalar dependências
pnpm install

# 3. Copiar env vars
cp .env.example .env.local
# Editar .env.local com as chaves do Supabase + Anthropic

# 4. Rodar migrations (no Supabase remoto ou local)
pnpm db:migrate

# 5. Seed de dados de desenvolvimento (opcional)
pnpm db:seed

# 6. Iniciar dev server
pnpm dev
# → http://localhost:3000
```

#### Development Commands

```bash
# Inicia tudo (Next.js dev server com Turbopack)
pnpm dev

# Type checking em watch mode
pnpm typecheck:watch

# Testes unitários (Vitest)
pnpm test
pnpm test:watch
pnpm test:coverage

# E2E (Playwright)
pnpm test:e2e
pnpm test:e2e:ui      # modo UI interativo

# Lint + Format
pnpm lint
pnpm lint:fix
pnpm format

# Migrations
pnpm db:migrate              # roda migrations pendentes
pnpm db:generate             # gera nova migration do diff Drizzle
pnpm db:push                 # push direto (apenas dev local)
pnpm db:studio               # abre Drizzle Studio

# Build de produção (sanity check local)
pnpm build
pnpm start
```

### 13.2 Environment Configuration

#### Required Environment Variables

```bash
# .env.local

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."        # server-only, NUNCA exponha

# --- Database (Drizzle) ---
DATABASE_URL="postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres"

# --- Anthropic Claude ---
ANTHROPIC_API_KEY="sk-ant-..."

# --- Stripe (Epic 5) ---
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID="price_..."

# --- App ---
NEXT_PUBLIC_APP_URL="http://localhost:3000"    # produção: https://triador.ai
NODE_ENV="development"

# --- Feature Flags ---
NEXT_PUBLIC_FEATURE_IMAGE_CAPTURE="false"      # liga Epic 4
NEXT_PUBLIC_FEATURE_BILLING="false"            # liga Epic 5

# --- Observability ---
SENTRY_DSN=""                                   # vazio no MVP
```

---

## 14. Deployment Architecture

### 14.1 Deployment Strategy

**Frontend + API (mesmo deploy):**
- **Plataforma:** Vercel (Hobby/Pro)
- **Build Command:** `pnpm build`
- **Output Directory:** `.next` (gerenciado pela Vercel)
- **CDN/Edge:** Vercel Edge Network global; assets estáticos servidos do CDN
- **Runtime:** Node.js 20 (Server Components, Route Handlers, Server Actions)

**Database:**
- **Plataforma:** Supabase Cloud (Free/Pro)
- **Backups:** automático diário (Pro tier)
- **Migrations:** rodadas via GitHub Action manual após merge na `main`

### 14.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Build (sanity check)
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  e2e:
    runs-on: ubuntu-latest
    needs: lint-and-test
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E against Vercel preview
        run: pnpm test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.preview.outputs.url }}
```

**Deploy:** Vercel detecta push em `main` (e PRs) automaticamente, sem workflow custom. Preview deployments em cada PR.

**Migrations:** rodadas manualmente via Supabase CLI ou Action separada (`db-migrate.yml`) com proteção por approval.

### 14.3 Environments

| Ambiente | Frontend URL | Backend URL | Propósito |
|----------|--------------|-------------|-----------|
| Development | http://localhost:3000 | http://localhost:3000/api | Desenvolvimento local |
| Preview | https://triador-{pr}.vercel.app | mesmo | PR review |
| Production | https://triador.ai | https://triador.ai/api | Live |

---

## 15. Security and Performance

### 15.1 Security Requirements

**Frontend Security:**
- **CSP Headers:** Next.js config com `Content-Security-Policy` restritivo (script-src self + Vercel + Sentry; img-src self + Supabase + data:). Headers via `next.config.ts`.
- **XSS Prevention:** React escapa por padrão; banir `dangerouslySetInnerHTML` via ESLint rule. Justificativas e textos da IA renderizados como texto puro.
- **Secure Storage:** Sessões em cookies HTTP-only (Supabase faz isso por padrão). Nada de auth em `localStorage`.
- **HTTPS only:** Vercel força HTTPS em produção.

**Backend Security:**
- **Input Validation:** Zod em 100% dos endpoints. Rejeitar payloads não conformes com 400 + detalhes do erro.
- **Rate Limiting:** Vercel Edge middleware com `@upstash/ratelimit` em rotas pesadas (`/api/triagens`, `/api/triagens/[id]/classificar`): 20 req/min por usuário no MVP. Free tier do Upstash é suficiente.
- **CORS:** API só aceita `origin` igual ao próprio domínio. Webhook do Stripe é exceção (valida assinatura).
- **SQL Injection:** Drizzle parametriza queries — impossível por design. Banir SQL raw fora de migrations.
- **Secrets Management:** Apenas Vercel env vars (não comitar `.env.local`). `SUPABASE_SERVICE_ROLE_KEY` nunca exposta no client.

**Authentication Security:**
- **Token Storage:** Cookies HTTP-only + Secure + SameSite=Lax (padrão Supabase SSR)
- **Session Management:** Refresh automático via Supabase SSR helpers. Logout limpa cookies.
- **Password Policy:** Mínimo 10 caracteres (configurar em Supabase Auth). Recomendação: senha por magic link como default.
- **Rate Limit no Auth:** Supabase faz nativo (5 tentativas/15min).
- **MFA:** opcional no Pro (Epic 5+).

**Data Security:**
- **RLS em 100% das tabelas:** validado por testes automatizados (script `scripts/check-rls.ts` roda no CI)
- **Pen test básico:** rodar `nuclei` contra preview deploy antes do lançamento (Epic 5)
- **LGPD:** página `/privacidade` + exportação de dados do usuário (Epic 5)

### 15.2 Performance Optimization

**Frontend Performance:**
- **Bundle Size Target:** First Load JS < 200 KB (página `/triador`)
- **Loading Strategy:**
  - Server Components reduzem JS shipped
  - `loading.tsx` por rota com skeleton
  - Lazy-load `dnd-kit` apenas no board (não na captura)
  - Imagens via `next/image` com lazy loading e formatos modernos (AVIF/WebP)
- **Caching Strategy:**
  - Página de captura: sem cache (sempre fresh)
  - Histórico: ISR com revalidate 60s
  - Static assets: max-age=31536000 (1 ano)

**Backend Performance:**
- **Response Time Target:** p95 < 500ms para CRUD; classificação < 8s
- **Database Optimization:**
  - Índices em todas FKs e colunas filtradas (já no schema)
  - `EXPLAIN ANALYZE` em queries novas durante desenvolvimento
  - Connection pooling via Supabase (PgBouncer)
- **Caching Strategy:**
  - Prompt caching no Claude (system prompt = constante = cache hit ~100%)
  - Vercel KV (opcional, Story 3.2): cache de exemplos few-shot por usuário, TTL 5min
  - Sem cache em rotas que leem/escrevem dados do usuário

**Custo:**
- Meta: < US$ 0.05 por triagem no Sonnet 4.6 com prompt caching
- Monitor: dashboard `/admin` mostra custo médio diário
- Alerta: > US$ 0.10/triagem média por 24h → log warning

---

## 16. Testing Strategy

### 16.1 Testing Pyramid

```text
            E2E Tests (Playwright)
              ~10 fluxos críticos
           /                       \
       Integration Tests (Vitest)
       ~40 testes de API + DB
      /                             \
  Frontend Unit       Backend Unit
  Components, hooks    Engine, queries, utils
       ~80                ~80
```

### 16.2 Test Organization

#### Frontend Tests

```text
tests/unit/
├── components/
│   ├── ItemCard.test.tsx
│   ├── BucketColumn.test.tsx
│   ├── CaptureBox.test.tsx
│   └── ...
├── stores/
│   ├── board.test.ts
│   └── upload.test.ts
└── hooks/
    └── (se houver)
```

#### Backend Tests

```text
tests/unit/
├── engine/
│   ├── classificar.test.ts             # mocka Claude API
│   ├── extrair-imagem.test.ts
│   ├── prompts.test.ts                 # snapshots dos prompts
│   └── fixtures/
│       ├── exemplos-classificacao.json
│       └── imagens/
├── db/
│   ├── queries-triagens.test.ts        # roda contra DB local de teste
│   └── queries-itens.test.ts
└── validators/
    └── schemas.test.ts
```

#### E2E Tests

```text
tests/e2e/
├── auth.spec.ts                        # login, signup, logout
├── captura-texto.spec.ts               # fluxo principal
├── classificacao.spec.ts               # mocka Claude
├── drag-and-drop.spec.ts
├── multi-tenant-isolation.spec.ts      # dois usuários, dados isolados
├── exportacao.spec.ts
├── billing.spec.ts                     # Epic 5
├── fixtures/
│   ├── users.ts                        # criação programática de usuários teste
│   └── triagens.ts
└── helpers/
    └── auth.ts
```

### 16.3 Test Examples

#### Frontend Component Test

```typescript
// tests/unit/components/ItemCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ItemCard } from '@/components/triador/ItemCard';
import { Item } from '@/lib/types/models';

const itemMock: Item = {
  id: '1',
  triagemId: 't1',
  texto: 'Ligar pro Marcos sobre proposta',
  bucket: 'prioridade',
  justificativa: 'Tem prazo curto e impacto direto em receita',
  posicao: 0,
  concluido: false,
  concluidoAt: null,
  gatilhoRetorno: null,
  delegacao: null,
  createdAt: new Date().toISOString(),
};

describe('ItemCard', () => {
  it('renderiza texto e justificativa', () => {
    render(<ItemCard item={itemMock} />);
    expect(screen.getByText('Ligar pro Marcos sobre proposta')).toBeInTheDocument();
    expect(screen.getByText(/prazo curto/i)).toBeInTheDocument();
  });

  it('mostra checkmark quando concluído', () => {
    render(<ItemCard item={{ ...itemMock, concluido: true }} />);
    expect(screen.getByRole('img', { name: /concluído/i })).toBeInTheDocument();
  });
});
```

#### Backend API Test

```typescript
// tests/unit/engine/classificar.test.ts
import { classificarTexto } from '@/lib/engine/classificar';
import { vi } from 'vitest';

vi.mock('@/lib/engine/claude', () => ({
  claudeClient: {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'classificar_itens',
          input: {
            itens: [
              { texto: 'Ligar pro Marcos', bucket: 'prioridade', justificativa: 'Cliente esperando' },
              { texto: 'Ler newsletter', bucket: 'descarta', justificativa: 'Sem retorno claro' },
            ],
          },
        }],
        usage: { input_tokens: 800, output_tokens: 120 },
      }),
    },
  },
}));

describe('classificarTexto', () => {
  it('retorna itens classificados em buckets válidos', async () => {
    const resultado = await classificarTexto({
      texto: 'Ligar pro Marcos. Ler newsletter.',
    });

    expect(resultado.itens).toHaveLength(2);
    expect(resultado.itens[0].bucket).toBe('prioridade');
    expect(resultado.itens[1].bucket).toBe('descarta');
    expect(resultado.tokensInput).toBe(800);
  });

  it('lança ClassificationError após 3 tentativas falhas', async () => {
    // ... teste de retry
  });
});
```

#### E2E Test

```typescript
// tests/e2e/multi-tenant-isolation.spec.ts
import { test, expect } from '@playwright/test';
import { criarUsuarioTeste, login } from './helpers/auth';

test('usuário B nunca vê triagens do usuário A', async ({ browser }) => {
  // Setup: 2 usuários
  const userA = await criarUsuarioTeste();
  const userB = await criarUsuarioTeste();

  // User A cria uma triagem
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA, userA);
  await pageA.goto('/triador');
  await pageA.getByPlaceholder(/despeje tudo/i).fill('Segredo do usuário A');
  await pageA.getByRole('button', { name: /triar/i }).click();
  await pageA.waitForURL(/\/triador\/[a-f0-9-]+/);
  const triagemIdA = pageA.url().split('/').pop()!;
  await ctxA.close();

  // User B tenta acessar a URL direto
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB, userB);
  await pageB.goto(`/triador/${triagemIdA}`);
  await expect(pageB.locator('text=404')).toBeVisible(); // ou redirect

  // User B verifica histórico vazio
  await pageB.goto('/historico');
  await expect(pageB.locator('text=Segredo do usuário A')).not.toBeVisible();

  await ctxB.close();
});
```

---

## 17. Coding Standards

### 17.1 Critical Fullstack Rules

- **Type Sharing:** Tipos compartilhados ficam em `lib/types/`. Nunca duplique tipos entre FE e BE.
- **API Calls:** No frontend, NUNCA chame `fetch` diretamente — sempre via `lib/api/` services. Garante tratamento de erro consistente.
- **Environment Variables:** Acesse apenas via `process.env.X` em arquivos `lib/config/` ou no topo de Server Components. Validar com Zod no boot: `lib/config/env.ts` falha cedo se var ausente.
- **Error Handling:** Toda Route Handler usa `withErrorHandler` wrapper. Toda Server Action retorna `Result<T, AppError>` (nunca lança pra UI).
- **State Updates:** Nunca mute estado direto no Zustand — use setters. Imer middleware se ficar verboso.
- **DB Access:** APENAS via `lib/db/queries/`. Banir imports de `@/lib/db/client` fora dessa pasta via ESLint rule.
- **RLS Confidence:** Server-side, NUNCA filtre por `user_id` em queries — confie no RLS. Filtros explícitos são redundância perigosa (cria falsa sensação de segurança).
- **Optimistic Updates:** Toda mutação que afeta UI deve ser otimista + rollback.
- **Server Components first:** Default é Server Component. Só vire `'use client'` quando precisar de hooks/interatividade.
- **Ícones:** APENAS Phosphor Icons (ou SVGs custom). **PROIBIDO usar Lucide** (regra do produto).
- **Sem comentários óbvios:** código auto-documentado via nomes claros. Comentários só pra _porquê_ não-óbvio.
- **Conventional Commits:** todo commit segue `tipo(escopo): mensagem [Story X.Y]`. Validado por commitlint.
- **Sem `any`:** TypeScript estrito. Use `unknown` + narrowing se tipo desconhecido.

### 17.2 Naming Conventions

| Elemento | Frontend | Backend | Exemplo |
|----------|----------|---------|---------|
| Componentes React | PascalCase | — | `ItemCard.tsx` |
| Hooks | camelCase com `use` | — | `useTriagem.ts` |
| Stores Zustand | camelCase com `use...Store` | — | `useBoardStore` |
| Server Components (file) | PascalCase | — | `Page.tsx`, `Layout.tsx` |
| API Routes (path) | — | kebab-case | `/api/triagens`, `/api/gerar-mensagem-delegacao` |
| Tabelas DB | — | snake_case singular ou plural consistente | `triagens`, `feedback_loop`, `profiles` |
| Colunas DB | — | snake_case | `user_id`, `created_at` |
| Variáveis TS | camelCase | camelCase | `triagemId`, `userIdAtual` |
| Constantes | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | `MAX_TEXTO_BRUTO`, `LIMITE_FREE_TRIAGENS` |
| Tipos/Interfaces | PascalCase | PascalCase | `Triagem`, `ItemClassificado` |
| Enums TS | PascalCase | — | `Bucket`, `StatusTriagem` (tipos union são preferíveis a enums) |
| Arquivos `lib/` | kebab-case | kebab-case | `error-handler.ts`, `claude.ts` |

---

## 18. Error Handling Strategy

### 18.1 Error Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as Route Handler
    participant Q as Query/Engine
    participant Sentry as Sentry (Epic 5)

    FE->>API: Request
    API->>Q: chama serviço
    alt sucesso
        Q-->>API: data
        API-->>FE: 200 { data }
    else erro previsível (ApiError)
        Q-->>API: throw ApiError
        API->>API: withErrorHandler captura
        API->>API: log warn (info do usuário)
        API-->>FE: 4xx { error: {code, message} }
        FE->>FE: toast.error(message)
    else erro inesperado
        Q-->>API: throw Error
        API->>API: withErrorHandler captura
        API->>Sentry: capture exception
        API->>API: log error (sem PII)
        API-->>FE: 500 { error: {code: 'INTERNAL', message: 'Algo deu errado'} }
        FE->>FE: toast.error + botão "Tentar novamente"
    end
```

### 18.2 Error Response Format

```typescript
// lib/api/error-types.ts
export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId: string;
  };
}

// Códigos padronizados
export const ERROR_CODES = {
  // 401
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  // 403
  FORBIDDEN: 'FORBIDDEN',
  // 404
  NOT_FOUND: 'NOT_FOUND',
  // 402
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 500
  INTERNAL: 'INTERNAL',
  // 503
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_TIMEOUT: 'AI_TIMEOUT',
} as const;
```

### 18.3 Frontend Error Handling

```typescript
// components/triador/CaptureBox.tsx (excerpt)
'use client';

import { triagensApi } from '@/lib/api/triagens';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function CaptureBox() {
  const router = useRouter();

  const handleTriar = async (texto: string) => {
    try {
      const { triagem } = await triagensApi.criar({ textoBruto: texto });
      router.push(`/triador/${triagem.id}`);
      await triagensApi.classificar(triagem.id);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PLAN_LIMIT_EXCEEDED') {
          toast.error('Limite mensal do plano Free atingido', {
            action: { label: 'Upgrade', onClick: () => router.push('/configuracoes/conta') },
          });
        } else if (err.code === 'AI_UNAVAILABLE') {
          toast.error('IA indisponível agora. Tente em alguns instantes.');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Algo deu errado. Tente novamente.');
      }
    }
  };

  // ...
}
```

### 18.4 Backend Error Handling

```typescript
// lib/api/error-handler.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/observability/logger';
import { randomUUID } from 'crypto';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function withErrorHandler(
  handler: (req: Request, ctx?: any) => Promise<Response>
) {
  return async (req: Request, ctx?: any): Promise<Response> => {
    const requestId = randomUUID();
    try {
      return await handler(req, ctx);
    } catch (err) {
      const timestamp = new Date().toISOString();

      if (err instanceof ApiError) {
        logger.warn('api.error', { code: err.code, message: err.message, requestId, status: err.status });
        return NextResponse.json({
          error: { code: err.code, message: err.message, details: err.details, timestamp, requestId }
        }, { status: err.status });
      }

      if (err instanceof ZodError) {
        logger.warn('api.validation_error', { errors: err.errors, requestId });
        return NextResponse.json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Payload inválido',
            details: { errors: err.errors },
            timestamp,
            requestId,
          },
        }, { status: 400 });
      }

      // Erro inesperado
      logger.error('api.internal_error', { error: err, requestId });
      // TODO Epic 5: Sentry.captureException(err)

      return NextResponse.json({
        error: { code: 'INTERNAL', message: 'Algo deu errado. Tente novamente.', timestamp, requestId },
      }, { status: 500 });
    }
  };
}
```

---

## 19. Monitoring and Observability

### 19.1 Monitoring Stack

- **Frontend Monitoring:** Vercel Analytics (page views, devices, geos) + Vercel Speed Insights (Core Web Vitals)
- **Backend Monitoring:** Vercel Logs (function logs) + Supabase Logs (DB queries, auth events)
- **Error Tracking:** **MVP:** apenas logs estruturados via Vercel Logs. **Epic 5:** Sentry (browser + serverless)
- **Performance Monitoring:** Vercel Speed Insights (FE) + custom timing logs nas Route Handlers
- **AI Cost Monitoring:** dashboard custom em `/admin` lendo `triagens.custo_estimado_usd`

### 19.2 Logger estruturado

```typescript
// lib/observability/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };
  // Em produção, Vercel já estrutura. Em dev, pretty-print.
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry));
  } else {
    console.log(`[${level.toUpperCase()}] ${event}`, context);
  }
}

export const logger = {
  debug: (event: string, context?: LogContext) => log('debug', event, context),
  info: (event: string, context?: LogContext) => log('info', event, context),
  warn: (event: string, context?: LogContext) => log('warn', event, context),
  error: (event: string, context?: LogContext) => log('error', event, context),
};
```

### 19.3 Key Metrics

**Frontend Metrics (Vercel Speed Insights):**
- Core Web Vitals: LCP, FID, CLS, INP
- JavaScript errors (Sentry quando ativar)
- API response times (lado cliente)

**Backend Metrics:**
- Request rate por endpoint
- Error rate por endpoint (% de 4xx/5xx)
- p50/p95/p99 response time
- Tokens consumidos (Claude) por dia/usuário
- Custo total (Claude) por dia
- Query lenta (> 200ms) — Supabase logs

**Métricas de produto:**
- Triagens criadas/dia
- Itens classificados/dia
- Taxa de correção manual (% de itens movidos vs total)
- Tempo médio entre captura e primeira ação em item de prioridade
- Conversão Free → Pro (Epic 5)

**Alertas mínimos (Epic 5+):**
- Error rate > 2% por 5min → email
- p95 latência classificação > 15s → email
- Custo Claude/dia > limite → email

---

## 20. Checklist Results Report

> *Pendente — rodar `architect-checklist` antes de finalizar.*

**Próxima ação:** executar `*execute-checklist architect-checklist` e popular esta seção com os resultados.

---

## Apêndice A — Decisões Críticas (ADRs Light)

| # | Decisão | Alternativa | Por que escolhemos |
|---|---------|-------------|--------------------|
| 1 | Next.js fullstack | Backend separado (Hono/Fastify) | Yuri iniciante; menos coisa pra entender; mesmo runtime |
| 2 | REST com Zod | tRPC | Mais simples pra debugar e ensinar; tRPC pode entrar no Epic 5 se útil |
| 3 | Drizzle ORM | Prisma | Mais leve, queries explícitas, melhor com edge runtime |
| 4 | Supabase | AWS Cognito + RDS + S3 | All-in-one; RLS poderoso; free tier generoso |
| 5 | Vercel | Railway, Netlify | Melhor DX pra Next.js; preview deploys; analytics nativo |
| 6 | Phosphor Icons | Lucide | Regra do usuário (preferência por SVG premium) |
| 7 | Sem React Query no MVP | Adotar desde o início | Server Components + revalidatePath cobrem 90%; adicionar se houver dor |
| 8 | pgvector vs Pinecone | Serviço dedicado | Tudo no Postgres; sem custo extra; performance suficiente |
| 9 | Sem Turborepo no MVP | Turborepo desde o start | Sem segundo app; adiciona quando houver dor real |
| 10 | Vitest sobre Jest | Jest | Mais rápido, ESM nativo, mesma API |

---

## Próximos Passos

1. **Validar este documento com o Yuri** — ele revisa, ajusta o que não fez sentido
2. **Rodar `*execute-checklist architect-checklist`** — completar seção 20
3. **Handoff pro `@ux-design-expert` (Uma)** — gerar design system + wireframes baseado nas seções 3 e 10
4. **Handoff pro `@sm` (River)** — quebrar Epic 1 (Fundação & MVP) em stories executáveis pro `@dev`
5. **Setup inicial do projeto** — Story 1.1 pode começar tão logo Yuri aprovar o stack

— Aria, arquitetando o futuro 🏗️

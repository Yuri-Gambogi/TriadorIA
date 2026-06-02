# Triador AI — Product Requirements Document (PRD)

**Versão:** 0.1 (YOLO Draft)
**Autor:** Morgan (PM) com Yuri Gambogi
**Data:** 2026-06-01
**Status:** Draft — aguardando revisão do usuário

---

## 1. Goals and Background Context

### 1.1 Goals

- Eliminar o caos cognitivo do empreendedor: jogar tudo que está na cabeça (ou na mesa) e receber clareza acionável em segundos
- Substituir to-do lists tradicionais por uma engine de **decisão estratégica** (não só de lembrete)
- Classificar entradas em 5 buckets acionáveis: **Prioridade, ROI Alto, Delega, Depois, Descarta**
- Aprender o critério pessoal do usuário com o uso, tornando a triagem cada vez mais sua
- Suportar captura via texto **e foto/print** (mesa, tela, post-it)
- Servir como ferramenta pessoal do Yuri no MVP, evoluindo para produto SaaS vendável para empreendedores
- Reduzir em pelo menos 50% o tempo gasto decidindo "o que faço agora?"

### 1.2 Background Context

Empreendedores em fase de tração vivem afogados em demandas heterogêneas: tarefas operacionais, oportunidades de receita, ideias soltas, mensagens, papéis em cima da mesa. As ferramentas atuais (Todoist, Notion, Trello, Things) **exigem que o próprio usuário decida prioridade, urgência e ROI antes de cadastrar**. Isso transfere o esforço cognitivo mais difícil — a decisão — para o humano.

O Triador AI inverte esse modelo: o usuário despeja o caos bruto (texto solto, foto da mesa, transcrição mental), e a IA classifica usando uma engine baseada em três perguntas-gatilho (impacto na receita, custo de ignorar, possibilidade de delegação). O usuário valida ou ajusta, e o sistema aprende seu critério ao longo do tempo. O resultado é um produtividade-as-a-service voltado para quem tem alto volume de inputs e baixa tolerância a overhead de organização.

### 1.3 Change Log

| Data       | Versão | Descrição                                              | Autor  |
|------------|--------|--------------------------------------------------------|--------|
| 2026-06-01 | 0.1    | Criação inicial do PRD em modo YOLO                    | Morgan |

---

## 2. Requirements

### 2.1 Functional (FR)

- **FR1:** O sistema deve aceitar entrada de texto livre (lista, parágrafo solto, frases desconexas) através de uma caixa de texto principal
- **FR2:** O sistema deve aceitar upload de imagem (foto ou print) e extrair os itens textuais via OCR + análise visual (Claude vision)
- **FR3:** A engine de classificação deve categorizar cada item de entrada em exatamente um dos 5 buckets: `PRIORIDADE`, `ROI_ALTO`, `DELEGA`, `DEPOIS`, `DESCARTA`
- **FR4:** Cada item classificado deve exibir uma justificativa curta (1-2 linhas) explicando por que foi parar naquele bucket
- **FR5:** O usuário deve poder mover manualmente um item entre buckets via drag-and-drop, e essa ação deve ser registrada como sinal de aprendizado
- **FR6:** O sistema deve permitir ao usuário definir critérios pessoais editáveis (ex: "ROI alto = receita potencial acima de R$ 5.000")
- **FR7:** O sistema deve manter histórico de todas as triagens realizadas, navegável por data
- **FR8:** O sistema deve permitir marcar itens como concluídos, mantendo-os no histórico mas removendo-os da visualização ativa
- **FR9:** O sistema deve oferecer login via email/senha e Google OAuth
- **FR10:** Para itens em `DEPOIS`, o sistema deve permitir definir um gatilho de retorno (data específica ou condição textual)
- **FR11:** Para itens em `DELEGA`, o sistema deve permitir registrar o destinatário e gerar um texto pronto para envio (email ou WhatsApp)
- **FR12:** A engine deve detectar itens potencialmente duplicados (escritos de formas diferentes) e alertar o usuário
- **FR13:** O sistema deve oferecer uma visão consolidada do dia: "o que você precisa fazer AGORA" (apenas bucket PRIORIDADE + ROI_ALTO)
- **FR14:** O usuário deve poder exportar uma triagem como texto markdown ou PDF
- **FR15:** O sistema deve permitir re-triar uma entrada (reprocessar com critérios atualizados)

### 2.2 Non-Functional (NFR)

- **NFR1:** O tempo de classificação de uma entrada de até 20 itens não deve exceder 8 segundos (p95)
- **NFR2:** A interface web deve ser responsiva, funcionando em desktop (primário) e mobile (secundário)
- **NFR3:** O custo médio por triagem (chamada à Claude API) deve ficar abaixo de US$ 0.05 no MVP
- **NFR4:** O sistema deve usar prompt caching da Claude API para reduzir custo de chamadas recorrentes
- **NFR5:** Dados do usuário devem ser isolados por linha (Row-Level Security no Supabase) desde o início, mesmo com 1 usuário, para preparar multi-tenant
- **NFR6:** Hospedagem deve usar o tier gratuito de Vercel + Supabase no MVP; custos só surgem com adoção
- **NFR7:** Disponibilidade alvo: 99% no MVP (não é missão crítica)
- **NFR8:** O sistema deve manter logs estruturados de cada classificação para análise posterior do comportamento da engine
- **NFR9:** Acessibilidade mínima WCAG AA nas telas principais
- **NFR10:** O código deve ser escrito em TypeScript com type checking estrito (sem `any` permissivo)
- **NFR11:** Cobertura de testes: mínimo 60% no MVP, focando na engine de classificação e fluxos críticos de UI

---

## 3. User Interface Design Goals

### 3.1 Overall UX Vision

Triador AI é uma **ferramenta de descarrego mental**. A experiência primária é zen: uma caixa de texto grande, vazia, convidativa — você joga tudo lá. Em segundos, o caos vira ordem visual em 5 colunas coloridas. Nada de configuração antes de usar, nada de friction. A regra é: **se uma decisão pode ser feita pela IA, ela é feita pela IA**. O usuário só intervém quando quer ajustar.

Inspirações: simplicidade do Bear, clareza de Linear, estética minimalista do Things 3.

### 3.2 Key Interaction Paradigms

- **Despejar > Triar > Agir** é o ciclo principal (3 passos, nunca mais que isso)
- **Drag-and-drop** entre buckets é o gesto primário de correção
- **Atalhos de teclado** para usuários power (Cmd+Enter pra triar, 1-5 pra mover entre buckets)
- **Justificativa sempre visível** ao lado do item (sem clique extra) — transparência da IA
- **Captura por foto** abre câmera/upload com 1 toque; processamento mostra spinner com mensagem do que a IA está fazendo
- **Feedback loop silencioso**: quando o usuário move algo manualmente, sistema aprende sem notificar

### 3.3 Core Screens and Views

- **Tela de Captura** — caixa de texto grande + botão de upload de imagem + botão "Triar"
- **Tela de Triagem (Board)** — 5 colunas kanban (Prioridade, ROI Alto, Delega, Depois, Descarta) com itens + justificativas
- **Visão do Dia** — modo simplificado mostrando só Prioridade + ROI Alto, otimizado pra mobile
- **Tela de Histórico** — calendário/lista de triagens passadas
- **Tela de Configurações** — critérios pessoais editáveis, integrações futuras
- **Tela de Login/Cadastro** — minimalista, Google OAuth em destaque

### 3.4 Accessibility

**WCAG AA** — contraste mínimo 4.5:1, navegação completa por teclado, ARIA labels nos botões críticos, suporte a screen reader nas listas de itens.

### 3.5 Branding

Estilo **minimalista escandinavo**: muito espaço em branco, tipografia limpa (Inter ou similar), paleta restrita.

**Cores dos 5 buckets:**
- 🔥 Prioridade: vermelho/laranja queimado (`#E74C3C`)
- 💰 ROI Alto: verde dinheiro (`#27AE60`)
- 🤝 Delega: azul (`#3498DB`)
- ⏸️ Depois: cinza-azulado (`#7F8C8D`)
- 🗑️ Descarta: cinza claro (`#BDC3C7`)

**Ícones:** sempre SVG premium (Phosphor Icons, Heroicons ou custom). Nunca Lucide.

### 3.6 Target Device and Platforms

**Web Responsive** — desktop como primário (uso de produtividade focado), mobile (PWA) como secundário para captura rápida em movimento. Sem app nativo no MVP.

---

## 4. Technical Assumptions

### 4.1 Repository Structure

**Monorepo** — toda a aplicação (frontend + lógica de servidor + edge functions) em um único repositório Git. Usar **Turborepo** se houver necessidade de separar pacotes, mas começar simples com Next.js fullstack.

### 4.2 Service Architecture

**Serverless dentro de Monolith Next.js** — Next.js App Router com:
- Rotas de UI no `app/`
- API routes em `app/api/` para chamadas à Claude API
- Edge functions para classificações rápidas (baixa latência)
- Supabase como BaaS (banco PostgreSQL + Auth + Storage para imagens)

Sem necessidade de microservices no MVP. Quando o produto crescer e a engine de classificação ficar pesada, pode-se extrair para serviço separado.

### 4.3 Testing Requirements

**Unit + Integration** — pirâmide parcial:
- Unit tests (Vitest) para lógica pura da engine (prompts, parsers, validators)
- Integration tests para fluxos de API (mock da Claude API)
- E2E mínimo (Playwright) para fluxo crítico: captura → triagem → exibição
- Sem testes manuais formalizados no MVP (Yuri é o tester)

### 4.4 Additional Technical Assumptions and Requests

- **Linguagem:** TypeScript estrito em todo o stack
- **Frontend Framework:** Next.js 15+ (App Router) com React 19
- **Styling:** Tailwind CSS 4 + Shadcn/ui para componentes base
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage + Row-Level Security)
- **IA Provider:** Claude API (claude-sonnet-4-6 para classificação, claude-opus-4-7 para casos complexos; usar prompt caching agressivamente)
- **OCR/Visão:** Claude vision (multimodal) — sem dependência extra de Tesseract ou Google Vision no MVP
- **Hospedagem:** Vercel (frontend + serverless) + Supabase (DB)
- **Auth:** Supabase Auth com providers Email/Senha + Google OAuth
- **Observabilidade:** Vercel Analytics + Supabase logs (suficiente no MVP). Adicionar Sentry quando houver usuários externos
- **State Management:** Zustand (leve, simples) para estado client. React Server Components para dados do servidor
- **Forms:** React Hook Form + Zod para validação
- **Drag-and-drop:** dnd-kit (acessível, moderno)
- **Billing (Epic 5):** Stripe Checkout + Customer Portal
- **CI/CD:** GitHub Actions com lint + typecheck + testes obrigatórios antes de merge
- **Versionamento:** Conventional Commits + Changesets

---

## 5. Epic List

Roadmap em **5 épicos sequenciais**, cada um entregando valor utilizável end-to-end:

- **Epic 1: Fundação & MVP de Captura por Texto** — Setup completo do projeto, autenticação básica, tela de captura e persistência. Entrega: Yuri consegue logar, jogar texto, e ver salvo.
- **Epic 2: Engine de Triagem 5-Buckets** — Integração Claude API, classificação automática, board kanban com 5 colunas, ajuste manual via drag-and-drop. Entrega: o produto faz o que promete pra 1 usuário.
- **Epic 3: Aprendizado & Refinamento Pessoal** — Critérios pessoais editáveis, feedback loop, histórico navegável, detecção de duplicatas, exportação. Entrega: triagem fica cada vez mais sua.
- **Epic 4: Captura por Foto/Print (Visão Computacional)** — Upload de imagem, OCR via Claude vision, classificação dos itens extraídos. Entrega: tira foto da mesa e funciona.
- **Epic 5: Multi-usuário & Lançamento Público (Onda 3)** — Cadastro público, onboarding, isolamento multi-tenant, billing via Stripe, landing page. Entrega: produto pode ser vendido.

---

## 6. Epic Details

### Epic 1: Fundação & MVP de Captura por Texto

**Objetivo Expandido:** Estabelecer toda a infraestrutura técnica do projeto (repositório, deploy, banco de dados, autenticação) e entregar uma funcionalidade mínima end-to-end: usuário loga, abre a tela de captura, digita texto, e o texto fica salvo no banco. Mesmo sem classificação ainda, este épico prova que o stack está funcionando e entrega o primeiro pedaço usável.

#### Story 1.1 Setup inicial do projeto e deploy

Como **desenvolvedor**,
quero **um projeto Next.js inicializado, conectado ao GitHub e com deploy automático no Vercel**,
para que **toda alteração futura seja publicada automaticamente em produção**.

**Acceptance Criteria:**
1. Repositório Git inicializado em `Triador-AI/` com `.gitignore` apropriado para Next.js
2. Projeto Next.js 15 (App Router) com TypeScript estrito configurado
3. Tailwind CSS 4 + Shadcn/ui instalados e funcionais
4. Projeto Vercel conectado ao repositório com deploy automático na branch `main`
5. Página inicial `/` exibe "Triador AI — em construção" e está acessível em URL pública do Vercel
6. README com instruções básicas de setup local

#### Story 1.2 Setup do Supabase e schema inicial

Como **desenvolvedor**,
quero **o Supabase configurado com tabelas iniciais e Row-Level Security ativo**,
para que **dados de usuários fiquem isolados desde o primeiro dia**.

**Acceptance Criteria:**
1. Projeto Supabase criado e variáveis de ambiente conectadas ao Next.js
2. Tabela `users` (gerenciada pelo Supabase Auth)
3. Tabela `triagens` (id, user_id, created_at, status)
4. Tabela `itens` (id, triagem_id, texto_original, bucket, justificativa, posicao, created_at)
5. Row-Level Security ativo em `triagens` e `itens`: usuário só vê próprios dados
6. Migrations versionadas em `/supabase/migrations/`
7. Cliente Supabase tipado (gerado via `supabase gen types`)

#### Story 1.3 Autenticação com Email e Google

Como **usuário**,
quero **fazer login com email/senha ou conta Google**,
para que **eu acesse meu espaço pessoal de triagens**.

**Acceptance Criteria:**
1. Tela `/login` com formulário email/senha + botão "Entrar com Google"
2. Tela `/cadastro` com formulário equivalente
3. Após login, usuário é redirecionado para `/triador`
4. Sessão persiste entre reloads (cookie do Supabase)
5. Botão "Sair" disponível no header de qualquer página autenticada
6. Rotas autenticadas redirecionam para `/login` se não houver sessão
7. Mensagens de erro claras (email inválido, senha curta, etc.)

#### Story 1.4 Tela de captura por texto

Como **usuário autenticado**,
quero **uma tela principal com uma caixa de texto grande onde despejo o que está na cabeça**,
para que **eu registre o caos sem fricção**.

**Acceptance Criteria:**
1. Rota `/triador` exibe uma caixa de texto (textarea) ocupando ~60% da tela
2. Placeholder convidativo: "Despeje tudo. Eu organizo depois."
3. Contador de caracteres discreto no canto
4. Botão "Triar" abaixo da caixa (desabilitado se vazio)
5. Atalho `Cmd/Ctrl + Enter` aciona o botão "Triar"
6. Ao clicar "Triar", uma nova `triagem` é criada no banco com `status='pendente'` e o texto bruto é salvo como `item` único
7. Após salvar, usuário é redirecionado para `/triador/[id]` (placeholder vazio por enquanto)
8. Tela funciona bem em desktop e mobile (responsiva)

#### Story 1.5 Tela de visualização da triagem salva

Como **usuário**,
quero **ver o conteúdo bruto que acabei de salvar**,
para que **eu confirme que está persistido (e me preparar para a classificação do Epic 2)**.

**Acceptance Criteria:**
1. Rota `/triador/[id]` carrega a triagem pelo ID e mostra o texto bruto salvo
2. Exibe data/hora de criação
3. Botão "Voltar" leva para `/triador`
4. Se o ID não existir ou não pertencer ao usuário, exibe 404
5. Loading state durante busca dos dados

---

### Epic 2: Engine de Triagem 5-Buckets

**Objetivo Expandido:** Implementar o coração do produto: a engine de classificação que pega o texto bruto e devolve itens categorizados em 5 buckets. Este épico transforma o protótipo do Epic 1 num produto que realmente faz o que promete — entregando o pitch principal: "joga o caos, recebe clareza".

#### Story 2.1 Integração com Claude API e prompt da engine

Como **desenvolvedor**,
quero **uma função de servidor que chama a Claude API com o prompt da engine 5-buckets**,
para que **o sistema possa classificar texto bruto em itens categorizados**.

**Acceptance Criteria:**
1. SDK Anthropic instalado e cliente configurado com API key via env var
2. Função `classificarTexto(textoBruto: string, criteriosUsuario?: Criterios)` em `lib/engine/`
3. Prompt do sistema documentado em `lib/engine/prompts/triador-system.md` definindo os 5 buckets e as 3 perguntas-gatilho
4. Saída estruturada usando tool use ou JSON mode: array de `{ texto, bucket, justificativa }`
5. Prompt caching ativo no system prompt (reduz custo em chamadas recorrentes)
6. Modelo padrão: `claude-sonnet-4-6`
7. Testes unitários cobrindo: parsing da resposta, tratamento de erros da API, validação dos buckets retornados
8. Logs estruturados de cada chamada (input, output, tokens, custo estimado)

#### Story 2.2 Endpoint de API para classificação

Como **desenvolvedor**,
quero **uma rota de API `/api/triagens/[id]/classificar`**,
para que **o frontend acione a classificação de uma triagem existente**.

**Acceptance Criteria:**
1. Rota POST `/api/triagens/[id]/classificar` autenticada
2. Verifica que a triagem pertence ao usuário logado
3. Lê o texto bruto da triagem, chama `classificarTexto()`
4. Persiste cada item retornado na tabela `itens` com bucket e justificativa
5. Remove o item bruto original (substituído pelos classificados)
6. Atualiza `status` da triagem para `classificada`
7. Retorna lista de itens classificados em JSON
8. Tratamento de erro: se Claude API falhar, mantém o item bruto e retorna 500 com mensagem clara

#### Story 2.3 Board Kanban com 5 colunas

Como **usuário**,
quero **ver minha triagem em 5 colunas coloridas com os itens classificados**,
para que **eu visualize de relance o que fazer com cada coisa**.

**Acceptance Criteria:**
1. Tela `/triador/[id]` exibe 5 colunas: Prioridade, ROI Alto, Delega, Depois, Descarta
2. Cores conforme branding (vermelho, verde, azul, cinza-azul, cinza claro) com ícones SVG premium
3. Cada item exibe: texto + justificativa em fonte menor abaixo
4. Colunas vazias mostram placeholder elegante ("Nada por aqui")
5. Header da página mostra data da triagem e botão "Voltar"
6. Layout funciona em desktop (5 colunas lado a lado) e mobile (colunas empilhadas com tabs ou scroll)
7. Loading skeleton enquanto carrega

#### Story 2.4 Acionamento automático de classificação após captura

Como **usuário**,
quero **que ao clicar "Triar" no Epic 1, a classificação aconteça automaticamente**,
para que **eu não precise apertar outro botão**.

**Acceptance Criteria:**
1. Ao clicar "Triar" em `/triador`, frontend chama POST `/api/triagens/[id]/classificar` em sequência ao salvar
2. Tela mostra loading com mensagem dinâmica ("Analisando...", "Classificando 12 itens...", "Quase lá...")
3. Após sucesso, redireciona para `/triador/[id]` que já mostra o board preenchido
4. Em caso de falha, mostra erro amigável com botão "Tentar de novo"

#### Story 2.5 Drag-and-drop entre buckets

Como **usuário**,
quero **arrastar um item de uma coluna pra outra**,
para que **eu corrija a classificação quando a IA errar**.

**Acceptance Criteria:**
1. dnd-kit instalado e itens são arrastáveis entre colunas
2. Drop válido atualiza o bucket do item no banco via API
3. Drop é otimista (UI atualiza instantâneo, rollback se API falhar)
4. Cada movimento manual cria um registro na tabela `feedback_loop` (item_id, bucket_anterior, bucket_novo, timestamp) para Epic 3
5. Animação suave durante drag
6. Funciona com teclado também (acessibilidade)

#### Story 2.6 Visão do Dia (modo foco)

Como **usuário**,
quero **um modo simplificado que mostra só Prioridade + ROI Alto**,
para que **eu execute sem distração**.

**Acceptance Criteria:**
1. Botão "Visão do Dia" no header da triagem
2. Rota `/triador/[id]/dia` mostra apenas as 2 colunas críticas
3. Cada item tem botão "✓ Concluído" que marca como done
4. Itens concluídos saem da view mas permanecem no histórico
5. Otimizado para mobile (uma coluna por vez ou stack vertical)

---

### Epic 3: Aprendizado & Refinamento Pessoal

**Objetivo Expandido:** Tornar a engine **sua**. O usuário define critérios pessoais, o sistema aprende com as correções manuais, e ganha utilitários que aumentam o valor: histórico navegável, detecção de duplicatas, exportação. Este épico transforma uma ferramenta genérica em algo personalizado.

#### Story 3.1 Critérios pessoais editáveis

Como **usuário**,
quero **definir o que significa "ROI alto" e "prioridade" pra mim**,
para que **a IA classifique do meu jeito**.

**Acceptance Criteria:**
1. Tela `/configuracoes/criterios` com formulário de critérios por bucket
2. Campos: descrição livre + exemplos opcionais (ex: "ROI alto = receita acima de R$ 5k OU oportunidade que abre porta estratégica")
3. Critérios são salvos por usuário e injetados no prompt da engine
4. Critérios padrão (defaults sensatos) pré-preenchidos no primeiro acesso
5. Botão "Restaurar padrões"

#### Story 3.2 Feedback loop alimenta o prompt

Como **sistema**,
quero **usar as correções manuais do usuário como exemplos few-shot no prompt**,
para que **a classificação fique mais alinhada com o usuário ao longo do tempo**.

**Acceptance Criteria:**
1. Engine puxa os últimos 10 movimentos manuais do usuário ao montar o prompt
2. Esses exemplos são incluídos no prompt como "exemplos do usuário"
3. Métrica: a partir do 20º item movido, taxa de classificação correta na 1ª tentativa deve subir (medir em logs)
4. Documentação no código explicando o mecanismo

#### Story 3.3 Histórico de triagens

Como **usuário**,
quero **navegar nas minhas triagens passadas**,
para que **eu revisite decisões antigas**.

**Acceptance Criteria:**
1. Rota `/historico` lista todas as triagens do usuário em ordem decrescente
2. Cada triagem exibe: data/hora, número de itens, mini-preview dos 3 primeiros
3. Clicar abre o board completo daquela triagem
4. Filtro por intervalo de datas
5. Busca por palavra-chave dentro dos itens

#### Story 3.4 Detecção de duplicatas

Como **usuário**,
quero **ser alertado quando jogo algo que já está na lista**,
para que **eu não polua minha triagem**.

**Acceptance Criteria:**
1. Antes de classificar, engine compara semanticamente cada item novo com itens ativos (não concluídos) das últimas 30 triagens
2. Itens com similaridade > 85% são marcados como "possível duplicata" no board
3. Usuário pode confirmar duplicata (mescla) ou rejeitar (segue separado)
4. Implementação usa embeddings da OpenAI ou Voyage (custo controlado) — alternativa: pedir ao Claude diretamente no prompt de classificação

#### Story 3.5 Exportação para markdown/PDF

Como **usuário**,
quero **exportar uma triagem como arquivo**,
para que **eu compartilhe com sócio/coach ou salve**.

**Acceptance Criteria:**
1. Botão "Exportar" no board da triagem
2. Opções: Markdown (.md) ou PDF
3. Layout do export: título com data, 5 seções por bucket, item + justificativa em cada
4. Download direto no browser

#### Story 3.6 Gatilho de retorno para "Depois"

Como **usuário**,
quero **definir quando algo do bucket "Depois" deve voltar à minha atenção**,
para que **nada importante seja esquecido**.

**Acceptance Criteria:**
1. Ao clicar num item do bucket "Depois", abre modal com opções: data específica ou condição textual ("quando contratar designer")
2. Itens com gatilho de data aparecem na "Visão do Dia" automaticamente quando a data chega
3. Itens com condição textual têm um indicador visual mas precisam ação manual
4. Notificação por email (opcional, configurável) quando data do gatilho chega

#### Story 3.7 Geração de texto para delegação

Como **usuário**,
quero **gerar um texto pronto para enviar quando delego algo**,
para que **eu não precise reescrever cada vez**.

**Acceptance Criteria:**
1. Ao clicar num item do bucket "Delega", abre modal com: destinatário (texto livre) + canal (email/WhatsApp)
2. Botão "Gerar mensagem" usa Claude para escrever um texto profissional baseado no item
3. Botão "Copiar" coloca no clipboard
4. Botão "Marcar como delegado" muda o status do item

---

### Epic 4: Captura por Foto/Print (Visão Computacional)

**Objetivo Expandido:** Expandir a captura para o mundo físico e visual. Usuário tira foto da mesa cheia de papel, do quadro branco, ou faz print de uma tela cheia de coisas, e o sistema extrai os itens e classifica igual ao texto. Este épico dobra o valor do produto.

#### Story 4.1 Upload de imagem

Como **usuário**,
quero **anexar uma foto ou print na tela de captura**,
para que **eu não precise digitar tudo manualmente**.

**Acceptance Criteria:**
1. Botão "Anexar imagem" ao lado do botão "Triar" em `/triador`
2. Aceita JPG, PNG, WEBP até 10MB
3. Preview da imagem aparece na tela após upload
4. Botão "Remover" para descartar
5. Imagem é enviada para Supabase Storage com privacy = bucket privado
6. URL assinada (signed URL) é gerada para a Claude vision processar

#### Story 4.2 Extração de itens via Claude vision

Como **sistema**,
quero **enviar a imagem para Claude vision e receber a lista de itens extraídos**,
para que **a classificação subsequente funcione igual ao texto**.

**Acceptance Criteria:**
1. Função `extrairItensDeImagem(imagemUrl: string)` em `lib/engine/`
2. Usa Claude API com input multimodal (imagem + prompt)
3. Prompt instrui a extrair itens individuais (cada post-it, cada linha do papel, cada notificação)
4. Saída estruturada: array de strings
5. Modelo: `claude-sonnet-4-6` (já é multimodal)
6. Testes com imagens fixtures (mesa, post-it, tela)

#### Story 4.3 Captura por imagem na tela principal

Como **usuário**,
quero **que ao anexar uma imagem e clicar "Triar", o fluxo funcione end-to-end**,
para que **eu use foto da mesma forma que uso texto**.

**Acceptance Criteria:**
1. Se há imagem anexada e texto, ambos são processados (itens da imagem + texto)
2. Se há só imagem, fluxo: extrai itens → cria triagem → classifica → mostra board
3. Loading mostra etapa atual ("Lendo imagem...", "Encontrei 8 itens", "Classificando...")
4. Imagem original fica vinculada à triagem (visível no histórico)
5. Custo desta operação fica abaixo de US$ 0.10 (medido em logs)

#### Story 4.4 Captura por câmera (mobile)

Como **usuário mobile**,
quero **abrir a câmera direto do app para tirar foto**,
para que **a captura em movimento seja instantânea**.

**Acceptance Criteria:**
1. Botão "Câmera" visível em mobile, abre `capture="environment"` (câmera traseira)
2. Foto vai direto para o pipeline do Story 4.3
3. Funciona como PWA (manifest + service worker básico)

---

### Epic 5: Multi-usuário & Lançamento Público

**Objetivo Expandido:** Transformar a ferramenta pessoal do Yuri num produto vendável. Cadastro público, onboarding guiado, isolamento de dados validado, cobrança via Stripe, landing page para conversão. Este épico é o salto de "uso interno" para "negócio".

#### Story 5.1 Landing page de marketing

Como **visitante**,
quero **entender o que o Triador AI faz em 10 segundos**,
para que **eu decida se quero testar**.

**Acceptance Criteria:**
1. Rota `/` (substitui placeholder do Epic 1.1) com landing
2. Hero: headline + subheadline + CTA "Triar de graça"
3. Seção "Como funciona" em 3 passos com screenshots
4. Seção de pricing (tier free + pro)
5. Seção de social proof (placeholder)
6. Footer com links legais
7. SEO básico (meta tags, OG image)
8. Performance: Lighthouse > 90 em mobile

#### Story 5.2 Onboarding guiado pós-cadastro

Como **novo usuário**,
quero **um passo a passo curto que me mostre como usar**,
para que **eu obtenha valor na primeira sessão**.

**Acceptance Criteria:**
1. Após primeiro login, abre fluxo de onboarding (3-4 telas)
2. Tela 1: explicação dos 5 buckets
3. Tela 2: triagem de exemplo pré-preenchida que o usuário pode rodar
4. Tela 3: definir critérios pessoais (do Story 3.1, simplificado)
5. Tela 4: pronto pra usar
6. Pode ser pulado a qualquer momento
7. Não aparece novamente após completar (flag no perfil)

#### Story 5.3 Validação de isolamento multi-tenant

Como **engenheiro**,
quero **provar que dados de usuários diferentes nunca se cruzam**,
para que **eu não tenha vazamento de dados em produção**.

**Acceptance Criteria:**
1. Suite de testes E2E com 2 contas: garante que `triagens` de A nunca aparecem para B em nenhuma rota
2. Testes para todas APIs: leitura, escrita, update, delete
3. Auditoria das policies de RLS no Supabase documentada em `/docs/security.md`
4. Penetration test básico (manual ou via ferramenta) registrado

#### Story 5.4 Integração com Stripe e pricing

Como **usuário**,
quero **assinar o plano Pro para ter limites maiores**,
para que **eu use o produto profissionalmente**.

**Acceptance Criteria:**
1. Plano Free: 30 triagens/mês, sem captura por imagem
2. Plano Pro: ilimitado, todas features, R$ 39/mês (a confirmar)
3. Stripe Checkout integrado para upgrade
4. Customer Portal para gerenciar assinatura/cancelar
5. Webhook do Stripe atualiza status do usuário no Supabase
6. Limites enforced no backend (não apenas na UI)
7. Tela `/conta` mostra plano atual + uso

#### Story 5.5 Métricas de produto e dashboards internos

Como **fundador**,
quero **ver métricas-chave do produto**,
para que **eu tome decisões baseadas em dados**.

**Acceptance Criteria:**
1. Rota `/admin` acessível só pra Yuri (email allowlist)
2. Dashboard com: total de usuários, triagens/dia, conversão Free→Pro, custo médio Claude API por usuário
3. Dados puxados via queries SQL no Supabase
4. Atualização diária (ou em tempo real se trivial)

---

## 7. Checklist Results Report

> *Pendente — rodar `pm-checklist` antes de finalizar.*

**Próxima ação:** Executar o checklist em `.aios-core/development/checklists/pm-checklist.md` e popular esta seção com os resultados.

---

## 8. Next Steps

### 8.1 UX Expert Prompt

> @ux-design-expert — Com base neste PRD do Triador AI, crie a especificação completa de UX/UI focando em:
> 1. **Tela de Captura** (caixa de texto + upload de imagem) — definir hierarquia visual, microinterações e tom emocional
> 2. **Board Kanban de 5 buckets** — wireframes desktop e mobile, sistema de cores, ícones SVG premium (não Lucide), tipografia
> 3. **Visão do Dia** (modo foco) — desenho mobile-first
> 4. **Sistema de design** — componentes base, tokens de cor, tipografia, espaçamento, dark mode
>
> Entregáveis: design system documentado + protótipos das 5 telas críticas (Captura, Board, Visão do Dia, Histórico, Onboarding).

### 8.2 Architect Prompt

> @architect — Com base neste PRD do Triador AI, crie o documento de arquitetura completo cobrindo:
> 1. **Estrutura de pastas** do monorepo Next.js (App Router)
> 2. **Schema completo do Supabase** com migrations versionadas (tabelas, RLS policies, índices)
> 3. **Arquitetura da engine de classificação** — design do prompt, estratégia de prompt caching, fluxo de tool use, estimativa de custo por triagem
> 4. **Estratégia de feedback loop** (Story 3.2) — como armazenar e injetar exemplos do usuário no prompt sem inflar tokens
> 5. **Pipeline de imagem** (Epic 4) — upload, signed URLs, multimodal Claude, custo
> 6. **Multi-tenant security** — auditoria de RLS, testes de isolamento
> 7. **CI/CD** — GitHub Actions com lint + typecheck + Vitest + Playwright + deploy preview no Vercel
> 8. **Observabilidade** — logs estruturados, métricas, alertas mínimos
>
> Entregáveis: documento `docs/architecture.md` + diagrama de fluxo de dados + ADRs (Architecture Decision Records) para decisões críticas.

---

**Fim do PRD v0.1 — Triador AI**

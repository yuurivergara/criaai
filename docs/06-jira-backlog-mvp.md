# Backlog Jira — CriaAI

## Regra de prazo (importante)

| Escopo | Prazo | O que entra |
|--------|--------|-------------|
| **MVP beta** | **20 dias corridos** desde o kickoff | Tudo que precisa para: gerar por IA, clonar URL, editar, publicar em subdominio com SSL, beta fechado com observabilidade minima. Alinhado a [04-plano-mvp-20-dias.md](./04-plano-mvp-20-dias.md). |
| **Fase 2 (pos-MVP)** | A definir apos o fim dos 20 dias | Checkout, dominio customizado completo, landing comercial, legal publico amplo, etc. |

**No Jira:** use uma **Fix Version** `MVP-beta-20d` com **data fim = inicio do projeto + 20 dias** para todas as historias da primeira secao. A secao **Fase 2** pode ter versao separada (ex.: `v1-publico`).

**Legenda dos prazos nas historias:** numero = **prazo maximo desde o primeiro dia do projeto** (kickoff). Ex.: "4 dias" = entregar ate o quarto dia.

---

## Cronograma de referencia — 20 dias (MVP beta)

Alinhe **Sprint** ou **Due date** somando o numero de dias a partir da **data real de inicio**.

| Prazo (ate) | Foco principal | Entregas esperadas (resumo) |
|-------------|----------------|----------------------------|
| **1 dia** | Setup | Repo, lint, CI basico; inicio de ambientes |
| **2 dias** | Setup | Ambientes + secrets; skeleton front/back deployavel |
| **3 dias** | Dominio / API | Modelagem Page, Job, Version; filas esbocadas |
| **4 dias** | Dominio / API | Postgres, Redis, storage, backup DB; contratos API v1 |
| **5 dias** | Auth + API | Cadastro/login; OpenAPI; workers |
| **6 dias** | Auth + tenant | Workspace/tenant; isolamento |
| **7 dias** | Geracao IA | Orquestrador + fallback funcional (**gate checkpoint**) |
| **8 dias** | Geracao IA | Prompt estruturado, persistencia versao |
| **9 dias** | Geracao IA | Validador pos-geracao; FE gerar com IA |
| **10 dias** | Clone | Ingestao URL + extracao estrutural |
| **11 dias** | Clone | Reescrita IA + similaridade |
| **12 dias** | Clone | Compliance basico; whitelist/bloqueio |
| **13 dias** | Front | Shell + lista; preview iframe |
| **14 dias** | Front | Fluxo clonar URL na UI |
| **15 dias** | Editor | Texto, link, cor; versoes |
| **16 dias** | Seguranca | Rate limit; RBAC minimo; limites por plano/cota beta |
| **17 dias** | Publish | Subdominio + SSL; preview vs publico |
| **18 dias** | Publish + obs | Deploy idempotente; Sentry; logs correlacionados |
| **19 dias** | Qualidade | Metricas produto; e2e critico; runbooks |
| **20 dias** | Beta + gate | Beta onda 1, ajustes P0, **Go/No-Go**, release MVP beta |

---

## MVP beta — historias (prazo: ate 20 dias)

Cada card abaixo pertence ao **MVP de 20 dias**. O **Prazo estimado** e o **numero maximo de dias desde o kickoff** para concluir aquela historia (ajuste se o time paralelizar diferente).

---

### Epic: [INFRA] Fundacao e ambientes

#### INFRA-01 — Repositorio, padroes de codigo e CI basico
**Prazo estimado:** **2 dias**  
**Descricao:** Monorepo ou repos alinhados; ESLint/Prettier; pipeline CI em PR.  
**Criterios de aceite:** merge bloqueado se build falhar; README com como rodar local.

#### INFRA-02 — Ambientes dev, staging e producao
**Prazo estimado:** **4 dias**  
**Descricao:** Tres ambientes, variaveis e URLs estaveis; deploy automatizado staging.  
**Criterios de aceite:** deploy producao com gate (tag ou aprovacao).

#### INFRA-03 — Postgres, Redis e object storage
**Prazo estimado:** **4 dias**  
**Descricao:** Banco, fila/cache, bucket para HTML/assets; backup diario do Postgres.  
**Criterios de aceite:** credenciais apenas em cofre; CORS do storage validado para preview/publish.

#### INFRA-04 — Gestao de secrets
**Prazo estimado:** **4 dias**  
**Descricao:** Chaves de IA, JWT, DB fora do codigo; checklist de rotacao.  
**Criterios de aceite:** scan do repo sem segredos expostos.

---

### Epic: [PLATAFORMA] Autenticacao e multi-tenant

#### PLAT-01 — Cadastro, login e recuperacao de senha
**Prazo estimado:** **6 dias**  
**Descricao:** Email/senha (social opcional se couber); JWT + refresh.  
**Criterios de aceite:** logout invalida refresh; fluxo esqueci senha funcional.

#### PLAT-02 — Workspace/tenant e isolamento de dados
**Prazo estimado:** **8 dias**  
**Descricao:** `tenant_id` nas entidades criticas; testes de vazamento negativo.  
**Criterios de aceite:** usuario nao acessa dados de outro tenant.

#### PLAT-03 — RBAC minimo (owner, membro)
**Prazo estimado:** **16 dias**  
**Descricao:** Quem gera, publica e convida no MVP.  
**Criterios de aceite:** matriz aplicada na API; bloqueio 403 coerente.

---

### Epic: [API] Contratos e dominio

#### API-01 — Modelagem Page, Version, Job e Plan/cota
**Prazo estimado:** **5 dias**  
**Descricao:** Entidades e migracoes; jobs assincronos; limites para beta.  
**Criterios de aceite:** ER documentado; migracoes reproduziveis.

#### API-02 — API v1 + OpenAPI
**Prazo estimado:** **6 dias**  
**Descricao:** Rotas geracao, clonagem, publicacao, jobs; prefixo `/api/v1`.  
**Criterios de aceite:** OpenAPI exportavel ou Swagger em staging.

#### API-03 — Filas e workers
**Prazo estimado:** **7 dias**  
**Descricao:** BullMQ (ou equivalente); retry backoff; idempotencia segura.  
**Criterios de aceite:** retry nao duplica publicacao nem cobranca indevida.

#### API-04 — GET /jobs/:id com estados claros
**Prazo estimado:** **10 dias**  
**Descricao:** Estados alinhados a [02-regras-negocio-clonagem.md](./02-regras-negocio-clonagem.md).  
**Criterios de aceite:** UI exibe progresso e mensagens de erro acionaveis.

---

### Epic: [IA] Geracao por prompt

#### IA-GEN-01 — Orquestrador multi-provider + fallback
**Prazo estimado:** **7 dias**  
**Descricao:** Dois provedores; timeout, retry, custo por chamada registrado.  
**Criterios de aceite:** falha do principal aciona fallback automaticamente.

#### IA-GEN-02 — Prompt estruturado e validacao de saida
**Prazo estimado:** **8 dias**  
**Descricao:** Prompt com objetivo, publico, CTA; validar formato de saida.  
**Criterios de aceite:** saida invalida vira erro categorizado (nao pagina quebrada silenciosa).

#### IA-GEN-03 — Persistencia versao inicial + metadados de modelo
**Prazo estimado:** **9 dias**  
**Descricao:** Versao imutavel; modelo e hash de prompt para auditoria.  
**Criterios de aceite:** suporte consegue rastrear geracao por job id.

#### IA-GEN-04 — Validador pos-geracao
**Prazo estimado:** **9 dias**  
**Descricao:** HTML parseavel; links basicos; avisos antes de publicar.  
**Criterios de aceite:** falhas mostradas na UI.

---

### Epic: [IA] Clonagem por URL

#### IA-CLONE-01 — Ingestao e normalizacao de URL
**Prazo estimado:** **10 dias**  
**Descricao:** HTTP(S) apenas; redirects; timeout; erros amigaveis.  
**Criterios de aceite:** 403/timeout/ssl com mensagem clara.

#### IA-CLONE-02 — Extracao estrutural (Playwright ou similar)
**Prazo estimado:** **11 dias**  
**Descricao:** Render + extracao de secoes para preview.  
**Criterios de aceite:** preview reconhece layout principal.

#### IA-CLONE-03 — Reescrita por IA + limiar de similaridade
**Prazo estimado:** **12 dias**  
**Descricao:** Evitar copia literal; score interno; bloqueio/aviso.  
**Criterios de aceite:** alinhado as regras de negocio de clonagem.

#### IA-CLONE-04 — Compliance basico (marca/imagem/termos)
**Prazo estimado:** **12 dias**  
**Descricao:** Remover/substituir ativos problematicos; estado `bloqueado` com motivo.  
**Criterios de aceite:** auditoria quando bloquear.

#### IA-CLONE-05 — Lista de bloqueio e whitelist (beta)
**Prazo estimado:** **12 dias**  
**Descricao:** Dominios bloqueados e whitelist para calibracao sem deploy.  
**Criterios de aceite:** configuracao via DB ou feature flag.

---

### Epic: [FRONT] Produto e editor

#### FE-01 — Shell: layout e lista de paginas
**Prazo estimado:** **13 dias**  
**Descricao:** Dashboard com lista e estados dos jobs/paginas.  
**Criterios de aceite:** empty/loading; responsivo basico.

#### FE-02 — Fluxo "Gerar com IA"
**Prazo estimado:** **9 dias**  
**Descricao:** Formulario, disparo de job, acompanhamento de status.  
**Criterios de aceite:** erros de limite e de provider visiveis.

#### FE-03 — Fluxo "Clonar URL"
**Prazo estimado:** **14 dias**  
**Descricao:** Input URL, copy de termos, feedback de compliance.  
**Criterios de aceite:** mensagens para bloqueio e falha tecnica.

#### FE-04 — Preview em iframe sandbox
**Prazo estimado:** **13 dias**  
**Descricao:** Isolamento do HTML gerado/clonado.  
**Criterios de aceite:** sem XSS para a app pai (mitigacoes documentadas).

#### FE-05 — Editor basico: texto, link, cor
**Prazo estimado:** **15 dias**  
**Descricao:** Selecionar elemento, editar, salvar nova versao.  
**Criterios de aceite:** salvar gera nova versao persistida.

#### FE-06 — Historico de versoes e restaurar
**Prazo estimado:** **15 dias**  
**Descricao:** Listar e restaurar como nova versao.  
**Criterios de aceite:** rollback operacional em minutos.

---

### Epic: [PUBLISH] Publicacao

#### PUB-01 — Publicacao em subdominio + SSL
**Prazo estimado:** **17 dias**  
**Descricao:** `slug.dominio-plataforma` com TLS; bundle no storage + edge.  
**Criterios de aceite:** HTTPS valido sem passo manual por pagina.

#### PUB-02 — Preview separado da URL publica
**Prazo estimado:** **17 dias**  
**Descricao:** URL de preview nao indexavel; distinta da publica.  
**Criterios de aceite:** meta/headers de noindex onde aplicavel.

#### PUB-03 — Deploy idempotente e rollback
**Prazo estimado:** **18 dias**  
**Descricao:** Manifesto de deploy; reverter versao anterior em falha.  
**Criterios de aceite:** rollback testado em staging antes do gate final (20 dias).

---

### Epic: [SEC] Seguranca e limites

#### SEC-01 — Rate limiting (IP + tenant)
**Prazo estimado:** **16 dias**  
**Descricao:** Endpoints de geracao/clonagem com 429.  
**Criterios de aceite:** limiar documentado; sem derrubar API em uso normal.

#### SEC-02 — Orcamento diario de tokens/custo (beta)
**Prazo estimado:** **16 dias**  
**Descricao:** Corte ao estourar politica; alerta interno.  
**Criterios de aceite:** simulacao de estouro bloqueia novos jobs.

#### SEC-03 — Baseline seguranca (CDN/WAF ou headers)
**Prazo estimado:** **20 dias**  
**Descricao:** Cloudflare ou equivalente; headers minimos em rotas publicas.  
**Criterios de aceite:** checklist curto OWASP para superficie exposta.

---

### Epic: [MON] Observabilidade e qualidade

#### MON-01 — Sentry (front + back)
**Prazo estimado:** **18 dias**  
**Descricao:** Erros com release/environment; source maps.  
**Criterios de aceite:** alerta se taxa de erro ultrapassar limiar.

#### MON-02 — Logs estruturados (requestId/jobId)
**Prazo estimado:** **18 dias**  
**Descricao:** JSON; correlacao API <-> worker.  
**Criterios de aceite:** diagnosticar job com um ID.

#### MON-03 — Metricas de produto (PostHog ou GA4)
**Prazo estimado:** **19 dias**  
**Descricao:** Eventos: geracao, clone, publicacao, erro.  
**Criterios de aceite:** funil minimo visivel.

#### MON-04 — Testes e2e criticos (staging)
**Prazo estimado:** **19 dias**  
**Descricao:** Playwright/Cypress: gerar -> editar -> publicar; clone feliz path.  
**Criterios de aceite:** verde no pipeline antes do gate final (20 dias).

---

### Epic: [OPS] Operacao e beta

#### OPS-01 — Runbooks (IA, fila, SSL, rollback)
**Prazo estimado:** **19 dias**  
**Descricao:** Passos curtos para incidente comum.  
**Criterios de aceite:** plantao consegue executar sem improviso.

#### OPS-02 — Playbook suporte usuario beta
**Prazo estimado:** **19 dias**  
**Descricao:** Respostas para clone falho, limite, SSL.  
**Criterios de aceite:** macros ou doc interno linkado.

#### OPS-03 — Restore: procedimento minimo
**Prazo estimado:** **20 dias**  
**Descricao:** Como restaurar Postgres a partir do backup em caso de incidente (procedimento escrito; teste completo pode ser Fase 2).  
**Criterios de aceite:** runbook de restore revisado por alguem que nao escreveu.

#### GTM-BETA-01 — Beta fechado: convites, cohort e feedback
**Prazo estimado:** **20 dias**  
**Descricao:** Lista de usuarios; formulario de feedback; monitoramento reforcado.  
**Criterios de aceite:** relatorio top issues pos-onda 1.

#### GTM-BETA-02 — Gate Go/No-Go e release MVP beta
**Prazo estimado:** **20 dias**  
**Descricao:** Checklist: fluxos core, zero P0, SLO 48h, custo medio IA, runbooks.  
**Criterios de aceite:** assinatura produto + eng; versao `MVP-beta-20d` publicada.

---

## Fase 2 — Apos os 20 dias (nao faz parte do prazo MVP beta)

Use outra Fix Version. Prazos abaixo sao **indicativos** (semanas apos o fim dos 20 dias).

| ID sugerido | Titulo | Nota |
|-------------|--------|------|
| PUB-F2-01 | Dominio customizado (CNAME) completo | 2 a 4 semanas apos os 20 dias |
| NEG-F2-01 | Planos pagos + checkout (Stripe/Pagar.me) | 3 a 6 semanas apos os 20 dias |
| NEG-F2-02 | Portal de fatura e cancelamento | Apos checkout |
| LEGAL-F2-01 | Termos/privacidade publicos + aceite versionado | Paralelo a checkout |
| LEGAL-F2-02 | Canal de denuncia / takedown | Apos trafego publico |
| GTM-F2-01 | Landing comercial + SEO | Apos definicao de pricing |
| GTM-F2-02 | Onboarding email completo | Apos estabilidade |
| OPS-F2-01 | Restore testado end-to-end + DR | Conforme [05-operacao-riscos-slo.md](./05-operacao-riscos-slo.md) |

---

## Resumo para o Jira

- **Uma versao:** `MVP-beta-20d` com **data fim = data de inicio + 20 dias**.
- **Todas** as historias da secao "MVP beta — historias" ficam nessa versao; use o campo **Prazo estimado** (ex.: 4 dias, 12 dias) como **due date = inicio + N dias**.
- **Fase 2** em versao separada.

---

*Alinhado a [04-plano-mvp-20-dias.md](./04-plano-mvp-20-dias.md) e ao indice em [README.md](./README.md).*

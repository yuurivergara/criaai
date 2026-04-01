# 03 - Tecnologias Recomendadas (Linguagens, Frameworks e Ferramentas) - YURI

## 1. Criterios de escolha
- **Time-to-market:** priorizar tecnologias maduras para MVP em 20 dias.
- **Custo total:** reduzir carga operacional com servicos gerenciados.
- **Escalabilidade pragmatica:** evoluir sem migracoes disruptivas.
- **Contratabilidade:** stack com ampla disponibilidade de talentos.
- **Observabilidade e seguranca:** suporte nativo e ecossistema consolidado.

## 2. Stack recomendada por camada

## 2.1 Frontend (produto e editor)
- **Linguagem:** TypeScript.
- **Framework:** Next.js (App Router).
- **UI:** Tailwind CSS + biblioteca de componentes.
- **Estado cliente:** Zustand.
- **Formulario/validacao:** React Hook Form + Zod.
- **Editor:** iframe sandbox + dnd-kit (fase 2 para drag-and-drop).

**Justificativa:** acelera entrega, padroniza tipagem ponta a ponta e facilita evolucao do editor visual.

## 2.2 Backend (API e dominio de negocio)
- **Linguagem:** TypeScript.
- **Runtime/Framework:** Node.js + NestJS (ou Fastify modular).
- **ORM:** Prisma.
- **Filas:** BullMQ (Redis).
- **Jobs de IA/publicacao:** workers dedicados por fila.

**Justificativa:** produtividade alta, boa separacao de modulos e suporte robusto para tarefas assincronas.

## 2.3 IA e processamento de conteudo
- **Orquestracao de prompts:** camada propria no backend.
- **Providers (MVP):** DeepSeek (custo), Groq (latencia), fallback configuravel.
- **Moderacao:** classificador de politicas + heuristicas de similaridade textual.
- **Parser de pagina:** Playwright + parseador HTML para extracao estrutural.

**Justificativa:** combina qualidade/custo e reduz risco de indisponibilidade com estrategia multi-provider.

## 2.4 Dados e armazenamento
- **Banco relacional:** PostgreSQL (Supabase/Neon/RDS).
- **Cache/fila:** Redis (Upstash/Redis Cloud).
- **Objetos/artefatos:** Cloudflare R2 ou S3.
- **Busca futura (opcional):** OpenSearch para auditoria textual e logs extensos.

**Justificativa:** componentes padrao de mercado, baixo lock-in e boa elasticidade.

## 2.5 Infraestrutura e deploy
- **Frontend:** Vercel.
- **Backend/workers:** Railway, Render ou Fly.io (escolher um provedor principal).
- **CDN/DNS/SSL:** Cloudflare.
- **IaC:** Terraform para DNS, storage e componentes criticos.
- **CI/CD:** GitHub Actions.

**Justificativa:** reduz setup manual e acelera ciclos de release durante beta fechado.

## 2.6 Observabilidade e qualidade
- **Erros:** Sentry.
- **APM e tracing:** OpenTelemetry + Grafana Cloud.
- **Logs:** estruturados em JSON com correlacao por `requestId`.
- **Analytics de produto:** PostHog.
- **Testes:** Vitest (unitario), Playwright (e2e), Supertest (API).

**Justificativa:** permite diagnostico rapido de falhas e valida aprendizado do produto no beta.

## 2.7 Seguranca e compliance
- **Auth:** JWT + refresh token + RBAC por tenant.
- **Gestao de segredos:** cofre do provedor + rotacao trimestral.
- **Protecao edge:** WAF e rate limit via Cloudflare.
- **Governanca de dados:** criptografia em repouso e em transito.

**Justificativa:** atende baseline de seguranca para SaaS B2B sem aumentar complexidade excessiva.

## 3. Tecnologias por fase

## 3.1 MVP (20 dias)
- Next.js, NestJS/Fastify, Postgres, Redis, R2/S3, DeepSeek+fallback, Cloudflare, Sentry, PostHog.

## 3.2 Pos-MVP (30-90 dias)
- Feature flags, A/B testing, fila dedicada por tenant enterprise, mecanismos de rollback avancado.

## 3.3 Escala (90+ dias)
- Avaliar Kubernetes e service mesh somente com saturacao recorrente de workers/API.
- Avaliar modelo proprio/fine-tuning com base em volume e margem.

## 4. Ferramentas operacionais recomendadas
- **Documentacao:** Markdown versionado no repositorio.
- **Gestao de tarefas:** Linear/Jira com sprints semanais.
- **Design/UX:** Figma com biblioteca de componentes.
- **Suporte:** Intercom ou Crisp.
- **Runbooks:** playbooks de incidente em `docs/`.

## 5. Riscos tecnicos e mitigacao
- **Risco:** dependencia de um unico provider de IA.  
  **Mitigacao:** fallback automatico por politica de custo/latencia.
- **Risco:** custo variavel de tokens acima do previsto.  
  **Mitigacao:** orcamento diario por tenant e limites por plano.
- **Risco:** latencia alta em horarios de pico.  
  **Mitigacao:** filas com prioridade e cache de artefatos recorrentes.

## 6. Decisao executiva recomendada
Adotar stack unificada em TypeScript no MVP, com infraestrutura gerenciada e orquestracao multi-provider de IA. Essa combinacao oferece melhor equilibrio entre velocidade de entrega, controle de custo e capacidade de evolucao tecnica no curto prazo.

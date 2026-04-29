# Domínios personalizados (custom domains)

Permite que o usuário aponte o domínio dele (ex: `quiz.minhamarca.com`) para
servir um quiz/landing publicado na plataforma.

## Fluxo de ponta a ponta

1. **Usuário publica** a página normalmente.
2. **Cadastra o domínio** no painel "Domínios personalizados" do editor.
3. **Sistema retorna**:
   - `CNAME quiz.minhamarca.com → app.criaai.com` (apontamento)
   - `TXT _criaai-verify.quiz.minhamarca.com = criaai-verify=<token>` (posse)
4. **Usuário cria os 2 registros DNS** no provedor dele.
5. **Clica em "Verificar agora"**: o backend faz `dns.resolveTxt` e, se o
   token bate, promove o domínio para `active`.
6. **Caddy emite TLS automaticamente** na primeira requisição que chegar
   pelo novo host (on-demand TLS), pergunta ao backend se o host está
   autorizado, e faz o reverse proxy para o NestJS.
7. **Middleware no NestJS** identifica o `Host` header, encontra o slug
   correspondente e reescreve a URL para `/v1/public/<slug>`.

## Componentes

| Camada    | Arquivo                                                 |
| --------- | ------------------------------------------------------- |
| Schema    | `prisma/schema.prisma` (model `CustomDomain`)           |
| Service   | `src/pages/domains.service.ts`                          |
| API       | `src/pages/domains.controller.ts`                       |
| Internal  | `src/pages/internal-domains.controller.ts` (Caddy ask)  |
| Roteamento| `src/pages/custom-domain.middleware.ts`                 |
| Edge TLS  | `Caddyfile` + `docker-compose.prod.yml`                 |
| Frontend  | `frontend/src/CustomDomainsPanel.tsx`                   |

## API REST

```
GET    /v1/pages/:pageId/domains
POST   /v1/pages/:pageId/domains              { host, label? }
POST   /v1/pages/:pageId/domains/:id/verify
DELETE /v1/pages/:pageId/domains/:id

GET    /v1/internal/domains/ask?domain=x.com  (uso interno do Caddy)
```

## Variáveis de ambiente

| Var                   | Default              | O que é                                      |
| --------------------- | -------------------- | -------------------------------------------- |
| `PUBLIC_DOMAIN`       | `app.criaai.local`   | Domínio principal da plataforma              |
| `CRIAAI_PUBLIC_HOST`  | derivado de URL      | Host que aparece nas instruções de CNAME     |
| `PUBLIC_BASE_URL`     | `http://localhost:…` | URL base para `publicUrl` da página          |
| `ACME_EMAIL`          | `admin@criaai.local` | E-mail para registro Let's Encrypt           |

## Subir em produção

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Pré-requisitos:

1. DNS A record do `PUBLIC_DOMAIN` apontando para o IP do servidor.
2. Portas 80 e 443 abertas no firewall.
3. `.env` com as variáveis acima preenchidas.

## Sem servidor próprio? Use Cloudflare

Quem não quer rodar Caddy pode botar o tráfego atrás do Cloudflare:

1. CNAME `quiz.cliente.com` → `app.criaai.com` (proxied/laranja).
2. SSL/TLS mode = "Full" no Cloudflare.
3. O backend ainda funciona — `dns.resolveTxt` valida o TXT igualmente.
4. O middleware reescreve com base no `Host`, sem precisar do Caddy.

## Aplicar migration

```bash
cd backend
npm run db:push
```

(Em produção real, troque por `prisma migrate deploy` com migrations versionadas.)

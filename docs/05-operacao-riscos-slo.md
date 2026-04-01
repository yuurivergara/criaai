# 05 - Operacao, Riscos e SLO/SLA

## 1. Objetivo operacional
Definir padrao minimo de operacao para manter o MVP beta estavel, seguro e com capacidade de resposta a incidentes.

## 2. SLO e SLA recomendados para beta

## 2.1 SLO internos
- Disponibilidade de API mensal >= 99,5%.
- p95 de geracao inicial <= 12 segundos.
- p95 de clonagem <= 45 segundos (incluindo extracao + reescrita).
- Taxa de erro 5xx <= 1,5% por janela de 1 hora.

## 2.2 SLA externo (beta fechado)
- Atendimento de incidentes criticos em ate 2 horas.
- Resolucao de incidentes criticos em ate 8 horas.
- Comunicacao proativa para indisponibilidade acima de 15 minutos.

## 3. Mapa de riscos operacionais
- **Indisponibilidade de provider de IA**
  - Impacto: alto.
  - Controle: fallback automatico e fila de retentativa.
- **Escalada de custo por uso inesperado**
  - Impacto: alto.
  - Controle: budget diario por tenant e alertas por limiar.
- **Abuso de recursos (spam/automacao)**
  - Impacto: medio.
  - Controle: rate limit, captcha em onboarding e auditoria por IP.
- **Falha de publicacao em dominio**
  - Impacto: medio.
  - Controle: rollback de versao e fila de reconciliacao DNS/SSL.

## 4. Monitoramento e alertas
- Alertas de p0: API fora, fila travada, erro massivo de geracao.
- Alertas de p1: latencia degradada, aumento anormal de custo/token.
- Alertas de p2: falha parcial de integracao secundarias.
- Canal unico de incidente com runbook por classe de erro.

## 5. Runbooks essenciais
- Runbook de indisponibilidade de IA.
- Runbook de fila congestionada.
- Runbook de falha de SSL/dominio.
- Runbook de rollback de release.
- Runbook de abuso e bloqueio de tenant.

## 6. Politica de backup e continuidade
- Backup diario de banco com retencao minima de 14 dias.
- Versionamento de artefatos de pagina e manifesto de deploy.
- Restore testado semanalmente em ambiente de homologacao.
- Objetivo de recuperacao:
  - RPO: ate 24 horas.
  - RTO: ate 4 horas para servicos criticos.

## 7. Politica de incidentes
- Classificacao por severidade: p0, p1, p2, p3.
- Incidente p0 exige:
  - war room imediata;
  - dono unico de comunicacao;
  - post-mortem em ate 48h.
- Toda acao corretiva gera item rastreavel no backlog.

## 8. Governanca de mudancas
- Sem deploy em producao sem checklist minimo:
  - testes criticos aprovados;
  - migracoes validadas;
  - plano de rollback.
- Feature flag para recursos de maior risco (clonagem e publicacao).
- Janela de release preferencial fora de horario de pico.

## 9. Operacao durante beta fechado
- Limitar onboarding por ondas semanais.
- Acompanhar cohort com monitoramento diario nas primeiras 2 semanas.
- Definir owner tecnico e owner de produto por turno.
- Registrar aprendizado de suporte para ajuste do onboarding.

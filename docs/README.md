# Documentacao Profissional - Projeto CriaAI

## Prazo do MVP beta (escopo oficial)
O **MVP beta** do CriaAI tem prazo de **20 dias corridos** a partir do kickoff (data de inicio do projeto), com escopo congelado conforme [04-plano-mvp-20-dias.md](./04-plano-mvp-20-dias.md): geracao por prompt, clonagem por URL com guardrails, edicao basica, publicacao em subdominio com SSL e instrumentacao minima. Itens fora desse prazo (checkout, dominio proprio avancado, MVP publico aberto) ficam em backlog de **fase posterior**, descritos em [06-jira-backlog-mvp.md](./06-jira-backlog-mvp.md).

## Finalidade
Este conjunto de documentos define diretrizes de produto, engenharia e operacao para o CriaAI, com foco em:
- arquitetura de infraestrutura para geracao e clonagem de paginas por IA;
- regras de negocio para o processo de clonagem de paginas;
- stack tecnologica recomendada para MVP e escala inicial;
- plano de acao para lancar MVP beta em 20 dias de execucao concentrada.

## Escopo
Os materiais estao orientados para decisao executiva e implementacao tecnica. Cada documento responde:
1. O que deve ser feito.
2. Como deve ser implementado.
3. Quais riscos devem ser controlados.
4. Quais metricas validam o sucesso.

## Estrutura dos documentos
- [01-arquitetura-infra.md](./01-arquitetura-infra.md): arquitetura alvo, fluxo de IA e requisitos nao funcionais.
- [02-regras-negocio-clonagem.md](./02-regras-negocio-clonagem.md): regras de negocio e operacao do processo de clonagem.
- [03-stack-tecnologica.md](./03-stack-tecnologica.md): linguagens, frameworks e ferramentas por camada.
- [04-plano-mvp-20-dias.md](./04-plano-mvp-20-dias.md): roteiro de entrega com marcos diarios e criterios de gate.
- [05-operacao-riscos-slo.md](./05-operacao-riscos-slo.md): SLO/SLA, observabilidade, continuidade e risco operacional.
- [06-jira-backlog-mvp.md](./06-jira-backlog-mvp.md): cards Jira do MVP em **20 dias** + backlog opcional pos-beta.

## Convencoes editoriais
- Linguagem formal, objetiva e orientada a execucao.
- Decisoes acompanhadas de justificativa tecnica e impacto de negocio.
- Terminologia consistente entre produto, engenharia e operacao.
- Uso de metricas e criterios verificaveis para aceite.

## Publico-alvo
- Fundador(a) e lideranca de produto.
- Engenharia (frontend, backend, IA e plataforma).
- Operacao e suporte.
- Parceiros de infraestrutura e compliance.

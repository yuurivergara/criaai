# 02 - Regras de Negocio do Processo de Clonagem de Paginas (YURI)

## 1. Objetivo
Estabelecer as regras de negocio para o recurso de clonagem de paginas, garantindo:
- conformidade legal e etica;
- previsibilidade operacional;
- qualidade minima do resultado publicado;
- controle de custo e risco por tenant.

## 2. Definicoes
- **Clonagem:** processo de recriar estrutura funcional e visual de uma pagina publica sem reproduzir conteudo protegido de forma literal.
- **Origem:** URL fornecida pelo usuario para referencia estrutural.
- **Derivada:** nova pagina gerada na plataforma apos processamento.
- **Job de clonagem:** execucao assincrona de coleta, transformacao e validacao.

## 3. Politicas de elegibilidade

### 3.1 Permissao por plano
- Free: ate 1 clonagem/mensal (apenas subdominio da plataforma).
- Starter/Pro: limites progressivos conforme contrato comercial.
- Agency/Enterprise: limites customizados por workspace.

### 3.2 Tipos de URL permitidas
- Paginas publicas acessiveis sem autenticacao.
- Paginas com `robots` permitindo acesso para leitura automatizada.
- Dominios sem bloqueio juridico conhecido na base interna.

### 3.3 Tipos de URL bloqueadas
- Conteudo com login obrigatorio.
- Conteudo com paywall protegido.
- URLs com indicio de abuso, fraude, malware ou phishing.
- Fontes com notificacao legal preexistente.

## 4. Fluxo de processo de clonagem
1. Usuario envia URL de origem.
2. Sistema valida formato, reputacao do dominio e permissao de plano.
3. Coletor captura estrutura (HTML/CSS) e metadados publicos.
4. Parser segmenta a pagina em secoes (hero, prova social, FAQ, CTA).
5. IA reescreve copy e organiza componentes em template interno.
6. Motor de compliance executa checagens de similaridade e termos proibidos.
7. Resultado vai para preview com status `aguardando_aprovacao`.
8. Usuario revisa, ajusta e publica.

## 5. Regras de transformacao (obrigatorias)
- Nao replicar texto integral acima de limiar de similaridade definido.
- Logos, marcas registradas e imagens proprietarias devem ser removidas ou substituidas.
- Scripts de terceiros da pagina origem nao sao importados automaticamente.
- Formularios sao recriados no padrao da plataforma (sem copiar endpoints externos).
- CTAs devem ser reescritos para o objetivo definido pelo usuario.

## 6. Regras de compliance e risco
- **Copyright:** bloquear publicacao quando score de similaridade exceder limite interno.
- **Marca:** bloquear termos registrados sem autorizacao.
- **Conteudo sensivel:** bloquear nichos proibidos pela politica interna.
- **Dados pessoais:** impedir ingestao e exposicao de dados pessoais encontrados na origem.

## 7. Estados de processamento
- `recebido`: URL recebida e enfileirada.
- `em_analise`: validacao de dominio e coleta inicial.
- `processando`: transformacao por IA e montagem da derivada.
- `revisao_compliance`: checagens legais e tecnicas.
- `aguardando_aprovacao`: pronto para revisao do usuario.
- `publicado`: pagina publicada com sucesso.
- `bloqueado`: interrompido por politica.
- `falha_tecnica`: erro operacional que permite retentativa.

## 8. Tratamento de excecoes
- **Falha de captura:** retentar ate 2 vezes com backoff.
- **Timeout da origem:** retornar erro orientativo com sugestao de nova tentativa.
- **Layout muito complexo:** gerar aviso e simplificar estrutura para template padrao.
- **Assets indisponiveis:** substituir por placeholders e marcar campos para revisao.
- **Bloqueio legal/compliance:** encerrar job com justificativa auditavel.

## 9. Criterios de aceite
- Pagina derivada abre em preview sem erro de renderizacao.
- Estrutura principal (secoes essenciais) preservada sem copia literal de texto.
- Todos os links/CTAs validos apos revisao.
- Nenhum bloqueio de compliance pendente para publicacao.
- Registro completo de auditoria (origem, versao de modelo, score de similaridade).

## 10. KPIs operacionais do processo
- Taxa de conclusao de jobs de clonagem.
- Tempo medio para preview disponivel.
- Taxa de bloqueio por compliance.
- Taxa de publicacao apos clonagem.
- Custo medio de IA por job.

## 11. RACI simplificado
- **Produto (YURI):** define politicas de elegibilidade e experiencia.
- **Engenharia Backend:** implementa pipeline e estados de job.
- **IA/ML:** define prompts, limiares de similaridade e guardrails.
- **Legal/Compliance:** valida regras de bloqueio e resposta a notificacoes.
- **Suporte:** trata incidentes e orienta usuarios em falhas recorrentes.

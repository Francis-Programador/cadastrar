SER TRADER SEM RÉ — Guia rápido

O que é

Uma plataforma comunitária onde traders registram operações, geram rankings e acompanham métricas de desempenho coletivo.

Resumo de uso

- Dashboard (`index.html`): visão geral com métricas, gráficos e ranking. Use os filtros para restringir período e contas.
- Cadastrar (`cadastrar.html`): formulário para enviar operações — os envios populam a planilha do Google Sheets usada pelo backend.
- Relatórios (`relatorios.html`): análises detalhadas, tabelas e gráficos. Filtre, copie e exporte para análise externa.

Passo a passo para seguidores

1) Cadastrar uma operação
	 - Acesse `cadastrar.html` e preencha os campos obrigatórios: `usuario`, `ativo`, `entrada`, `payout`, `resultado`.
	 - Exemplos válidos:
		 - `usuario`: fulano123
		 - `ativo`: EUR/USD
		 - `entrada`: 10.00
		 - `payout`: 92  (ou 0.92)
		 - `resultado`: WIN

2) Conferir no Dashboard
	 - Volte ao `index.html`. As métricas e o ranking são atualizados conforme novas operações forem recebidas.

3) Gerar relatórios
	 - Em `relatorios.html`, escolha intervalo de datas e filtros (estratégia, corretora, conta) e analise as métricas.
	 - Para exportar: selecione linhas da tabela e copie (Ctrl+C) para colar em outra planilha.

Dicas e resolução de problemas

- Se números aparecem zerados: confira `entrada` e `payout` no cadastro — devem ser valores numéricos.
- Se uma operação não aparece: verifique se o envio retornou sucesso; aguarde alguns segundos e atualize a página.
- Evite enviar informações pessoais sensíveis — use apenas nicknames públicos.

Área de membros local

- Para testar o cadastro de membros, execute `npm run dev` na pasta do projeto e abra `http://localhost:8080/membros/`.
- Não use o botão “Go Live” do Live Server nessa página: o envio depende do proxy do Vite para se conectar ao Apps Script.

Perguntas frequentes (FAQ)

- Por que meu nickname aparece diferente no ranking?
	- Use sempre o mesmo `usuario` no cadastro; diferenças de capitalização ou espaços criam entradas separadas.

- Posso editar uma operação enviada?
	- Atualmente não existe edição via UI. Para correções, peça ao administrador para ajustar a linha na planilha.

Suporte

Abra uma issue ou contate o administrador com um exemplo da linha enviada (mostrar todos os campos) para diagnóstico.

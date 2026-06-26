# PROMPT PARA IMPLEMENTAÇÃO — SER TRADER SEM RÉ

Quero transformar meu sistema de gestão de operações de trading em uma plataforma comunitária chamada **SER TRADER SEM RÉ**, onde qualquer usuário poderá cadastrar suas operações e todos poderão visualizar estatísticas da comunidade em tempo real.

---

## Objetivo
Criar um sistema de **Social Trading Dashboard**, onde vários traders utilizam o mesmo banco de dados (Google Sheets + Google Apps Script) e o dashboard mostra estatísticas individuais e gerais.

---

## Tecnologias

- HTML5
- CSS3
- JavaScript puro (ES6)
- Google Apps Script
- Google Sheets como banco de dados
- Chart.js
- Layout responsivo

---

## Banco de dados
Cada operação possui:

- Data
- Ativo
- Mercado
- Estratégia
- Timeframe
- Direção
- Conta
- Entrada
- Payout
- Resultado
- Observação
- Corretora
- Usuário
A coluna **Usuário** identifica quem cadastrou a operação.

---

## Cadastro
O formulário deverá conter:

- Nome do Trader (Usuário)
- Ativo
- Mercado
- Estratégia
- Timeframe
- Direção
- Conta
- Entrada
- Payout
- Resultado
- Corretora
- Observação
Ao clicar em **Salvar Operação**, os dados deverão ser enviados para o Google Apps Script utilizando fetch() em JSON.

---

## Dashboard
O dashboard deve mostrar dados da comunidade inteira.

### Cards
Mostrar:

- Total de Operações
- Total de Traders
- Win Rate Geral
- Lucro Total
- Saldo Atual
- Total de WIN
- Total de LOSS
- Melhor Trader
- Melhor Estratégia
- Melhor Corretora

---

## Filtros
Criar filtros por:

- Usuário
- Estratégia
- Corretora
- Conta
- Resultado
- Mercado
- Timeframe
- Data Inicial
- Data Final
Todos os gráficos e tabelas devem responder imediatamente aos filtros.

---

## Ranking
Criar um Ranking dos Traders.

Mostrar:

Posição

Nome

Operações

WIN

LOSS

Win Rate

Lucro

ROI

Exemplo:

🥇 João

🥈 Maria

🥉 Carlos

Ordenado pelo maior lucro.

---

## Perfil Individual
Quando selecionar um trader nos filtros, mostrar:

Nome

Total de operações

Win Rate

Lucro

Maior sequência de WIN

Maior sequência de LOSS

Lucro médio

Prejuízo médio

Primeira operação

Última operação

Gráfico da evolução da banca.

---

## Dashboard Geral
Criar gráficos:

### Evolução da banca
Linha

### WIN x LOSS
Rosca

### Operações por estratégia
Barras

### Operações por corretora
Barras

### Operações por mercado
Pizza

### Operações por timeframe
Barras

### Evolução diária
Linha

### Lucro por dia
Área

### Lucro mensal
Colunas

---

## Estatísticas
Calcular automaticamente:

Total Operações

WIN

LOSS

Empates (caso existam)

Win Rate

Lucro Bruto

Prejuízo Bruto

Lucro Líquido

ROI

Payoff

Expectância

Média de Entrada

Média de Payout

Maior WIN

Maior LOSS

Maior sequência de WIN

Maior sequência de LOSS

Quantidade de contas Reais

Quantidade de contas Demo

Quantidade por Corretora

Quantidade por Estratégia

Quantidade por Mercado

Quantidade por Timeframe

---

## Feed Comunitário
Criar uma tabela com:

Data

Usuário

Ativo

Estratégia

Resultado

Lucro

Corretora

Ordenada da operação mais recente para a mais antiga.

---

## Últimas Operações
Mostrar apenas as últimas 10 operações cadastradas.

---

## Links das Corretoras
Criar cartões bonitos para:

IQ Option

Deriv

Bybit

Pocket Option

Cada cartão contendo:

Logo

Nome

Botão "Cadastrar"

---

## Responsividade
Desktop

Notebook

Tablet

Celular

Sidebar recolhível.

---

## Tema
Não alterar a identidade visual existente.

Apenas deixar o design mais moderno.

---

## Código
O código deve ser organizado em módulos:

Sem código duplicado.

Funções pequenas.

Comentários apenas onde necessário.

---

## Performance
O dashboard deve conseguir trabalhar com milhares de operações sem travamentos.

Utilizar:

- map()
- reduce()
- filter()
- sort()
Evitar múltiplos loops desnecessários.

---

## Objetivo Final
Quero um painel semelhante aos dashboards profissionais de trading, onde uma comunidade inteira consegue registrar operações, acompanhar sua evolução individual, comparar desempenho com outros traders, visualizar rankings, gráficos avançados e estatísticas completas em tempo real, utilizando apenas **HTML, CSS, JavaScript, Google Apps Script e Google Sheets** como backend.

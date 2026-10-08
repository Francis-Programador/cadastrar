Aqui está o prompt pronto, refinado e estruturado especificamente para a **página de cadastro do teu site**, sem alterar a estrutura existente:

---

### Prompt para Copiar e Colar

```text
Já possuo o meu site "SER TRADER SEM RÉ" pronto e hospedado na Netlify. 
NÃO quero recriar o site, login, dashboard ou outras páginas. 
Quero implementar SOMENTE o módulo de CADASTRO DE MEMBROS na página de cadastro que já existe (`cadastrar.html`), integrando-o ao Google Sheets através do Google Apps Script.

---

### 1. ESTRUTURA DO BANCO DE DADOS (Google Sheets)
Criar/utilizar uma aba chamada `Membros_Premium` com os seguintes cabeçalhos na Linha 1 (Colunas A até AA):
1. ID_Membro (Gerado automaticamente no formato MBR-XXXXXXXX)
2. Data_Registro (Timestamp do servidor no fuso Africa/Luanda)
3. Nome_Completo
4. Nome_Usuario (Salvo em minúsculas)
5. Email (Salvo em minúsculas)
6. WhatsApp
7. Idade
8. Pais_Residencia
9. Telegram
10. Senha_Hash (Criptografia SHA-256; NUNCA armazenar em texto puro)
11. Plano (Mensal, Trimestral, Semestral, Anual)
12. Valor_Pago
13. Moeda (Default: AOA)
14. Metodo_Pagamento (Multicaixa Express, Transferência Bancária, Unitel Money, USDT, Outro)
15. Referencia_Pagamento
16. Url_Comprovante (Link para o comprovante)
17. Status_Pagamento (Default: Pendente)
18. Status_Conta (Default: Pendente)
19. Data_Pagamento (Vazio)
20. Data_Inicio (Vazio)
21. Data_Vencimento (Vazio)
22. Aceite_Termos (Sim/Não)
23. Data_Aceite_Termos
24. Versao_Termos (Default: 1.0)
25. Codigo_Convite
26. Indicado_Por
27. Observacoes

---

### 2. REQUISITOS DO BACKEND (Google Apps Script - `apps_script.gs`)
- Criar a função `registerMember(data)` acionada por `doPost(e)` com a ação `"register"`.
- Validar todos os campos no servidor (nome, e-mail válido, WhatsApp, país, senha >= 8 caracteres, plano, método e aceite de termos).
- Checar duplicidades na planilha antes de inserir (impedir Nome_Usuario, Email e Referencia_Pagamento duplicados, ignorando maiúsculas/minúsculas).
- Gerar ID único no formato `MBR-XXXXXXXX` e garantir que não existe na planilha.
- Sanitizar os dados de entrada para evitar injeções de fórmulas no Sheets (ex: textos começando com `=`, `+`, `-`, `@`).
- Retornar respostas JSON claras:
  - Sucesso: `{ "success": true, "message": "...", "idMembro": "MBR-XXXXXXXX" }`
  - Erro: `{ "success": false, "message": "Mensagem detalhada do erro" }`

---

### 3. REQUISITOS DO FRONT-END (`cadastrar.html`)
- O formulário deve respeitar o design dark atual do site (utilizar CSS com classes isoladas `stsr-*` para não quebrar estilos globais).
- Campos obrigatórios: Nome Completo, Nome de Usuário, E-mail, WhatsApp, País de Residência, Senha, Confirmar Senha, Plano Escolhido, Método de Pagamento e Checkbox de Aceite dos Termos.
- Campos opcionais: Idade, Telegram, Referência do Pagamento, Link do Comprovante (URL).
- Validação no JavaScript antes do envio:
  - Exibir mensagens de erro diretamente abaixo de cada campo.
  - Verificar se a confirmação de senha é idêntica à senha.
- Durante o envio:
  - Desabilitar o botão de envio e alterar o texto para "Enviando cadastro...".
- Pós-envio:
  - Se sucesso: Limpar o formulário e exibir alerta positivo com o ID do cadastro (`MBR-XXXXXXXX`).
  - Se erro: Manter os dados preenchidos no formulário e exibir o alerta de erro retornado pelo servidor.

---

### 4. ENTREGÁVEIS
1. Código completo do Google Apps Script (`apps_script.gs`).
2. Código completo do formulário (HTML + CSS isolado + JavaScript) para colar em `cadastrar.html`.
3. Instruções passo a passo de como implantar o Apps Script como Web App e configurar a URL de integração.

```
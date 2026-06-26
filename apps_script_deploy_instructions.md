Guia rápido: publicar `apps_script.gs` no Google Apps Script e configurar `API_KEY`

1) Criar projeto no Google Apps Script
- Acesse https://script.google.com/
- Crie um novo projeto e cole o conteúdo de `apps_script.gs` (arquivo gerado no repositório).

2) Definir Script Property `API_KEY`
- No editor do Apps Script: Clique em "Project Settings" (ícone de engrenagem) > "Script properties" (ou menu "File" > "Project properties" dependendo da UI).
- Adicione uma propriedade chamada `API_KEY` com um valor seguro (ex.: `my-super-secret-key-123`).

3) Publicar como Web App
- Menu "Deploy" > "New deployment" > tipo "Web app".
- Executar como: `Me` (sua conta)
- Quem tem acesso: `Anyone` ou `Anyone with the link` (para público) — atenção: se público, qualquer um poderá chamar o endpoint, a `API_KEY` ajuda a proteger gravações.
- Copie a URL de execução (deve terminar em `/exec`).

4) Atualizar URLs no projeto local
- No `dashboard.js` e `sheets.js` substitua a constante `API_URL` / `FORM_URL` pela URL `/exec` gerada.

Exemplo:

```js
const API_URL = 'https://script.google.com/macros/s/XXXXX/exec';
```

5) Teste rápido
- No `cadastrar.html`, preencha o campo `Nome do Trader` e outros campos.
- Em `sheets.js`, substitua `CLIENT_API_KEY` pelo mesmo valor de `API_KEY` que você colocou nas Script Properties.
- Clique em "Salvar" no formulário e verifique se a linha apareceu na planilha.
- No `dashboard.html`, clique em "Buscar no servidor" para carregar dados filtrados ou em "Buscar Ranking" para ver o ranking.

6) Segurança adicional (opcional)
- Para produção, considere não publicar o Apps Script como público; implemente autenticação (OAuth) ou mova a API para um backend (Cloud Run / Cloud Functions) com chaves e controle de taxa.
- Habilite logs de atividades e monitore quotas da sua conta Google.

7) Problemas comuns
- CORS: se o fetch falhar por CORS, publicar como Web App e testar com `fetch` simples (GET) deve funcionar. Se continuar com problemas, use um pequeno proxy backend ou implemente autenticação com token no cabeçalho.
- Erro de API Key: verifique se `CLIENT_API_KEY` em `sheets.js` corresponde exatamente à `API_KEY` das propriedades do script.

Se quiser, eu atualizo automaticamente as constantes `API_URL` e `FORM_URL` nos arquivos locais se você me passar a URL `/exec` publicada e o `API_KEY` desejado (recomendo não enviar chaves em canais públicos; você pode me dizer "vou colar a URL e chave agora" e eu atualizo localmente).
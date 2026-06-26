Guia: Como adicionar campos ao cadastro e integrá-los com Google Sheets

Objetivo
- Explicar passo a passo como adicionar um novo campo ao formulário de cadastro (`cadastrar.html`), enviar esse campo para o endpoint Google Apps Script (`sheets.js`), receber os dados em `dashboard.js`, popular filtros e tabelas, e testar/validar.

Estrutura do guia
1) Adicionar campo no formulário
2) Enviar o campo em `sheets.js`
3) Receber/mapear no Google Apps Script (Sheets)
4) Buscar e exibir em `dashboard.js`
5) Popular filtros e criar filtro específico
6) Testes, validação e boas práticas
7) Checklist rápido

---

1) Adicionar campo no formulário
- Local: `cadastrar.html`.
- Regras: toda entrada que será enviada ao Sheets deve ter o atributo `name` e um `id` únicos.

Exemplo (campo texto):

```html
<div class="form-group">
  <label for="minhaNota">Nota</label>
  <input id="minhaNota" name="minhaNota" type="text" placeholder="Observação curta">
</div>
```

Exemplo (select):

```html
<div class="form-group">
  <label for="categoria">Categoria</label>
  <select id="categoria" name="categoria">
    <option value="A">A</option>
    <option value="B">B</option>
  </select>
</div>
```

Observações:
- Use `required` se o campo for obrigatório.
- Para campos numéricos, use `type="number"` e `step` quando necessário.
- Para datas, prefira `type="date"` e converta no Apps Script se precisar de outro formato.

---

2) Enviar o campo em `sheets.js`
- Local: `sheets.js` — função que faz o `fetch` ao endpoint do Apps Script.
- Adicione a propriedade ao `payload` que já envia os demais campos.

Exemplo:

```js
const payload = {
  ativo: document.getElementById('ativo').value,
  entrada: document.getElementById('entrada').value,
  corretora: document.getElementById('corretora').value,
  minhaNota: document.getElementById('minhaNota').value // novo campo
};

fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
  .then(...)
```

Dicas:
- Valide os valores antes do envio (ex.: número > 0, texto não vazio).
- Em formulários grandes, monte o objeto dinamicamente usando `FormData` ou iterando sobre `elements`.

---

3) Receber/mapear no Google Apps Script (Sheets)
- No Apps Script (server), o `doPost(e)` recebe `e.postData.contents` (JSON string).
- Parseie o JSON e escreva as colunas na planilha.

Exemplo (Apps Script):

```js
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById('SUA_SHEET_ID');
    const sheet = ss.getSheetByName('Operacoes');

    // Exemplo: anexar uma linha com ordem de colunas definida
    sheet.appendRow([
      new Date(), // timestamp
      data.ativo || '',
      data.entrada || '',
      data.resultado || '',
      data.corretora || '',
      data.minhaNota || '' // novo campo
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

Mapeamento de colunas
- Garanta que a ordem de `appendRow` corresponda às colunas que você espera na planilha.
- Alternativa: escreva por chaves buscando a coluna correta (mais robusto, porém mais verboso).

Permissões e CORS
- Publique o Apps Script como "Executar como: eu" e "Acesso: Qualquer pessoa, mesmo anônima" (para testes públicos) ou configure autenticação adequada.

---

4) Buscar e exibir em `dashboard.js`
- `dashboard.js` já usa `fetch(API_URL)` para recuperar `responseObj.data` (array de objetos ou linhas).
- Para garantir que seu novo campo esteja disponível, verifique o formato do `response` do Apps Script. Se o Apps Script retorna objetos com chaves, você pode usar `getProp(op, 'minhaNota')` (padrão usado no projeto).

Exemplo de exibição rápida na tabela de últimas operações:

```js
// dentro de gridUltimasOperacoes
row.innerHTML = `
  <td>${getProp(op, 'ativo') || '-'}</td>
  <td>${getProp(op, 'estrategia') || '-'}</td>
  <td>${fmtUSD.format(parseFloat(getProp(op, 'entrada')||0))}</td>
  <td ${classeResultado}>${res || '-'}</td>
  <td><span class="badge-conta">${getProp(op, 'conta') || '-'}</span></td>
  <td>${getProp(op, 'corretora') || '-'}</td>
  <td>${getProp(op, 'minhaNota') || '-'}</td> <!-- novo campo -->
`;
```

Conversão/normalização
- Para números use `parseFloat` e trate `NaN`.
- Para datas, converta para `Date` se necessário.

---

5) Popular filtros e criar filtro específico
- Se quiser filtrar por esse campo, crie um `<select>` no `dashboard.html` com `id="filtroMinhaNota"` ou reutilize genericamente.
- Em `popularFiltro...` adicione coleta do valor único e popule o select.

Exemplo (popularFiltro genérico):

```js
// coleta únicos
const setNotas = new Set();
operacoes.forEach(op => setNotas.add((getProp(op,'minhaNota')||'Não informada').toString()));

// popula select
const select = document.getElementById('filtroMinhaNota');
select.innerHTML = '<option value="all">Todos</option>';
Array.from(setNotas).sort().forEach(v => {
  const opt = document.createElement('option'); opt.value = v; opt.textContent = v; select.appendChild(opt);
});
```

Filtro em `aplicarFiltros`:

```js
const filtroMinhaNota = document.getElementById('filtroMinhaNota');
const notaVal = filtroMinhaNota ? filtroMinhaNota.value : 'all';

// dentro do filter callback:
if (notaVal !== 'all' && (getProp(op,'minhaNota')||'') !== notaVal) return false;
```

---

6) Testes, validação e boas práticas
- Teste incremental: adicionar campo no formulário → enviar para Apps Script → verificar planilha → ajustar `dashboard.js`.
- Console: use `console.log(payload)` antes do fetch e `console.log(responseObj)` após o fetch.
- Normalize strings para comparação: `value.trim().toLowerCase()` quando fizer filtros case-insensitive.
- Trate valores faltantes com `|| ''`.
- Evite nomes de campo com espaços ou caracteres especiais; prefira `snake_case` ou `camelCase`.
- Para grandes volumes, pagine os dados do lado do Apps Script e peça apenas intervalos.

---

7) Checklist rápido antes de publicar
- [ ] Campo com `id` e `name` adicionados em `cadastrar.html`.
- [ ] `sheets.js` inclui o campo no `payload` enviado.
- [ ] Apps Script (`doPost`) parseia o JSON e escreve a coluna corretamente.
- [ ] `dashboard.js` consegue ler o campo e não quebra quando faltante.
- [ ] Filtro (se aplicável) foi populado e filtra corretamente.
- [ ] Testes manuais: submissão real, verificação na planilha, carregamento no dashboard.

---

Exemplos extras úteis
- Usar `FormData` para construir payload automaticamente:

```js
const form = document.getElementById('meuForm');
const fd = new FormData(form);
const obj = {};
for (const [k,v] of fd.entries()) obj[k] = v;
fetch(API_URL, { method: 'POST', body: JSON.stringify(obj) });
```

- Lidar com números e moeda no front:

```js
const entrada = parseFloat(document.getElementById('entrada').value.replace(',', '.')) || 0;
```

- Exemplo de normalização antes de armazenar (remover espaços):

```js
payload.minhaNota = payload.minhaNota ? payload.minhaNota.trim() : '';
```

---

Próximos passos sugeridos
- Adicionar exemplos de Apps Script se a planilha esperar cabeçalhos dinâmicos.
- Criar testes automatizados (simples) que chamem o endpoint e verifiquem a linha adicionada.
- Documentar quais nomes de campos já existem na sua planilha para evitar colisões.

---

Se quiser, eu adapto este arquivo ao formato do seu repositório (ex.: adiciono links diretos para `cadastrar.html`, `sheets.js`, `dashboard.js`) e já atualizo os snippets com os IDs exatos que você usa.

---

Implementação avançada (Apps Script): filtros, multi-usuário e ranqueamento

Objetivo: mostrar exemplos de `doGet` / `doPost` mais robustos — com suporte a parâmetros de consulta para filtrar no servidor, endpoint para ranqueamento por usuário e sugestões de segurança e escala.

1) Endpoints e parâmetros sugeridos
- `GET /exec?action=fetch&user=jose&start=2026-06-01&end=2026-06-25&corretora=IQ%20Option`
- `GET /exec?action=ranking&limit=10&start=2026-06-01&end=2026-06-25` — retorna top N usuários por lucro
- `POST /exec` — grava via `doPost` (como já tem)

2) `doGet` com filtro por query params (exemplo)

```js
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0000-\u036f]/g, ""));

  const params = e.parameter || {};
  const action = (params.action || 'fetch').toString().toLowerCase();
  const start = params.start ? new Date(params.start) : null;
  const end = params.end ? new Date(params.end) : null;
  const userFilter = params.user ? params.user.toString().toLowerCase().trim() : null;
  const corretoraFilter = params.corretora ? params.corretora.toString().toLowerCase().trim() : null;
  const limit = params.limit ? parseInt(params.limit, 10) : null;

  // transforma linhas em objetos usando cabeçalhos normalizados
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    rows.push(obj);
  }

  // aplicando filtros básicos (data, user, corretora)
  const filtered = rows.filter(r => {
    try {
      if (start || end) {
        const d = new Date(r['data'] || r['date'] || r['timestamp'] || r['hora'] || r['datahora']);
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
      if (userFilter && ('' + (r['usuario'] || '')).toLowerCase().trim() !== userFilter) return false;
      if (corretoraFilter && ('' + (r['corretora'] || '')).toLowerCase().trim() !== corretoraFilter) return false;
      return true;
    } catch (err) { return false; }
  });

  if (action === 'ranking') {
    // agregação por usuário: soma de lucro (aproximação usando entrada/payout/resultado)
    const agg = {};
    filtered.forEach(r => {
      const user = (r['usuario'] || 'anônimo').toString();
      const entrada = parseFloat(r['entrada']) || 0;
      const payout = parseFloat(r['payout']) || 0;
      const resultado = ('' + (r['resultado'] || '')).toUpperCase().trim();
      let lucro = 0;
      if (resultado === 'WIN') lucro = entrada * (payout / 100);
      else if (resultado === 'LOSS') lucro = -entrada;
      if (!agg[user]) agg[user] = { usuario: user, totalOperacoes: 0, lucro: 0 };
      agg[user].totalOperacoes++;
      agg[user].lucro += lucro;
    });

    const ranking = Object.values(agg).sort((a,b) => b.lucro - a.lucro);
    const result = limit ? ranking.slice(0, limit) : ranking;
    return ContentService.createTextOutput(JSON.stringify({ data: result })).setMimeType(ContentService.MimeType.JSON);
  }

  // default: retorno paginado simples (cliente pode pedir slices)
  let out = filtered;
  if (limit) out = filtered.slice(0, limit);
  return ContentService.createTextOutput(JSON.stringify({ data: out })).setMimeType(ContentService.MimeType.JSON);
}
```

3) Observações de segurança e autenticação
- O Apps Script público com "Qualquer pessoa" é conveniente para demos, mas inseguro para muitos seguidores: considere autenticação (OAuth) ou usar um backend (Cloud Functions) com chaves.
- Para permitir que apenas usuários autorizados escrevam (ou para saber quem escreveu), inclua um campo `usuario` e valide um `token`/`apiKey` no `doPost` (compare com `PropertiesService.getScriptProperties()` ou um sistema externo).

4) Performance e escalabilidade
- Apps Script tem limites de execução e cota (leitura/escrita em planilhas é relativamente caro). Para muitos seguidores (milhares), considere:
  - Migrar dados para Firestore / Firebase Realtime DB / BigQuery para consultas e agregações rápidas.
  - Manter o sheet apenas como "backup" ou para pequenos volumes de dados.
  - Implementar paginação e filtros no servidor para reduzir payloads.

5) Boas práticas para um sistema multi-usuário
- Normalizar e indexar colunas importantes (timestamp em ms, usuario normalizado).
- Evitar leituras completas do sheet; prefira ranges ou endpoints que filtrem por data/usuario.
- Usar cache (CacheService) para resultados de ranking computados com frequência.
- Registrar eventos de escrita (logs) e monitorar quotas.

6) Exemplos de chamadas do cliente
- Buscar operações de um usuário:
  `fetch(API_URL + "?action=fetch&user=jose&start=2026-06-01&end=2026-06-25")`
- Pegar top 5 usuários no mês:
  `fetch(API_URL + "?action=ranking&start=2026-06-01&end=2026-06-25&limit=5")`

Se quiser, eu implemento agora no seu `doGet`/`doPost` o código acima, adapto os cabeçalhos da sua planilha e atualizo o `dashboard.js` para consumir os novos endpoints (filtragem no servidor e rota de ranking). Diga se prefere que eu:

- A) Atualize diretamente o `INSTRUCOES_SHEETS.md` com exemplos já adaptados aos nomes de coluna exatos que você usa (recomendado) — eu posso fazer isso agora; ou
- B) Gere um arquivo `apps_script.gs` pronto para colar no editor do Google Apps Script (mais prático para deploy).

// Apps Script pronto para colar no editor do Google Apps Script
// Compatível com a planilha que tem 13 colunas (A..M) conforme seu exemplo

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    // Debug: log incoming envelope
    try { Logger.log('doPost envelope: ' + JSON.stringify(e)); } catch(z){}

    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        // Fallback: tenta usar parâmetros parseados (e.parameter) quando body não for JSON
        var params = e.parameter || {};
        for (var k in params) if (params.hasOwnProperty(k)) data[k] = params[k];

        // Se ainda vazio, tenta parsear manualmente urlencoded (ex: "a=1&b=2")
        if (Object.keys(data).length === 0 && typeof e.postData.contents === 'string') {
          var parts = e.postData.contents.split('&');
          parts.forEach(function(p){
            var kv = p.split('=');
            if (kv.length >= 1) {
              var key = decodeURIComponent(kv[0] || '');
              var val = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
              data[key] = val;
            }
          });
        }
      }
    } else {
      // Quando a requisição vier como form-encoded (ou em ambientes que bloqueiam body), lê parâmetros
      var params = e.parameter || {};
      for (var k in params) if (params.hasOwnProperty(k)) data[k] = params[k];
    }
    var dataAtual = new Date(); // timestamp

    // Validação simples de apiKey (defina API_KEY nas Script Properties)
    var expectedKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (expectedKey) {
      var providedKey = (data.api_key || data.apiKey || '') + '';
      if (providedKey !== expectedKey) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Invalid API key'})).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // opcional: validação simples
    if (!data.ativo) data.ativo = '';
    if (!data.usuario) data.usuario = '';

    sheet.appendRow([
      dataAtual,          // Coluna A: DATA
      data.ativo || '',   // Coluna B: ATIVO
      data.mercado || '', // Coluna C: MERCADO
      data.estrategia || '',    // Coluna D: ESTRATEGIA
      data.timeframe || '',     // Coluna E: TIMEFRAME
      data.direcao || '',       // Coluna F: DIRECAO
      data.conta || '',         // Coluna G: CONTA
      data.entrada || '',       // Coluna H: ENTRADA
      data.payout || '',        // Coluna I: PAYOUT
      data.resultado || '',     // Coluna J: RESULTADO
      data.observacao || '',    // Coluna K: OBSERVAÇÃO
      data.corretora || '',     // Coluna L: CORRETORA
      data.usuario || ''        // Coluna M: USUARIO
    ]);

    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 1) return ContentService.createTextOutput(JSON.stringify({data:[]})).setMimeType(ContentService.MimeType.JSON);

  var headers = data[0].map(function(h){ return h.toString().toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9_\s]/g,''); });
  var params = e.parameter || {};
  var action = (params.action || 'fetch').toString().toLowerCase();
  var start = params.start ? new Date(params.start) : null;
  var end = params.end ? new Date(params.end) : null;
  var userFilter = params.user ? params.user.toString().toLowerCase().trim() : null;
  var corretoraFilter = params.corretora ? params.corretora.toString().toLowerCase().trim() : null;
  var estrategiaFilter = params.estrategia ? params.estrategia.toString().toLowerCase().trim() : null;
  var contaFilter = params.conta ? params.conta.toString().toLowerCase().trim() : null;
  var resultadoFilter = params.resultado ? params.resultado.toString().toLowerCase().trim() : null;
  var mercadoFilter = params.mercado ? params.mercado.toString().toLowerCase().trim() : null;
  var timeframeFilter = params.timeframe ? params.timeframe.toString().toLowerCase().trim() : null;
  var limit = params.limit ? parseInt(params.limit, 10) : null;

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    rows.push(obj);
  }

  var filtered = rows.filter(function(r){
    try {
      if (start || end) {
        var d = new Date(r['data'] || r['date'] || r['timestamp'] || r['hora'] || r['datahora']);
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
        if (userFilter && ('' + (r['usuario'] || '')).toLowerCase().trim() !== userFilter) return false;
        if (corretoraFilter && ('' + (r['corretora'] || '')).toLowerCase().trim() !== corretoraFilter) return false;
        if (estrategiaFilter && ('' + (r['estrategia'] || '')).toLowerCase().trim() !== estrategiaFilter) return false;
        if (contaFilter && ('' + (r['conta'] || '')).toLowerCase().trim() !== contaFilter) return false;
        if (resultadoFilter && ('' + (r['resultado'] || '')).toLowerCase().trim() !== resultadoFilter) return false;
        if (mercadoFilter && ('' + (r['mercado'] || '')).toLowerCase().trim() !== mercadoFilter) return false;
        if (timeframeFilter && ('' + (r['timeframe'] || '')).toLowerCase().trim() !== timeframeFilter) return false;
      return true;
    } catch (e) { return false; }
  });

  if (action === 'ranking') {
    var agg = {};
    filtered.forEach(function(r){
      var user = (r['usuario'] || 'anon').toString();
      var entrada = parseFloat(r['entrada']) || 0;
      var payout = parseFloat(r['payout']) || 0;
      var resultado = ('' + (r['resultado'] || '')).toUpperCase().trim();
      var lucro = 0;
      if (resultado === 'WIN') lucro = entrada * (payout / 100);
      else if (resultado === 'LOSS') lucro = -entrada;
      if (!agg[user]) agg[user] = { usuario: user, totalOperacoes: 0, lucro: 0 };
      agg[user].totalOperacoes++;
      agg[user].lucro += lucro;
    });
    var ranking = Object.keys(agg).map(function(k){ return agg[k]; }).sort(function(a,b){ return b.lucro - a.lucro; });
    var result = limit ? ranking.slice(0, limit) : ranking;
    return ContentService.createTextOutput(JSON.stringify({data: result})).setMimeType(ContentService.MimeType.JSON);
  }

  var out = filtered;
  if (limit) out = filtered.slice(0, limit);
  return ContentService.createTextOutput(JSON.stringify({data: out})).setMimeType(ContentService.MimeType.JSON);
}

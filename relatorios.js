const RELATORIOS_SHEET_URL = 'https://script.google.com/macros/s/AKfycbx66prYiNh36_JKyOjnHv94m8GqwOtzPtgqyikF1bJZVujiPLFd8kXb06YQm2yMaLvT/exec';
let relatoriosData = [];
let charts = {};

window.addEventListener('DOMContentLoaded', () => {
  bindRelatoriosEvents();
  fetchRelatoriosData();
});

function bindRelatoriosEvents() {
  document.getElementById('filterStart').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterEnd').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterStrategy').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterBroker').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterAccount').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterMarket').addEventListener('change', applyRelatoriosFilters);
  document.getElementById('filterTimeframe').addEventListener('change', applyRelatoriosFilters);
}

async function fetchRelatoriosData() {
  try {
    const response = await fetch(RELATORIOS_SHEET_URL, { method: 'GET' });
    const data = await response.json();
    relatoriosData = normalizeRelatoriosRows(data.data || data.rows || []);
    populateFilterOptions(relatoriosData);
    applyRelatoriosFilters();
  } catch (error) {
    console.error('Erro ao carregar dados de relatórios:', error);
  }
}

function normalizeRelatoriosRows(rows) {
  function parseNumber(raw) {
    if (raw === undefined || raw === null || raw === '') return 0;
    if (typeof raw === 'number') return raw;
    const s = String(raw).replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function normalizePayoutPercent(raw) {
    const value = parseNumber(raw);
    if (!Number.isFinite(value)) return 0;
    return value > 1 ? value : value * 100;
  }

  function normalizeDateOnly(raw) {
    if (!raw) return '';
    // Try Date parse
    try {
      // If already Date
      if (raw instanceof Date) {
        return raw.toISOString().slice(0, 10);
      }
      // common formats: "YYYY/MM/DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
      const str = String(raw).trim();
      const m = str.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      const d = new Date(str);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    } catch (e) {}
    return '';
  }

  return rows.map(row => {
    const usuario = row.usuario || row.nome || row.Usuario || '';
    const resultadoRaw = row.resultado || row.result || '';
    const resultado = String(resultadoRaw).toLowerCase();
    const entrada = parseNumber(row.entrada || row.amount || row.valor);
    const payout = normalizePayoutPercent(row.payout || row.pay || 0);
    // calcula lucro se não vier na linha
    let lucro = parseNumber(row.lucro || row.profit || row.lucro_bruto || 0);
    if (!lucro) {
      if (resultado.includes('win') || resultado.includes('ganhou') || resultado === 'w') {
        lucro = +(entrada * (payout / 100));
      } else if (resultado.includes('loss') || resultado.includes('perdeu') || resultado === 'l') {
        lucro = -entrada;
      }
    }

    return {
      rawDate: row.data || row.date || row.DATA || row.Data || '',
      data: normalizeDateOnly(row.data || row.date || row.DATA || row.Data || row.rawDate || ''),
      usuario: usuario,
      ativo: row.ativo || row.ticker || '',
      estrategia: row.estrategia || row.strategy || 'Desconhecida',
      resultado: resultadoRaw || 'N/A',
      lucro: +(+lucro).toFixed(2),
      corretora: row.corretora || row.broker || row.Corretora || 'Outra',
      conta: (row.conta || row.account || row.CONTA || 'real').toString().toLowerCase(),
      mercado: row.mercado || row.market || 'Geral',
      timeframe: row.timeframe || row.tf || 'N/A',
      entrada: entrada,
      payout: payout,
      tipo: row.tipo || row.type || 'Swing'
    };
  });
}

function populateFilterOptions(rows) {
  const strategySelect = document.getElementById('filterStrategy');
  const brokerSelect = document.getElementById('filterBroker');
  const marketSelect = document.getElementById('filterMarket');
  const timeframeSelect = document.getElementById('filterTimeframe');

  const uniqueValues = {
    estrategia: new Set(['all']),
    corretora: new Set(['all']),
    mercado: new Set(['all']),
    timeframe: new Set(['all'])
  };

  rows.forEach(row => {
    uniqueValues.estrategia.add(row.estrategia);
    uniqueValues.corretora.add(row.corretora);
    uniqueValues.mercado.add(row.mercado);
    uniqueValues.timeframe.add(row.timeframe);
  });

  fillSelect(strategySelect, uniqueValues.estrategia);
  fillSelect(brokerSelect, uniqueValues.corretora);
  fillSelect(marketSelect, uniqueValues.mercado);
  fillSelect(timeframeSelect, uniqueValues.timeframe);
}

function fillSelect(select, values) {
  select.innerHTML = '<option value="all">Todas</option>';
  Array.from(values)
    .filter(v => v && v !== 'all')
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    .forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
}

function applyRelatoriosFilters() {
  const filtered = relatoriosData.filter(row => {
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;
    const strategy = document.getElementById('filterStrategy').value;
    const broker = document.getElementById('filterBroker').value;
    const account = document.getElementById('filterAccount').value;
    const market = document.getElementById('filterMarket').value;
    const timeframe = document.getElementById('filterTimeframe').value;

    if (start && row.data < start) return false;
    if (end && row.data > end) return false;
    if (strategy !== 'all' && row.estrategia !== strategy) return false;
    if (broker !== 'all' && row.corretora !== broker) return false;
    if (account !== 'all' && row.conta !== account) return false;
    if (market !== 'all' && row.mercado !== market) return false;
    if (timeframe !== 'all' && row.timeframe !== timeframe) return false;
    return true;
  });

  renderRelatoriosSummary(filtered);
  renderRelatoriosCharts(filtered);
  renderRelatoriosTables(filtered);
}

function renderRelatoriosSummary(rows) {
  const total = rows.length;
  const winsRows = rows.filter(r => String(r.resultado).toLowerCase().includes('win') || String(r.resultado).toLowerCase().includes('ganhou') || String(r.resultado).toLowerCase() === 'w');
  const lossRows = rows.filter(r => String(r.resultado).toLowerCase().includes('loss') || String(r.resultado).toLowerCase().includes('perdeu') || String(r.resultado).toLowerCase() === 'l');
  const win = winsRows.length;
  const loss = lossRows.length;
  const grossProfit = rows.filter(r => r.lucro > 0).reduce((sum, r) => sum + r.lucro, 0);
  const lossAmount = rows.filter(r => r.lucro < 0).reduce((sum, r) => sum + r.lucro, 0);
  const netProfit = grossProfit + lossAmount;
  const winRate = total === 0 ? 0 : Math.round((win / total) * 100);
  const avgWin = win === 0 ? 0 : (grossProfit / win);
  const avgLoss = loss === 0 ? 0 : (Math.abs(lossAmount) / loss);
  const payoff = (avgLoss === 0) ? (avgWin === 0 ? 0 : Number(avgWin.toFixed(2))) : Number((avgWin / avgLoss).toFixed(2));
  const expectancy = total === 0 ? 0 : Number((((win / total) * avgWin) - ((loss / total) * avgLoss)).toFixed(2));
  const totalInvested = rows.reduce((s, r) => s + (parseFloat(r.entrada) || 0), 0);
  const roi = totalInvested === 0 ? 0 : Number(((netProfit / totalInvested) * 100).toFixed(2));

  document.getElementById('summaryTotal').textContent = total;
  document.getElementById('summaryWin').textContent = win;
  document.getElementById('summaryLoss').textContent = loss;
  document.getElementById('summaryWinRate').textContent = `${winRate}%`;
  document.getElementById('summaryNetProfit').textContent = formatCurrency(netProfit);
  document.getElementById('summaryGrossProfit').textContent = formatCurrency(grossProfit);
  document.getElementById('summaryLossAmount').textContent = formatCurrency(lossAmount);
  document.getElementById('summaryROI').textContent = `${roi}%`;
  document.getElementById('summaryPayoff').textContent = payoff.toFixed(2);
  document.getElementById('summaryExpectancy').textContent = expectancy;
}

function renderRelatoriosCharts(rows) {
  renderTimeSeriesChart('chartBankRoll', buildBankrollSeries(rows), 'Evolução da Banca', 'rgb(245, 158, 11)');
  renderTimeSeriesChart('chartDailyProfit', buildDailyProfitSeries(rows), 'Lucro Diário', 'rgb(59, 130, 246)');
  renderTimeSeriesChart('chartCumulative', buildCumulativeSeries(rows), 'Lucro Acumulado', 'rgb(16, 185, 129)');
  renderTimeSeriesChart('chartTradesPerDay', buildTradesPerDaySeries(rows), 'Operações por Dia', 'rgb(249, 115, 22)');
  renderDoughnutChart('chartWinLoss', buildWinLossData(rows), ['WIN', 'LOSS'], ['#22c55e', '#ef4444']);
}

function buildBankrollSeries(rows) {
  const sorted = [...rows].sort((a, b) => a.data.localeCompare(b.data));
  let current = 0;
  const labels = [];
  const data = [];
  sorted.forEach(row => {
    current += row.lucro;
    labels.push(row.data);
    data.push(current.toFixed(2));
  });
  return { labels, data };
}

function buildDailyProfitSeries(rows) {
  const grouped = groupBy(rows, 'data');
  const labels = Object.keys(grouped).sort();
  const data = labels.map(label => grouped[label].reduce((sum, r) => sum + r.lucro, 0).toFixed(2));
  return { labels, data };
}

function buildCumulativeSeries(rows) {
  return buildBankrollSeries(rows);
}

function buildTradesPerDaySeries(rows) {
  const grouped = groupBy(rows, 'data');
  const labels = Object.keys(grouped).sort();
  const data = labels.map(label => grouped[label].length);
  return { labels, data };
}

function buildWinLossData(rows) {
  const win = rows.filter(r => String(r.resultado).toLowerCase().includes('win')).length;
  const loss = rows.filter(r => String(r.resultado).toLowerCase().includes('loss')).length;
  return [win, loss];
}

function renderTimeSeriesChart(canvasId, series, label, borderColor) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label,
        data: series.data,
        borderColor,
        backgroundColor: `${borderColor}33`,
        fill: true,
        tension: 0.25,
        pointRadius: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {legend: {display: false}},
      scales: {
        x: { grid: { color: 'rgba(148,163,184,.1)'}, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(148,163,184,.1)'}, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function renderDoughnutChart(canvasId, labels, data, colors) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } } }
  });
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || 'Desconhecido';
    acc[value] = acc[value] || [];
    acc[value].push(row);
    return acc;
  }, {});
}

function renderRelatoriosTables(rows) {
  fillTable('tableStrategy', summarizePerformance(rows, 'estrategia'));
  fillTable('tableBroker', summarizePerformance(rows, 'corretora'));
  fillTable('tableMarket', summarizePerformance(rows, 'mercado'));
  fillTable('tableTimeframe', summarizePerformance(rows, 'timeframe'));
  fillTable('tableAccount', summarizePerformance(rows, 'conta'));
  fillAdvancedTable(rows);
  fillRankingTable(rows);
  fillFeedTable(rows);
  fillInsights(rows);
}

function summarizePerformance(rows, key) {
  const grouped = groupBy(rows, key);
  return Object.entries(grouped)
    .map(([value, items]) => {
      const win = items.filter(r => String(r.resultado).toLowerCase().includes('win')).length;
      const loss = items.filter(r => String(r.resultado).toLowerCase().includes('loss')).length;
      const ops = items.length;
      const profit = items.reduce((sum, r) => sum + r.lucro, 0);
      const winRate = ops === 0 ? 0 : Math.round((win / ops) * 100);
      return { value, ops, win, loss, winRate, profit };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);
}

function fillTable(tableId, rows) {
  const body = document.getElementById(tableId);
  body.innerHTML = rows.map(row => `
    <tr>
      <td>${row.value}</td>
      <td>${row.ops}</td>
      <td>${row.win}</td>
      <td>${row.loss}</td>
      <td>${row.winRate}%</td>
      <td>${formatCurrency(row.profit)}</td>
    </tr>`).join('');
}

function fillAdvancedTable(rows) {
  const unique = [...new Set(rows.map(r => r.estrategia))].slice(0, 5);
  const body = document.getElementById('tableAdvanced');
  body.innerHTML = unique.map((strategy, index) => {
    const items = rows.filter(r => r.estrategia === strategy);
    const profit = items.reduce((sum, r) => sum + r.lucro, 0);
    const win = items.filter(r => String(r.resultado).toLowerCase().includes('win')).length;
    const loss = items.filter(r => String(r.resultado).toLowerCase().includes('loss')).length;
    return `
      <tr>
        <td><strong>${strategy}</strong></td>
        <td>Ops: ${items.length}</td>
        <td>Win: ${win}</td>
        <td>Loss: ${loss}</td>
        <td>${formatCurrency(profit)}</td>
      </tr>`;
  }).join('');
}

function fillRankingTable(rows) {
  if (!rows.length) {
    document.getElementById('tableRanking').innerHTML = '<tr><td colspan="8">Sem dados</td></tr>';
    return;
  }
  const grouped = rows.reduce((acc, row) => {
    const user = row.usuario || 'Sem usuário';
    const entry = acc[user] || { usuario: user, ops: 0, win: 0, loss: 0, profit: 0 };
    entry.ops += 1;
    entry.profit += row.lucro;
    if (String(row.resultado).toLowerCase().includes('win')) entry.win += 1;
    if (String(row.resultado).toLowerCase().includes('loss')) entry.loss += 1;
    acc[user] = entry;
    return acc;
  }, {});

  const ranking = Object.values(grouped)
    .map(item => ({ ...item, winRate: item.ops === 0 ? 0 : Math.round((item.win / item.ops) * 100) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  document.getElementById('tableRanking').innerHTML = ranking.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.usuario}</td>
      <td>${item.ops}</td>
      <td>${item.win}</td>
      <td>${item.loss}</td>
      <td>${item.winRate}%</td>
      <td>${formatCurrency(item.profit)}</td>
      <td>${item.winRate}%</td>
    </tr>`).join('');
}

function fillFeedTable(rows) {
  const body = document.getElementById('tableFeed');
  body.innerHTML = rows.slice(-12).reverse().map(row => `
    <tr>
      <td>${row.data}</td>
      <td>${row.usuario}</td>
      <td>${row.ativo}</td>
      <td>${row.estrategia}</td>
      <td>${row.resultado}</td>
      <td>${formatCurrency(row.lucro)}</td>
      <td>${row.corretora}</td>
      <td>${row.conta}</td>
    </tr>`).join('');
}

function fillInsights(rows) {
  const total = rows.length;
  const win = rows.filter(r => String(r.resultado).toLowerCase().includes('win')).length;
  const loss = rows.filter(r => String(r.resultado).toLowerCase().includes('loss')).length;
  const profit = rows.reduce((sum, r) => sum + r.lucro, 0);
  const bestWinner = rows.filter(r => r.lucro > 0).sort((a, b) => b.lucro - a.lucro)[0];
  const worstLoss = rows.filter(r => r.lucro < 0).sort((a, b) => a.lucro - b.lucro)[0];
  const body = document.getElementById('tableInsights');
  body.innerHTML = `
    <tr><td>Total de operações</td><td>${total}</td></tr>
    <tr><td>Taxa de vitória</td><td>${total ? Math.round((win / total) * 100) : 0}%</td></tr>
    <tr><td>Melhor trade</td><td>${bestWinner ? formatCurrency(bestWinner.lucro) : 'N/A'}</td></tr>
    <tr><td>Pior trade</td><td>${worstLoss ? formatCurrency(worstLoss.lucro) : 'N/A'}</td></tr>
    <tr><td>Maior corretora</td><td>${getTopCategory(rows, 'corretora')}</td></tr>
    <tr><td>Mais usada</td><td>${getTopCategory(rows, 'estrategia')}</td></tr>
  `;
}

function getTopCategory(rows, key) {
  const grouped = groupBy(rows, key);
  const sorted = Object.entries(grouped).map(([value, items]) => ({ value, count: items.length })).sort((a, b) => b.count - a.count);
  return sorted.length ? `${sorted[0].value} (${sorted[0].count})` : 'N/A';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

// URL de execução da API do Google Apps Script (ligada à sua Planilha de Operações)
const API_URL = "https://script.google.com/macros/s/AKfycbx66prYiNh36_JKyOjnHv94m8GqwOtzPtgqyikF1bJZVujiPLFd8kXb06YQm2yMaLvT/exec";
let meuGrafico = null; // Guarda a instância global do gráfico do Chart.js para evitar bugs de sobreposição
let operacoesBrutas = []; // Array global que armazena os dados vindos do Sheets para permitir filtragem rápida

// Objeto de formatação padrão para Dólar Americano (USD - $)
const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// Evento disparado assim que a estrutura da página HTML estiver totalmente carregada
document.addEventListener("DOMContentLoaded", () => {
    buscarDadosDoSheets(); // Faz a requisição inicial para trazer os dados da planilha

    // Captura os elementos HTML dos seletores de filtros no painel
    const filtroResultado = document.getElementById('filtroResultado');
    const filtroConta = document.getElementById('filtroConta');
    const filtroEstrategia = document.getElementById('filtroEstrategia');
    const filtroCorretora = document.getElementById('filtroCorretora');
    const btnReset = document.getElementById('btnResetFilters');

    // Adiciona o evento 'change' (mudança de opção) a cada filtro para processar os dados em tempo real
    [filtroResultado, filtroConta, filtroEstrategia, filtroCorretora].forEach(el => {
        if (el) el.addEventListener('change', aplicarFiltros);
    });

    // Configuração do botão de resetar filtros: volta todos para a opção padrão ("all")
    if (btnReset) btnReset.addEventListener('click', () => {
        if (filtroResultado) filtroResultado.value = 'all';
        if (filtroConta) filtroConta.value = 'all';
        if (filtroEstrategia) filtroEstrategia.value = 'all';
        if (filtroCorretora) filtroCorretora.value = 'all';
        aplicarFiltros(); // Reaplica a listagem mostrando tudo limpo
    });

    // Hooks para ranking (server-side)
    const btnFetchRanking = document.getElementById('btnFetchRanking');
    if (btnFetchRanking) btnFetchRanking.addEventListener('click', fetchRanking);
    const btnReloadPage = document.getElementById('btnReloadPage');
    if (btnReloadPage) btnReloadPage.addEventListener('click', buscarDadosDoSheets);
});

// Busca dados filtrados diretamente no servidor (doGet?action=fetch&...)
async function fetchWithFilters() {
    const resFilter = document.getElementById('filtroResultado')?.value || 'all';
    const contaFilter = document.getElementById('filtroConta')?.value || 'all';
    const estFilter = document.getElementById('filtroEstrategia')?.value || 'all';
    const corFilter = document.getElementById('filtroCorretora')?.value || 'all';

    const params = new URLSearchParams();
    params.set('action', 'fetch');
    if (resFilter && resFilter !== 'all') params.set('resultado', resFilter);
    if (contaFilter && contaFilter !== 'all') params.set('conta', contaFilter);
    if (estFilter && estFilter !== 'all') params.set('estrategia', estFilter);
    if (corFilter && corFilter !== 'all') params.set('corretora', corFilter);

    const url = API_URL + '?' + params.toString();

    try {
        const r = await fetch(url, { method: 'GET' });
        if (!r.ok) throw new Error('Erro ao buscar dados no servidor');
        const obj = await r.json();
        const data = obj.data || [];
        operacoesBrutas = data;
        // repopula filtros locais (caso novos valores apareçam)
        popularFiltroResultado(operacoesBrutas);
        popularFiltroConta(operacoesBrutas);
        popularFiltroEstrategias(operacoesBrutas);
        popularFiltroCorretora(operacoesBrutas);
        processarEDisplayDados(operacoesBrutas);
    } catch (err) {
        console.error('fetchWithFilters error', err);
        alert('Erro ao buscar dados no servidor. Veja o console.');
    }
}

// Função assíncrona responsável por buscar o histórico armazenado no Google Sheets
async function buscarDadosDoSheets() {
    const statusDiv = document.querySelector('.status');
    statusDiv.textContent = "Carregando..."; // Alerta visual de carregamento
    statusDiv.style.background = "var(--bg-card, #222)";

    try {
        let response = null;
        const maxAttempts = 3; // Mecanismo de resiliência: tenta a conexão até 3 vezes se falhar
        for (let i = 0; i < maxAttempts; i++) {
            response = await fetch(API_URL, { method: "GET", redirect: "follow" });
            if (response.ok) break; // Se a resposta for bem-sucedida, sai do loop de tentativas
        }

        if (!response || !response.ok) {
            throw new Error("Resposta da rede não foi satisfatória");
        }

        const responseObj = await response.json();
        const operacoes = responseObj.data || [];
        operacoesBrutas = operacoes; // Alimenta a nossa memória de dados brutos
        
        // Alimenta dinamicamente os filtros com os valores existentes na planilha
        popularFiltroResultado(operacoesBrutas);
        popularFiltroConta(operacoesBrutas);
        popularFiltroEstrategias(operacoesBrutas);
        popularFiltroCorretora(operacoesBrutas);
        
        aplicarFiltros(); // Executa o fluxo e monta o layout visual do Dashboard
        statusDiv.textContent = "Online"; // Painel conectado com sucesso
        statusDiv.style.background = "";
    } catch (error) {
        console.error("Erro ao buscar dados do Sheets:", error);
        statusDiv.textContent = "Erro de Conexão";
        statusDiv.style.backgroundColor = "#ff4d4d"; // Sinalização visual de falha de rede
    }
}

// Função principal que calcula todas as métricas matemáticas e desenha a interface do Dashboard
function processarEDisplayDados(operacoes) {
    // Tratamento de segurança: se não houver operações registradas ou filtradas, zera tudo na tela
    if (!operacoes || operacoes.length === 0) {
        document.getElementById("totalOperacoes").textContent = 0;
        document.getElementById("winRate").textContent = `0%`;
        document.getElementById("wins").textContent = 0;
        document.getElementById("losses").textContent = 0;
        document.getElementById("lucroTotal").textContent = fmtUSD.format(0);
        document.getElementById("saldoAtual").textContent = fmtUSD.format(0);
        document.getElementById("tabelaEstrategias").innerHTML = "";
        document.getElementById("ultimasOperacoes").innerHTML = "";
        if (meuGrafico) { meuGrafico.destroy(); meuGrafico = null; } // Elimina o gráfico se existir
        return;
    }

    // Variáveis acumuladoras para métricas gerais das tabelas e estatísticas de WinRate
    let totalOperacoes = operacoes.length;
    let wins = 0;
    let losses = 0;
    let lucroTotal = 0; // Armazenará estritamente os lucros das operações em conta REAL

    const resumoEstrategias = {};
    const resumoCorretoras = {};
    
    // --- DEFINIÇÃO DA SUA BANCA INICIAL ---
    const bancaInicial = 100.00; // Altere este valor para a quantia real que depositou na banca inicial

    // Configuração dos arrays para alimentar o gráfico de evolução financeira de linha
    let saldoAcumulado = bancaInicial; // O acumulador financeiro começa diretamente com o valor depositado
    const dadosGrafico = [bancaInicial]; // O primeiro ponto visual do gráfico será a Banca Inicial
    const labelsGrafico = ["Início"]; // Label da coordenada zero

    // Varredura de cada uma das operações para compilar os dados analíticos
    operacoes.forEach((op, index) => {
        // Função auxiliar blindada para capturar dados independente de letras maiúsculas/minúsculas vindas da planilha
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";

        const estrategia = getProp(op, 'estrategia') || "Não informada";
        const conta = (getProp(op, 'conta') || "").toString().toLowerCase().trim();
        const entrada = getProp(op, 'entrada');
        const payout = getProp(op, 'payout');
        const resultado = getProp(op, 'resultado').toString().toUpperCase().trim();

        const valorEntrada = parseFloat(entrada) || 0;
        const valorPayout = parseFloat(payout) || 0;

        // Agrupamento estatístico por Estratégia
        if (!resumoEstrategias[estrategia]) {
            resumoEstrategias[estrategia] = { total: 0, wins: 0, losses: 0 };
        }
        resumoEstrategias[estrategia].total++;

        // Agrupamento estatístico por Corretora
        const corretora = getProp(op, 'corretora') || 'Não informada';
        if (!resumoCorretoras[corretora]) {
            resumoCorretoras[corretora] = { total: 0, wins: 0, losses: 0 };
        }
        resumoCorretoras[corretora].total++;

        // Cálculo individual do lucro/perda baseado no resultado da linha
        let lucroDaOperacao = 0;
        if (resultado === "WIN") {
            resumoEstrategias[estrategia].wins++;
            resumoCorretoras[corretora].wins++;
            lucroDaOperacao = valorEntrada * (valorPayout / 100); // Retorno líquido do Payout
            wins++;
        } else if (resultado === "LOSS") {
            resumoEstrategias[estrategia].losses++;
            resumoCorretoras[corretora].losses++;
            lucroDaOperacao = -valorEntrada; // Perda total do valor de entrada
            losses++;
        }

        // REQUISITO FINANCEIRO CRUCIAL: O Saldo Real e o Gráfico só consideram movimentações se forem feitas em conta "real"
        if (conta === "real") {
            lucroTotal += lucroDaOperacao; // Acumula o rendimento puro obtido nas operações
            saldoAcumulado += lucroDaOperacao; // Move a banca para cima (WIN) ou para baixo (LOSS)
            
            dadosGrafico.push(saldoAcumulado); // Salva o novo ponto financeiro da banca no gráfico
            labelsGrafico.push(`Op ${index + 1}`); // Adiciona a identificação do eixo X
        }
    });

    // Cálculo da taxa de assertividade global baseada na amostragem atual
    let winRate = totalOperacoes > 0 ? ((wins / totalOperacoes) * 100).toFixed(1) : 0;

    // Cálculo final do saldo atual real da conta (Banca Base + Resultados Líquidos)
    const saldoAtualReal = bancaInicial + lucroTotal;

    // Atualização dos textos nos Cards Principais na interface do Dashboard
    document.getElementById("totalOperacoes").textContent = totalOperacoes;
    document.getElementById("winRate").textContent = `${winRate}%`;
    document.getElementById("wins").textContent = wins;
    document.getElementById("losses").textContent = losses;

    // DISTINÇÃO FINANCEIRA: O Lucro mostra o resultado operacional puro e o Saldo mostra a saúde atual da banca
    document.getElementById("lucroTotal").textContent = fmtUSD.format(lucroTotal);
    document.getElementById("saldoAtual").textContent = fmtUSD.format(saldoAtualReal);

    // Inicializa ou atualiza o gráfico linear com a evolução da Banca Real em Dólar
    inicializarGrafico(labelsGrafico, dadosGrafico);

    // Montagem dinâmica da Tabela de Desempenho por Estratégias
    const tabelaEstrategiasBody = document.getElementById("tabelaEstrategias");
    tabelaEstrategiasBody.innerHTML = ""; 

    Object.keys(resumoEstrategias).forEach(est => {
        const dadosEst = resumoEstrategias[est];
        const wrEst = dadosEst.total > 0 ? ((dadosEst.wins / dadosEst.total) * 100).toFixed(1) : 0;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${est}</strong></td>
            <td>${dadosEst.total}</td>
            <td style="color: #00e676;">${dadosEst.wins}</td>
            <td style="color: #ff3d00;">${dadosEst.losses}</td>
            <td><strong>${wrEst}%</strong></td>
        `;
        tabelaEstrategiasBody.appendChild(row);
    });

    // Montagem dinâmica da Tabela de Desempenho por Corretoras
    const tabelaCorretorasBody = document.getElementById("tabelaCorretoras");
    if (tabelaCorretorasBody) {
        tabelaCorretorasBody.innerHTML = "";

        Object.keys(resumoCorretoras).forEach(cor => {
            const dadosCor = resumoCorretoras[cor];
            const wrCor = dadosCor.total > 0 ? ((dadosCor.wins / dadosCor.total) * 100).toFixed(1) : 0;
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${cor}</strong></td>
                <td>${dadosCor.total}</td>
                <td style="color: #00e676;">${dadosCor.wins}</td>
                <td style="color: #ff3d00;">${dadosCor.losses}</td>
                <td><strong>${wrCor}%</strong></td>
            `;
            tabelaCorretorasBody.appendChild(row);
        });
    }

    // Isola e inverte a ordem para exibir apenas as últimas 5 operações cadastradas na tabela principal
    const tabelaUltimasBody = document.getElementById("ultimasOperacoes");
    tabelaUltimasBody.innerHTML = "";

    const ultimasCinco = [...operacoes].reverse().slice(0, 5);
    gridUltimasOperacoes(ultimasCinco, tabelaUltimasBody);
}

// Filtra a matriz bruta de operações de acordo com as restrições selecionadas nos menus suspensos
function aplicarFiltros() {
    const filtroResultado = document.getElementById('filtroResultado');
    const filtroConta = document.getElementById('filtroConta');
    const filtroEstrategia = document.getElementById('filtroEstrategia');
    const filtroCorretora = document.getElementById('filtroCorretora');

    const resVal = filtroResultado ? filtroResultado.value : 'all';
    const contaVal = filtroConta ? filtroConta.value : 'all';
    const estVal = filtroEstrategia ? filtroEstrategia.value : 'all';
    const corretoraVal = filtroCorretora ? filtroCorretora.value : 'all';

    // Varre o array nativo aplicando os critérios lógicos de exclusão
    const filtrado = operacoesBrutas.filter(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        const resultado = (getProp(op, 'resultado') || '').toString().toUpperCase().trim();
        const conta = (getProp(op, 'conta') || '').toString().toLowerCase().trim();
        const estrategia = (getProp(op, 'estrategia') || 'Não informada').toString();
        const corretora = (getProp(op, 'corretora') || 'Não informada').toString();
        if (resVal !== 'all' && resultado !== resVal) return false;
        if (contaVal !== 'all' && conta !== contaVal) return false;
        if (estVal !== 'all' && estrategia !== estVal) return false;
        if (corretoraVal !== 'all' && corretora !== corretoraVal) return false;
        return true; // Mantém o item caso ele passe por todos os testes
    });

    processarEDisplayDados(filtrado); // Envia a lista filtrada para reconstruir a tela
}

// Mapeia as estratégias registradas na planilha e cria as opções dinamicamente no seletor HTML do filtro
function popularFiltroResultado(operacoes) {
    const select = document.getElementById('filtroResultado');
    if (!select) return;
    const resultados = new Set();
    operacoes.forEach(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        const resultado = (getProp(op, 'resultado') || '').toString().toUpperCase().trim();
        if (resultado) resultados.add(resultado);
    });

    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Todos resultados</option>';
    Array.from(resultados).sort().forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        select.appendChild(opt);
    });
    select.value = current;
}

function popularFiltroConta(operacoes) {
    const select = document.getElementById('filtroConta');
    if (!select) return;
    const contas = new Set();
    operacoes.forEach(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        const conta = (getProp(op, 'conta') || '').toString().toLowerCase().trim();
        if (conta) contas.add(conta);
    });

    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Todas contas</option>';
    Array.from(contas).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        select.appendChild(opt);
    });
    select.value = current;
}

function popularFiltroEstrategias(operacoes) {
    const select = document.getElementById('filtroEstrategia');
    if (!select) return;
    const estrategias = new Set(); // O objeto Set impede a duplicação de nomes de estratégias
    operacoes.forEach(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        const estrategia = (getProp(op, 'estrategia') || 'Não informada').toString();
        estrategias.add(estrategia);
    });

    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Todas estratégias</option>';
    Array.from(estrategias).sort().forEach(e => {
        const opt = document.createElement('option');
        opt.value = e;
        opt.textContent = e;
        select.appendChild(opt);
    });
    select.value = current; // Preserva o filtro que já estava selecionado antes de atualizar
}

// Mapeia as corretoras cadastradas na planilha e monta de forma automática as opções do seletor de corretoras
function popularFiltroCorretora(operacoes) {
    const select = document.getElementById('filtroCorretora');
    if (!select) return;
    const corretoras = new Set(); // Evita registros duplicados de corretoras
    operacoes.forEach(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        const corretora = (getProp(op, 'corretora') || 'Não informada').toString();
        corretoras.add(corretora);
    });

    const current = select.value || 'all';
    select.innerHTML = '<option value="all">Todas corretoras</option>';
    Array.from(corretoras).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    select.value = current;
}

// Renderiza visualmente as linhas na tabela de Histórico das Últimas 5 Operações
function gridUltimasOperacoes(ultimasCinco, tabelaUltimasBody) {
    ultimasCinco.forEach(op => {
        const getProp = (obj, key) => obj[key.toLowerCase()] || obj[key.toUpperCase()] || obj[key] || "";
        
        const res = getProp(op, 'resultado').toString().toUpperCase().trim();
        const usuario = getProp(op, 'usuario') || '-';
        // Define a cor de destaque base: Verde Neon para WIN e Vermelho/Laranja para LOSS
        const classeResultado = res === "WIN" ? "style='color: #00e676; font-weight: bold;'" : "style='color: #ff3d00; font-weight: bold;'";
        const entradaFormatada = parseFloat(getProp(op, 'entrada')) || 0;
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${getProp(op, 'ativo') || "-"}</td>
            <td>${getProp(op, 'estrategia') || "-"}</td>
            <td>${usuario}</td>
            <td>${fmtUSD.format(entradaFormatada)}</td>
            <td ${classeResultado}>${res || "-"}</td>
            <td><span class="badge-conta">${getProp(op, 'conta') || "-"}</span></td>
            <td>${getProp(op, 'corretora') || "-"}</td>
        `;
        tabelaUltimasBody.appendChild(row);
    });
}

// Inicializa a engine do Chart.js aplicando o visual futurista e estilizado em Dólar ($)
function inicializarGrafico(labels, dados) {
    const ctx = document.getElementById('graficoBanca').getContext('2d');
    
    // Destrói a instância anterior do gráfico para evitar sobreposição de linhas e travamento ao passar o mouse
    if (meuGrafico) {
        meuGrafico.destroy();
    }

    // Criação do gradiente de preenchimento desvanecido (fade-out) abaixo da linha do gráfico
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(0,230,118,0.25)'); // Verde Neon translúcido no topo
    gradient.addColorStop(1, 'rgba(0,230,118,0)');    // Totalmente invisível na base

    meuGrafico = new Chart(ctx, {
        type: 'line', // Gráfico do tipo Linha Contínua
        data: {
            labels: labels,
            datasets: [{
                label: 'Banca Real ($)',
                data: dados,
                borderColor: '#00e676', // Cor da linha principal (Verde Neon)
                backgroundColor: gradient, // Aplica o preenchimento gradiente
                borderWidth: 3,
                tension: 0.3, // Aplica curvas suaves nos nós das operações
                pointBackgroundColor: '#222',
                pointBorderColor: '#00e676',
                pointRadius: 3,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Oculta a legenda superior para um design limpo e minimalista
                tooltip: {
                    callbacks: {
                        // Formata o valor monetário exibido na caixinha de dica ao flutuar o mouse sobre os pontos do gráfico
                        label: function(context) {
                            if (context.parsed && typeof context.parsed.y === 'number') {
                                return fmtUSD.format(context.parsed.y);
                            }
                            return context.formattedValue;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }, // Linhas verticais da grelha quase invisíveis
                    ticks: { color: '#888' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }, // Linhas horizontais discretas
                    ticks: { 
                        color: '#888', 
                        // Garante que os valores marcados no eixo Y fiquem em formato monetário de Dólar
                        callback: function(value){ return fmtUSD.format(value); } 
                    }
                }
            }
        }
    });
}

// Busca ranking no endpoint do Apps Script (server-side)
async function fetchRanking() {
    const start = document.getElementById('rankStart')?.value || '';
    const end = document.getElementById('rankEnd')?.value || '';
    const limit = document.getElementById('rankLimit')?.value || '10';

    const params = new URLSearchParams();
    params.set('action', 'ranking');
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (limit && limit !== 'all') params.set('limit', limit);

    const url = API_URL + '?' + params.toString();
    const tabela = document.getElementById('tabelaRanking');
    if (tabela) tabela.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

    try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error('Erro na requisição de ranking');
        const obj = await res.json();
        const data = obj.data || [];

        if (!tabela) return;
        tabela.innerHTML = '';
        data.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${row.usuario || '—'}</td>
                <td>${row.totalOperacoes || 0}</td>
                <td>${fmtUSD.format(parseFloat(row.lucro || 0))}</td>
            `;
            tabela.appendChild(tr);
        });

        if (data.length === 0) tabela.innerHTML = '<tr><td colspan="4">Nenhum resultado</td></tr>';
    } catch (err) {
        console.error('fetchRanking error', err);
        if (tabela) tabela.innerHTML = '<tr><td colspan="4">Erro ao carregar ranking</td></tr>';
    }
}
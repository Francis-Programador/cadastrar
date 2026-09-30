const FORM_URL = "https://script.google.com/macros/s/AKfycbx66prYiNh36_JKyOjnHv94m8GqwOtzPtgqyikF1bJZVujiPLFd8kXb06YQm2yMaLvT/exec";
// Defina uma chave no Apps Script (Script Properties) e coloque o mesmo valor aqui
const CLIENT_API_KEY = "942515887";

function normalizePayoutPercent(value) {
    if (value === null || value === undefined || value === '') return 0;
    const numericValue = Number(String(value).trim().replace(/,/g, '.'));
    if (!Number.isFinite(numericValue)) return 0;
    return numericValue > 1 ? numericValue : numericValue * 100;
}

document.getElementById('formOperacao').addEventListener('submit', async function(e) {
    e.preventDefault(); // Impede a página de recarregar

    // Seleciona o botão de salvar para dar feedback visual ao usuário
    const btnSave = document.querySelector('.btn-save');
    const originalText = btnSave.textContent;
    btnSave.textContent = "Salvando...";
    btnSave.disabled = true;

    // Captura os valores dos campos do seu HTML baseado nos IDs
    const dadosFormulario = {
        usuario: document.getElementById('usuario') ? document.getElementById('usuario').value : '',
        ativo: document.getElementById('ativo').value,
        mercado: document.getElementById('mercado').value,
        estrategia: document.getElementById('estrategia').value,
        timeframe: document.getElementById('timeframe').value,
        corretora: document.getElementById('corretora').value,
        direcao: document.getElementById('direcao').value,
        conta: document.getElementById('conta').value,
        entrada: document.getElementById('entrada').value,
        payout: normalizePayoutPercent(document.getElementById('payout').value),
        resultado: document.getElementById('resultado').value,
        observacao: document.getElementById('observacao').value,
        apiKey: CLIENT_API_KEY,
        api_key: CLIENT_API_KEY // compatibilidade com Apps Script que espera 'api_key'
    };

    // Envia os dados para a planilha usando Fetch API
    try {
        // Envia como form-encoded para evitar preflight CORS (Apps Script não responde OPTIONS)
        const params = new URLSearchParams();
        Object.keys(dadosFormulario).forEach(k => {
            if (dadosFormulario[k] !== undefined && dadosFormulario[k] !== null) params.append(k, String(dadosFormulario[k]));
        });

        const res = await fetch(FORM_URL, {
            method: "POST",
            body: params
        });

        // Tenta parsear resposta JSON (Apps Script deve retornar JSON)
        let json = null;
        try { json = await res.json(); } catch(err) { /* resposta não-JSON */ }

        if (res.ok && (!json || json.status === 'success')) {
            alert("Operação salva com sucesso no Google Sheets!");
            document.getElementById('formOperacao').reset(); // Limpa o formulário
        } else {
            const msg = (json && json.message) ? json.message : ('HTTP ' + res.status);
            console.error('Save failed', res, json);
            alert('Erro ao salvar a operação: ' + msg);
        }
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar a operação. Verifique o console e se o Web App está publicado.");
    } finally {
        // Restaura o botão ao estado original
        btnSave.textContent = originalText;
        btnSave.disabled = false;
    }
});
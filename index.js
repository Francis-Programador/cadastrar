
// ===============================
// 1. FORMULÁRIO
// ===============================
const form = document.getElementById("formOperacao");
const formMessage = document.getElementById("formMessage");

function showMessage(message, type = "info") {
    if (!formMessage) {
        if (message) alert(message);
        return;
    }
    formMessage.textContent = message;
    formMessage.className = "form-message";
    if (message) {
        formMessage.classList.add(`form-message--${type}`);
    }
}

form.addEventListener("submit", function (e) {
    const ativo = document.getElementById("ativo").value.trim();
    const mercado = document.getElementById("mercado").value.trim();
    const estrategia = document.getElementById("estrategia").value.trim();
    const timeframe = document.getElementById("timeframe").value.trim();
    const direcao = document.getElementById("direcao").value.trim();
    const conta = document.getElementById("conta").value.trim();
    const entrada = parseFloat(document.getElementById("entrada").value);
    const payout = parseFloat(document.getElementById("payout").value);
    const resultado = document.getElementById("resultado").value;
    const corretora = document.getElementById('corretora').value;

    if (!ativo || !mercado || !estrategia || !timeframe || !direcao || !conta || isNaN(entrada) || isNaN(payout)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showMessage("Preencha todos os campos obrigatórios corretamente.", "error");
        return;
    }

    const lucro = resultado === "WIN" ? entrada * (payout / 100) : -entrada;
    showMessage(`Pronto para salvar. Lucro/Prejuízo estimado: R$ ${lucro.toFixed(2)}`, "success");
});

form.addEventListener("reset", function () {
    showMessage("", "info");
});
import { getCachedMember, signOutMember } from './member-auth.js';

async function initializeMemberPage() {
const validatedMember = await window.memberSessionReady;
const member = validatedMember || getCachedMember();

const memberName = document.getElementById('memberName');
const memberFirstName = document.getElementById('memberFirstName');
const memberStatus = document.getElementById('memberStatus');
const statusValue = document.getElementById('statusValue');
const vencimentoValue = document.getElementById('vencimentoValue');
const diasRestantes = document.getElementById('diasRestantes');

const nameFromMember = member.Nome_Completo || member.nomeCompleto || member.Nome || 'Membro';
const firstName = String(nameFromMember).split(' ')[0] || 'membro';
const status = (member.Status_Conta || member.status || 'Pendente').toString();
const vencimento = member.Data_Vencimento || member.dataVencimento || '';

if (memberName) memberName.textContent = nameFromMember;
if (memberFirstName) memberFirstName.textContent = firstName;
if (memberStatus) memberStatus.textContent = `Status: ${status}`;
if (statusValue) {
  statusValue.textContent = status;
  statusValue.className = status === 'Ativo' ? 'positive' : 'warning';
}

if (vencimento) {
  const parsedDate = new Date(vencimento);
  if (!Number.isNaN(parsedDate.getTime())) {
    if (vencimentoValue) vencimentoValue.textContent = parsedDate.toLocaleDateString('pt-BR');
    const diffMs = parsedDate.getTime() - Date.now();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (diasRestantes) diasRestantes.textContent = `${diffDays} dias`;
  }
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  signOutMember();
  window.location.href = 'index.html';
});

document.getElementById('riskForm')?.addEventListener('submit', (event) => {
  event.preventDefault();

  const banca = Number(document.getElementById('bancaInicial').value || 0);
  const metaDiariaPct = Number(document.getElementById('metaDiaria').value || 0) / 100;
  const stopDiarioPct = Number(document.getElementById('stopDiario').value || 0) / 100;
  const payout = Number(document.getElementById('payoutCorretora').value || 0) / 100;

  const metaFinanceira = banca * metaDiariaPct;
  const stopFinanceiro = banca * stopDiarioPct;
  const valorEntradaBase = stopFinanceiro / Math.max(payout, 0.01);
  const primeiraEntrada = valorEntradaBase * 0.5;
  const sorosRecuperacao = valorEntradaBase * 0.25;

  document.getElementById('metaFinanceira').textContent = formatCurrency(metaFinanceira);
  document.getElementById('stopFinanceiro').textContent = formatCurrency(stopFinanceiro);
  document.getElementById('primeiraEntrada').textContent = formatCurrency(primeiraEntrada);
  document.getElementById('sorosRecuperacao').textContent = formatCurrency(sorosRecuperacao);

  const riskNotes = document.getElementById('riskNotes');
  if (riskNotes) {
    const note = stopDiarioPct > 0.05
      ? 'O stop diário está acima do ideal. Reduza o risco para manter a banca mais estável.'
      : 'Seu plano de risco está dentro de um desenho saudável para a banca atual.';

    riskNotes.innerHTML = `<p>${note}</p><ul><li>Meta: ${formatCurrency(metaFinanceira)}</li><li>Stop: ${formatCurrency(stopFinanceiro)}</li><li>Entrada: ${formatCurrency(primeiraEntrada)}</li></ul>`;
  }
});

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0));
}
}

initializeMemberPage();

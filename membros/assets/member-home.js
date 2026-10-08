import { getCachedMember } from './member-auth.js';

async function initializeMemberHome() {
const validatedMember = await window.memberSessionReady;
const currentMember = validatedMember || getCachedMember();

const homeFirstName = String(
  currentMember.Nome_Completo ||
  currentMember.nomeCompleto ||
  currentMember.Nome ||
  'Membro'
).trim().split(/\s+/)[0];

const initials = String(
  currentMember.Nome_Completo ||
  currentMember.nomeCompleto ||
  currentMember.Nome ||
  currentMember.Nome_Usuario ||
  'M'
).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const firstNameElement = document.getElementById('memberFirstName');
const initialsElement = document.getElementById('memberInitials');
const dateElement = document.getElementById('todayDate');

if (firstNameElement) firstNameElement.textContent = homeFirstName;
if (initialsElement) initialsElement.textContent = initials;
if (dateElement) {
  dateElement.textContent = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

const checklist = document.getElementById('dailyChecklist');
const routineCounter = document.getElementById('routineCounter');

if (checklist && routineCounter) {
  const account = String(
    currentMember.ID_Membro ||
    currentMember.id ||
    currentMember.Nome_Usuario ||
    currentMember.usuario ||
    currentMember.Nome_Completo ||
    'membro'
  ).trim().toLowerCase();
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const storageKey = `serTraderRoutine:${account}:${today}`;
  const savedChecks = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const checkboxes = [...checklist.querySelectorAll('input[name="routine"]')];

  checkboxes.forEach((checkbox) => {
    checkbox.checked = savedChecks.includes(checkbox.value);
  });

  const updateRoutine = () => {
    const completed = checkboxes.filter((checkbox) => checkbox.checked);
    routineCounter.textContent = `${completed.length} de ${checkboxes.length}`;
    localStorage.setItem(storageKey, JSON.stringify(completed.map((checkbox) => checkbox.value)));
  };

  checklist.addEventListener('change', updateRoutine);
  updateRoutine();
}
}

initializeMemberHome();

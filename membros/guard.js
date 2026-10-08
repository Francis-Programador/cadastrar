import { validateMemberSession } from './assets/member-auth.js';

window.memberSessionReady = validateMemberSession().then((result) => {
  if (result.valid) {
    document.documentElement.classList.add('member-session-ready');
    return result.member;
  }

  const reason = result.status === 'EXPIRADO' ? 'expired' : 'auth';
  window.location.replace(`index.html?reason=${reason}`);
  return null;
});

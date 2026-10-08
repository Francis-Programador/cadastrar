(function () {
  const rawMember = sessionStorage.getItem('serTraderMember') || localStorage.getItem('serTraderMember');

  if (!rawMember) {
    window.location.href = '../index.html';
    return;
  }

  try {
    const member = JSON.parse(rawMember);
    const status = (member.Status_Conta || member.status || '').toString().toLowerCase();

    if (status !== 'ativo') {
      window.location.href = '../index.html';
    }
  } catch (error) {
    window.location.href = '../index.html';
  }
})();

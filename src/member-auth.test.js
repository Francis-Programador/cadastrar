import { beforeEach, describe, expect, it } from 'vitest';
import {
  authenticateMember,
  isFirebaseConfigured,
  signOutMember,
  validateMemberSession,
} from '../membros/assets/member-auth.js';

describe('member Firebase authentication', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('recognizes the configured Firebase Web API key', () => {
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('does not treat a cached member profile as an authenticated session', async () => {
    localStorage.setItem('serTraderMember', JSON.stringify({
      Nome_Completo: 'Member',
      Status_Conta: 'Ativo',
    }));

    const result = await validateMemberSession();

    expect(result.valid).toBe(false);
    expect(localStorage.getItem('serTraderMember')).toBeNull();
  });

  it('clears both Firebase credentials and cached profile when signing out', () => {
    sessionStorage.setItem('serTraderFirebaseSession', JSON.stringify({
      idToken: 'token',
      refreshToken: 'refresh',
    }));
    sessionStorage.setItem('serTraderMember', '{"ID_Membro":"MBR-1"}');

    signOutMember();

    expect(sessionStorage.getItem('serTraderFirebaseSession')).toBeNull();
    expect(sessionStorage.getItem('serTraderMember')).toBeNull();
  });
});

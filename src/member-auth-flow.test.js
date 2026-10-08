import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../membros/assets/firebase-config.js', () => ({
  firebaseConfig: { apiKey: 'test-firebase-key' },
}));

import { authenticateMember } from '../membros/assets/member-auth.js';

describe('Firebase member sign-in flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores a browser session only after the Apps Script confirms active membership', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'firebase-id-token',
          refreshToken: 'firebase-refresh-token',
          expiresIn: '3600',
          emailVerified: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          member: {
            ID_Membro: 'MBR-123',
            Nome_Completo: 'Ana Trader',
            Status_Conta: 'Ativo',
          },
        }),
      }));

    const member = await authenticateMember(' ANA@example.com ', 'password123');

    expect(member.ID_Membro).toBe('MBR-123');
    expect(JSON.parse(sessionStorage.getItem('serTraderMember')).Nome_Completo)
      .toBe('Ana Trader');
    expect(JSON.parse(sessionStorage.getItem('serTraderFirebaseSession')).idToken)
      .toBe('firebase-id-token');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/membros',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'memberSession',
          firebaseIdToken: 'firebase-id-token',
        }),
      })
    );
  });

  it('does not create a session when the server reports pending membership', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'firebase-id-token',
          refreshToken: 'firebase-refresh-token',
          expiresIn: '3600',
          emailVerified: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          status: 'PENDENTE',
          message: 'Cadastro em análise.',
        }),
      }));

    await expect(authenticateMember('ana@example.com', 'password123'))
      .rejects.toThrow('Cadastro em análise.');
    expect(sessionStorage.getItem('serTraderFirebaseSession')).toBeNull();
  });
});

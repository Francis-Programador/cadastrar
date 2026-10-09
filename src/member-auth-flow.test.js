import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../membros/assets/firebase-config.js', () => ({
  firebaseConfig: { apiKey: 'test-firebase-key' },
}));

import {
  authenticateMember,
  createMemberAccount,
} from '../membros/assets/member-auth.js';

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
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: true }],
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
      expect.stringContaining('/accounts:lookup?'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ idToken: 'firebase-id-token' }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
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
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: true }],
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

  it('reports the HTTP status when the Apps Script endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'firebase-id-token',
          refreshToken: 'firebase-refresh-token',
          expiresIn: '3600',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: true }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => null,
      }));

    await expect(authenticateMember('ana@example.com', 'password123'))
      .rejects.toThrow('HTTP 502');
    expect(sessionStorage.getItem('serTraderFirebaseSession')).toBeNull();
  });

  it('allows verified accounts even when sign-in omits the email verification field', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'firebase-id-token',
          refreshToken: 'firebase-refresh-token',
          expiresIn: '3600',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: true }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          member: { ID_Membro: 'MBR-123', Status_Conta: 'Ativo' },
        }),
      }));

    await expect(authenticateMember('ana@example.com', 'password123'))
      .resolves.toMatchObject({ ID_Membro: 'MBR-123' });
  });

  it('requests email verification only when the Firebase profile is unverified', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ idToken: 'firebase-id-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: true }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }));

    await createMemberAccount({
      email: 'ana@example.com',
      password: 'password123',
      registration: { nomeCompleto: 'Ana Trader' },
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/membros',
      expect.objectContaining({
        body: expect.stringContaining('"action":"register"'),
      })
    );
  });

  it('keeps unverified users from accessing member sessions', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          idToken: 'firebase-id-token',
          refreshToken: 'firebase-refresh-token',
          expiresIn: '3600',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [{ localId: 'firebase-uid-1', emailVerified: false }],
        }),
      }));

    await expect(authenticateMember('ana@example.com', 'password123'))
      .rejects.toThrow('Confirme seu e-mail pelo link enviado antes de entrar.');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('serTraderFirebaseSession')).toBeNull();
  });
});

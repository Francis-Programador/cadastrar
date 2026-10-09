import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../membros/assets/member-auth.js', () => ({
  getAuthenticatedFirebaseIdentity: vi.fn().mockResolvedValue({
    uid: 'firebase-uid-1',
    idToken: 'firebase-id-token',
  }),
  signOutMember: vi.fn(),
}));

vi.mock('../membros/assets/firebase-config.js', () => ({
  firebaseConfig: {
    apiKey: 'test-key',
    databaseURL: 'https://test-project-default-rtdb.firebaseio.com',
  },
}));

vi.mock('../membros/assets/live-room-config.js', () => ({
  liveRoomConfig: {
    status: 'OFFLINE',
    title: '',
    description: '',
    streamUrl: '',
    sessionStartsAt: '',
    nextSessionAt: '',
    previousRecordingUrl: '',
    voiceChatUrl: '',
  },
}));

describe('live room notes', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    document.body.innerHTML = `
      <strong id="memberName"></strong>
      <span id="memberStatus" hidden></span>
      <button id="logoutBtn"></button>
      <span id="sessionState" data-state=""></span>
      <span id="streamBadge" data-state=""></span>
      <span id="sessionStateLabel"></span>
      <span id="sessionDetailsState"></span>
      <span id="voiceChatUnavailable"></span>
      <textarea id="liveNotes" disabled></textarea>
      <button id="saveNotes" disabled></button>
      <span id="notesStatus"></span>
      <span id="lastSaved"></span>
      <span id="characterCount"></span>
      <div id="legacyNotice" hidden></div>
      <p id="legacyMessage"></p>
      <button id="importLegacyNotes" hidden></button>
    `;
    window.memberSessionReady = Promise.resolve({
      ID_Membro: 'MBR-1',
      Nome_Completo: 'Ana Trader',
      Status_Conta: 'Ativo',
    });
  });

  afterEach(() => {
    delete window.memberSessionReady;
    vi.unstubAllGlobals();
  });

  it('loads and saves notes under the authenticated Firebase UID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Notas da sessão', updatedAt: 1_800_000_000_000 }),
      })
      .mockImplementationOnce(async (_url, options) => ({
        ok: true,
        json: async () => JSON.parse(options.body),
      }));
    vi.stubGlobal('fetch', fetchMock);

    await import('../membros/assets/live-room.js');
    await vi.waitFor(() => {
      expect(document.getElementById('liveNotes').value).toBe('Notas da sessão');
    });

    const textarea = document.getElementById('liveNotes');
    textarea.value = 'Notas atualizadas';
    document.getElementById('saveNotes').click();

    await vi.waitFor(() => {
      expect(document.getElementById('notesStatus').textContent).toBe('Guardado');
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://test-project-default-rtdb.firebaseio.com/memberLiveNotes/firebase-uid-1.json?auth=firebase-id-token',
      expect.objectContaining({ cache: 'no-store', referrerPolicy: 'no-referrer' })
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://test-project-default-rtdb.firebaseio.com/memberLiveNotes/firebase-uid-1.json?auth=firebase-id-token'
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      content: 'Notas atualizadas',
    });
  });

  it('keeps local notes and reports a Firebase write failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'permission_denied' }),
      }));

    await import('../membros/assets/live-room.js');
    await vi.waitFor(() => {
      expect(document.getElementById('liveNotes').disabled).toBe(false);
    });

    const textarea = document.getElementById('liveNotes');
    textarea.value = 'Rascunho que não pode ser perdido';
    textarea.dispatchEvent(new Event('input'));
    document.getElementById('saveNotes').click();

    await vi.waitFor(() => {
      expect(document.getElementById('notesStatus').dataset.state).toBe('error');
    });
    expect(textarea.value).toBe('Rascunho que não pode ser perdido');
    expect(localStorage.getItem('serTraderLiveNotesPending:firebase-uid-1'))
      .toContain('Rascunho que não pode ser perdido');
  });

  it('migrates a legacy note only after an explicit action and confirmed Firebase save', async () => {
    localStorage.setItem('serTraderLiveNotes:MBR-1', 'Notas antigas da live');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockImplementationOnce(async (_url, options) => ({
        ok: true,
        json: async () => JSON.parse(options.body),
      })));

    await import('../membros/assets/live-room.js');
    await vi.waitFor(() => {
      expect(document.getElementById('importLegacyNotes').hidden).toBe(false);
    });
    expect(localStorage.getItem('serTraderLiveNotes:MBR-1')).toBe('Notas antigas da live');

    document.getElementById('importLegacyNotes').click();
    expect(document.getElementById('liveNotes').value).toBe('Notas antigas da live');
    expect(localStorage.getItem('serTraderLiveNotes:MBR-1')).toBe('Notas antigas da live');

    document.getElementById('saveNotes').click();
    await vi.waitFor(() => {
      expect(document.getElementById('notesStatus').textContent).toBe('Guardado');
    });
    expect(localStorage.getItem('serTraderLiveNotes:MBR-1')).toBeNull();
  });
});

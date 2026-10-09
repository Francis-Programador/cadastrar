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
    chatRoomId: 'sala-principal',
    status: 'OFFLINE',
    title: '',
    description: '',
    streamUrl: '',
    sessionStartsAt: '',
    nextSessionAt: '',
    previousRecordingUrl: '',
    channelUrl: '',
    voiceChatUrl: '',
  },
}));

class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.closed = false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  dispatch(type, data) {
    const event = new Event(type);
    if (data !== undefined) event.data = JSON.stringify(data);
    for (const callback of this.listeners.get(type) || []) callback(event);
  }

  close() {
    this.closed = true;
  }
}

describe('live room shared chat', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeEventSource.instances = [];
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal('EventSource', FakeEventSource);
    document.body.innerHTML = `
      <span id="chatStatus"></span>
      <p id="chatError" hidden></p>
      <ol id="chatMessages"><li id="chatEmpty"></li></ol>
      <form id="chatForm">
        <textarea id="chatMessage" disabled></textarea>
        <button id="sendChatMessage" type="submit" disabled></button>
        <span id="chatCharacterCount"></span>
      </form>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('streams shared messages and displays other members with a UID-derived label', async () => {
    const { initializeLiveChat } = await import('../membros/assets/live-room-chat.js');
    await initializeLiveChat({});

    const source = FakeEventSource.instances[0];
    const streamUrl = new URL(source.url);
    expect(streamUrl.pathname).toBe('/liveRoomChats/sala-principal.json');
    expect(streamUrl.searchParams.get('auth')).toBe('firebase-id-token');
    expect(streamUrl.searchParams.has('print')).toBe(false);
    source.dispatch('open');
    source.dispatch('put', {
      path: '/',
      data: {
        message1: {
          uid: 'other-firebase-user-123456',
          content: '<script>not markup</script>',
          createdAt: 1_800_000_000_000,
        },
      },
    });

    const message = document.querySelector('.chat-message');
    expect(message.querySelector('.chat-message-author').textContent)
      .toBe('Membro · 123456');
    expect(message.querySelector('.chat-message-content').textContent)
      .toBe('<script>not markup</script>');
    expect(message.querySelector('script')).toBeNull();
  });

  it('sends messages with the authenticated UID to the shared room', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({ name: '-firebase-message-id' }),
      options,
    })));

    const { initializeLiveChat } = await import('../membros/assets/live-room-chat.js');
    await initializeLiveChat({});
    const source = FakeEventSource.instances[0];
    source.dispatch('open');

    const textarea = document.getElementById('chatMessage');
    textarea.value = 'Ideia para a sessão';
    document.getElementById('chatForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => {
      expect(document.querySelector('.chat-message-content')?.textContent)
        .toBe('Ideia para a sessão');
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/liveRoomChats/sala-principal.json?auth=firebase-id-token'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"uid":"firebase-uid-1"'),
      })
    );
    expect(textarea.value).toBe('');
  });

  it('keeps an unsent draft when Firebase rejects the message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'permission_denied' }),
    })));

    const { initializeLiveChat } = await import('../membros/assets/live-room-chat.js');
    await initializeLiveChat({});
    FakeEventSource.instances[0].dispatch('open');

    const textarea = document.getElementById('chatMessage');
    textarea.value = 'Mensagem para tentar novamente';
    document.getElementById('chatForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => {
      expect(document.getElementById('chatError').hidden).toBe(false);
    });
    expect(textarea.value).toBe('Mensagem para tentar novamente');
    expect(localStorage.getItem('serTraderLiveChatDraft:firebase-uid-1'))
      .toBe('Mensagem para tentar novamente');
  });

  it('removes messages from the conversation when the database stream reports deletion', async () => {
    const { initializeLiveChat } = await import('../membros/assets/live-room-chat.js');
    await initializeLiveChat({});
    const source = FakeEventSource.instances[0];
    source.dispatch('put', {
      path: '/',
      data: {
        message1: {
          uid: 'other-firebase-user-123456',
          content: 'Mensagem da live',
          createdAt: 1_800_000_000_000,
        },
      },
    });
    expect(document.querySelectorAll('.chat-message')).toHaveLength(1);

    source.dispatch('put', { path: '/message1', data: null });
    expect(document.querySelectorAll('.chat-message')).toHaveLength(0);
    expect(document.querySelector('.chat-empty').textContent)
      .toContain('Ainda não há mensagens');
  });
});

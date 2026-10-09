import { getAuthenticatedFirebaseIdentity } from './member-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { liveRoomConfig } from './live-room-config.js';

const MESSAGE_LIMIT = 2000;
const DRAFT_PREFIX = 'serTraderLiveChatDraft:';
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000;

function setStatus(message, state = '') {
  const element = document.getElementById('chatStatus');
  element.textContent = message;
  element.dataset.state = state;
}

function setError(message) {
  const error = document.getElementById('chatError');
  error.textContent = message;
  error.hidden = !message;
}

function formatTimestamp(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return 'Hora indisponível';
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Luanda',
  }).format(date);
}

function databaseBaseUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      !/\.firebasedatabase\.app$|\.firebaseio\.com$/i.test(url.hostname)
    ) {
      return '';
    }
    return url.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function validRoomId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

function chatUrl(baseUrl, roomId, token) {
  const url = new URL(
    `${baseUrl}/liveRoomChats/${encodeURIComponent(roomId)}.json`
  );
  url.searchParams.set('auth', token);
  return url.href;
}

function validMessage(value) {
  return value &&
    typeof value === 'object' &&
    typeof value.uid === 'string' &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    value.content.length <= MESSAGE_LIMIT &&
    Number.isFinite(Number(value.createdAt));
}

function applyStreamEvent(messages, event) {
  const update = JSON.parse(event.data);
  const path = String(update.path || '/').split('/').filter(Boolean);
  const value = update.data;

  if (event.type === 'put') {
    if (path.length === 0) {
      return value && typeof value === 'object' ? { ...value } : {};
    }
    const [messageId] = path;
    const next = { ...messages };
    if (path.length === 1) {
      if (value === null) delete next[messageId];
      else next[messageId] = value;
    } else if (next[messageId] && typeof next[messageId] === 'object') {
      const message = { ...next[messageId] };
      if (value === null) delete message[path[1]];
      else message[path[1]] = value;
      next[messageId] = message;
    }
    return next;
  }

  if (event.type === 'patch' && value && typeof value === 'object') {
    let next = { ...messages };
    for (const [key, patchValue] of Object.entries(value)) {
      const [messageId, field] = [...path, ...key.split('/')].filter(Boolean);
      if (!messageId) {
        next = patchValue && typeof patchValue === 'object'
          ? { ...next, ...patchValue }
          : next;
      } else if (!field) {
        if (patchValue === null) delete next[messageId];
        else next[messageId] = patchValue;
      } else if (next[messageId] && typeof next[messageId] === 'object') {
        const message = { ...next[messageId] };
        if (patchValue === null) delete message[field];
        else message[field] = patchValue;
        next[messageId] = message;
      }
    }
    return next;
  }
  return messages;
}

function renderMessages(messages, uid, initial = false) {
  const list = document.getElementById('chatMessages');
  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 72;
  const validEntries = Object.entries(messages)
    .filter(([, message]) => validMessage(message))
    .sort(([keyA, messageA], [keyB, messageB]) => (
      Number(messageA.createdAt) - Number(messageB.createdAt) ||
      keyA.localeCompare(keyB)
    ));
  const empty = document.createElement('li');
  empty.className = 'chat-empty';
  empty.textContent = 'Ainda não há mensagens nesta live. Inicia a conversa.';
  list.replaceChildren();

  if (!validEntries.length) {
    list.append(empty);
    return;
  }

  for (const [, message] of validEntries) {
    const item = document.createElement('li');
    item.className = 'chat-message';
    item.dataset.own = String(message.uid === uid);

    const header = document.createElement('div');
    header.className = 'chat-message-header';
    const author = document.createElement('strong');
    author.className = 'chat-message-author';
    author.textContent = message.uid === uid
      ? 'Tu'
      : `Membro · ${message.uid.slice(-6)}`;
    const time = document.createElement('time');
    const date = new Date(Number(message.createdAt));
    time.dateTime = Number.isNaN(date.getTime()) ? '' : date.toISOString();
    time.textContent = formatTimestamp(message.createdAt);
    header.append(author, time);

    const content = document.createElement('p');
    content.className = 'chat-message-content';
    content.textContent = message.content;
    item.append(header, content);
    list.append(item);
  }

  if (initial || wasNearBottom) list.scrollTop = list.scrollHeight;
}

export async function initializeLiveChat(member) {
  const textarea = document.getElementById('chatMessage');
  const form = document.getElementById('chatForm');
  const submitButton = document.getElementById('sendChatMessage');
  const databaseUrl = databaseBaseUrl(firebaseConfig.databaseURL);
  const roomId = liveRoomConfig.chatRoomId;

  if (!databaseUrl || !validRoomId(roomId)) {
    textarea.disabled = true;
    submitButton.disabled = true;
    setStatus('O chat ainda não está configurado pela equipe.', 'error');
    return;
  }

  const identity = await getAuthenticatedFirebaseIdentity();
  const { uid } = identity;
  const draftKey = `${DRAFT_PREFIX}${uid}`;
  let messages = {};
  let source;
  let refreshTimer;
  let connectionReady = false;
  let sending = false;

  try {
    textarea.value = localStorage.getItem(draftKey) || '';
  } catch {
    setError('Não foi possível recuperar o rascunho deste dispositivo.');
  }

  function updateCharacterCount() {
    document.getElementById('chatCharacterCount').textContent =
      `${textarea.value.length} / ${MESSAGE_LIMIT}`;
  }

  function openStream(token, initial = false) {
    if (source) source.close();
    source = new EventSource(chatUrl(databaseUrl, roomId, token));
    source.addEventListener('open', () => {
      connectionReady = true;
      textarea.disabled = false;
      submitButton.disabled = false;
      setStatus('Ligado — as mensagens aparecem para todos os membros ativos.', 'connected');
      setError('');
    });

    const applyEvent = (event) => {
      try {
        messages = applyStreamEvent(messages, event);
        renderMessages(messages, uid, initial);
        initial = false;
      } catch {
        setStatus('Chegou uma atualização que não pôde ser apresentada.', 'error');
      }
    };
    source.addEventListener('put', applyEvent);
    source.addEventListener('patch', applyEvent);
    source.addEventListener('cancel', () => {
      connectionReady = false;
      textarea.disabled = true;
      submitButton.disabled = true;
      setStatus('Acesso ao chat recusado. Confirme que a conta tem autorização de membro ativo.', 'error');
    }, { once: true });
    source.addEventListener('auth_revoked', () => {
      connectionReady = false;
      textarea.disabled = true;
      submitButton.disabled = true;
      setStatus('A sessão expirou. Entre novamente para continuar no chat.', 'error');
      source.close();
    }, { once: true });
    source.addEventListener('error', () => {
      connectionReady = false;
      textarea.disabled = true;
      submitButton.disabled = true;
      setStatus('Ligação interrompida; a tentar reconectar...', 'error');
    });
  }

  textarea.addEventListener('input', () => {
    updateCharacterCount();
    try {
      if (textarea.value) localStorage.setItem(draftKey, textarea.value);
      else localStorage.removeItem(draftKey);
    } catch {
      setError('O rascunho não pôde ser guardado localmente. Mantenha esta página aberta até enviar.');
    }
  });
  updateCharacterCount();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content || content.length > MESSAGE_LIMIT || sending) return;
    if (!connectionReady) {
      setError('O chat não está ligado. Aguarde a reconexão antes de enviar.');
      return;
    }

    sending = true;
    submitButton.disabled = true;
    setError('');
    setStatus('A enviar mensagem...');

    try {
      const currentIdentity = await getAuthenticatedFirebaseIdentity();
      if (currentIdentity.uid !== uid) {
        throw new Error('A sessão mudou. Atualize a página antes de enviar.');
      }
      const createdAt = Date.now();
      const response = await fetch(chatUrl(databaseUrl, roomId, currentIdentity.idToken), {
        method: 'POST',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          content,
          createdAt,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.name !== 'string') {
        throw new Error('Não foi possível enviar a mensagem. O texto continua no campo; tente novamente.');
      }

      messages = {
        ...messages,
        [result.name]: { uid, content, createdAt },
      };
      renderMessages(messages, uid);
      if (textarea.value.trim() === content) {
        textarea.value = '';
        try {
          localStorage.removeItem(draftKey);
        } catch {
          setError('Mensagem enviada; não foi possível limpar a cópia local do rascunho.');
        }
        updateCharacterCount();
      }
      setStatus('Mensagem enviada para a conversa.', 'connected');
    } catch (error) {
      setError(error.message || 'Erro ao enviar. O texto continua no campo.');
      setStatus('Mensagem por enviar.', 'error');
      try {
        if (textarea.value) localStorage.setItem(draftKey, textarea.value);
      } catch {
        setError('A mensagem não foi enviada e o rascunho não pôde ser guardado. Mantenha a página aberta.');
      }
    } finally {
      sending = false;
      submitButton.disabled = !connectionReady;
    }
  });

  textarea.disabled = false;
  submitButton.disabled = false;
  setStatus('A ligar à conversa...');
  openStream(identity.idToken, true);

  refreshTimer = window.setInterval(async () => {
    try {
      const refreshedIdentity = await getAuthenticatedFirebaseIdentity();
      if (refreshedIdentity.uid !== uid) {
        throw new Error('A sessão mudou.');
      }
      openStream(refreshedIdentity.idToken);
    } catch {
      connectionReady = false;
      textarea.disabled = true;
      submitButton.disabled = true;
      setStatus('A sessão expirou. Entre novamente para continuar no chat.', 'error');
    }
  }, TOKEN_REFRESH_INTERVAL);

  window.addEventListener('pagehide', () => {
    window.clearInterval(refreshTimer);
    if (source) source.close();
  }, { once: true });
}

export { applyStreamEvent, databaseBaseUrl, validMessage, validRoomId };

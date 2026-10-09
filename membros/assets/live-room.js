import {
  getAuthenticatedFirebaseIdentity,
  signOutMember,
} from './member-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { liveRoomConfig } from './live-room-config.js';

const NOTE_LIMIT = 20000;
const LEGACY_NOTE_PREFIX = 'serTraderLiveNotes:';
const PENDING_NOTE_PREFIX = 'serTraderLiveNotesPending:';
const SAVE_DELAY = 900;

export function getYouTubeEmbedUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' || url.username || url.password) return '';

  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
  ]);
  if (!allowedHosts.has(host)) return '';

  const segments = url.pathname.split('/').filter(Boolean);
  let videoId = '';
  if (host === 'youtu.be') {
    videoId = segments[0] || '';
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v') || '';
  } else if (['embed', 'live', 'shorts'].includes(segments[0])) {
    videoId = segments[1] || '';
  }

  if (!/^[\w-]{11}$/.test(videoId)) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=0`;
}

export function getConfiguredRoomState(config) {
  const status = String(config.status || '').trim().toUpperCase();
  if (!status && !config.streamUrl && !config.nextSessionAt) {
    return { state: 'unconfigured', label: 'Sem configuração' };
  }

  if (status === 'LIVE') {
    if (!getYouTubeEmbedUrl(config.streamUrl)) {
      return { state: 'error', label: 'Erro na configuração', message: 'Não foi possível carregar a transmissão. A equipe deve conferir o URL configurado.' };
    }
    return { state: 'live', label: 'Ao vivo' };
  }

  if (status === 'SCHEDULED') {
    return { state: 'scheduled', label: 'Agendada' };
  }

  if (status === 'OFFLINE') {
    return { state: 'offline', label: 'Offline' };
  }

  return { state: 'error', label: 'Erro na configuração', message: 'A configuração da transmissão não é válida. A equipe deve conferir os dados da sala.' };
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function formatSessionDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Luanda',
  }).format(date);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setVisible(id, visible) {
  const element = document.getElementById(id);
  if (element) element.hidden = !visible;
}

function setRoomStatus(roomState) {
  for (const id of ['sessionState', 'streamBadge']) {
    const element = document.getElementById(id);
    if (element) element.dataset.state = roomState.state;
  }
  setText('sessionStateLabel', roomState.label);
  setText('streamBadge', roomState.label);
  setText('sessionDetailsState', roomState.label);

  const title = String(liveRoomConfig.title || '').trim();
  if (title) {
    setText('streamTitle', title);
    setText('sessionTitle', title);
  }

  const description = String(liveRoomConfig.description || '').trim();
  if (description) {
    setText('sessionDescription', description);
    setVisible('sessionDescription', true);
  }

  const sessionStart = formatSessionDate(liveRoomConfig.sessionStartsAt);
  if (sessionStart) {
    setText('sessionStart', sessionStart);
    setVisible('sessionStartRow', true);
  }

  const nextSession = formatSessionDate(liveRoomConfig.nextSessionAt);
  if (nextSession) {
    setText('nextSession', nextSession);
    setVisible('nextSessionRow', true);
  }

  const recordingUrl = safeHttpsUrl(liveRoomConfig.previousRecordingUrl);
  if (recordingUrl) {
    const recording = document.getElementById('previousRecording');
    recording.href = recordingUrl;
    setVisible('previousRecording', true);
  }

  const channelUrl = safeYouTubeChannelUrl(liveRoomConfig.channelUrl);
  if (channelUrl) {
    const channelLink = document.getElementById('youtubeChannelLink');
    channelLink.href = channelUrl;
    setVisible('youtubeChannelLink', true);
  }

  const voiceChatUrl = safeHttpsUrl(liveRoomConfig.voiceChatUrl);
  if (voiceChatUrl) {
    const voiceChatLink = document.getElementById('voiceChatLink');
    voiceChatLink.href = voiceChatUrl;
    setVisible('voiceChatLink', true);
    setVisible('voiceChatUnavailable', false);
  }

  const player = document.getElementById('livePlayer');
  const adminHint = document.getElementById('adminHint');

  if (roomState.state === 'live') {
    player.src = getYouTubeEmbedUrl(liveRoomConfig.streamUrl);
    player.title = title ? `Transmissão: ${title}` : 'Transmissão da comunidade';
    player.hidden = false;
    setVisible('videoPlaceholder', false);
    const showPlayerError = () => {
      if (player.hidden) return;
      player.hidden = true;
      setVisible('videoPlaceholder', true);
      setText('videoMessageTitle', 'Não foi possível carregar o vídeo');
      setText('videoMessage', 'A transmissão não pôde ser carregada. Tente novamente mais tarde ou fale com a equipe.');
      setVisible('adminHint', false);
      for (const id of ['sessionState', 'streamBadge']) {
        const element = document.getElementById(id);
        element.dataset.state = 'error';
      }
      setText('sessionStateLabel', 'Erro');
      setText('streamBadge', 'Erro');
      setText('sessionDetailsState', 'Erro');
    };
    let loadTimer = window.setTimeout(showPlayerError, 12000);
    player.addEventListener('load', () => window.clearTimeout(loadTimer), { once: true });
    player.addEventListener('error', showPlayerError, { once: true });
    return;
  }

  if (roomState.state === 'scheduled') {
    setText('videoMessageTitle', 'Próxima sessão agendada');
    setText(
      'videoMessage',
      nextSession
        ? `A próxima sessão está prevista para ${nextSession}.`
        : 'A equipe ainda não informou a data e a hora da próxima sessão.'
    );
    setVisible('adminHint', false);
  } else if (roomState.state === 'offline') {
    setText('videoMessageTitle', 'Nenhuma transmissão ativa');
    setText('videoMessage', 'A sala está offline neste momento. Consulte os detalhes para ver se há uma próxima sessão.');
    setVisible('adminHint', false);
  } else if (roomState.state === 'error') {
    setText('videoMessageTitle', 'Não foi possível carregar a transmissão');
    setText('videoMessage', roomState.message);
    setVisible('adminHint', true);
  } else {
    setText('videoMessageTitle', 'Transmissão ainda não configurada');
    setText('videoMessage', 'A equipe ainda não configurou o endereço e o estado da transmissão.');
    setVisible('adminHint', true);
  }
}

function notesEndpoint(databaseUrl, uid, idToken) {
  const baseUrl = databaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/memberLiveNotes/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`;
}

function setNotesStatus(message, state = '') {
  const status = document.getElementById('notesStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setLastSaved(timestamp) {
  const label = timestamp
    ? `Última gravação: ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Africa/Luanda',
    }).format(new Date(timestamp))}`
    : '';
  setText('lastSaved', label);
}

function updateCharacterCount(value) {
  setText('characterCount', `${value.length} / ${NOTE_LIMIT}`);
}

function parseDraft(value) {
  try {
    const draft = JSON.parse(value);
    if (typeof draft.content === 'string' && draft.content.length <= NOTE_LIMIT) {
      return { content: draft.content, updatedAt: Number(draft.updatedAt) || 0 };
    }
  } catch {
    return null;
  }
  return null;
}

async function readFirebaseNotes(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error('Não foi possível carregar as notas sincronizadas. Verifique a ligação e as regras do Firebase.');
  }
  if (data === null) return null;
  if (
    typeof data !== 'object' ||
    typeof data.content !== 'string' ||
    data.content.length > NOTE_LIMIT ||
    !Number.isFinite(Number(data.updatedAt))
  ) {
    throw new Error('As notas recebidas têm um formato inválido. O texto local foi preservado.');
  }
  return { content: data.content, updatedAt: Number(data.updatedAt) };
}

async function writeFirebaseNotes(url, content, updatedAt) {
  const response = await fetch(url, {
    method: 'PUT',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, updatedAt }),
  });
  const saved = await response.json().catch(() => null);
  if (!response.ok || saved?.content !== content || Number(saved?.updatedAt) !== updatedAt) {
    throw new Error('Não foi possível confirmar a gravação no Firebase. As notas continuam neste dispositivo.');
  }
}

async function initializeNotes(uid, idToken, memberId) {
  const textarea = document.getElementById('liveNotes');
  const saveButton = document.getElementById('saveNotes');
  const importButton = document.getElementById('importLegacyNotes');
  const databaseUrl = safeDatabaseUrl(firebaseConfig.databaseURL);
  const legacyKey = memberId ? `${LEGACY_NOTE_PREFIX}${memberId}` : '';
  const pendingKey = `${PENDING_NOTE_PREFIX}${uid}`;
  const legacyContent = legacyKey ? localStorage.getItem(legacyKey) : null;
  let legacyToMigrate = typeof legacyContent === 'string' && legacyContent ? legacyContent : '';
  let saveTimer = 0;
  let revision = 0;
  let saveQueue = Promise.resolve();
  let mostRecentSavedContent = null;
  let latestSavedAt = 0;
  const endpoint = databaseUrl ? notesEndpoint(databaseUrl, uid, idToken) : '';
  let pendingDraftWasRestored = false;

  function persistLocalDraft(content) {
    try {
      localStorage.setItem(pendingKey, JSON.stringify({
        content,
        updatedAt: Date.now(),
      }));
      return true;
    } catch {
      setNotesStatus('Rascunho não pôde ser guardado neste dispositivo.', 'error');
      return false;
    }
  }

  function updateFromInput() {
    revision += 1;
    const content = textarea.value;
    updateCharacterCount(content);
    persistLocalDraft(content);
    if (!endpoint) {
      setNotesStatus('Sem sincronização: falta configurar a base de dados Firebase.', 'error');
      return;
    }
    setNotesStatus('Alterações por sincronizar...');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveNotes(false), SAVE_DELAY);
  }

  function saveNotes(manual) {
    window.clearTimeout(saveTimer);
    const content = textarea.value;
    const contentRevision = revision;
    if (!endpoint) {
      persistLocalDraft(content);
      setNotesStatus('Sem sincronização: configure o Firebase Realtime Database.', 'error');
      return;
    }
    if (content === mostRecentSavedContent) {
      setNotesStatus('Guardado', 'saved');
      return;
    }
    if (manual) setNotesStatus('A guardar...');

    saveQueue = saveQueue.then(async () => {
      const updatedAt = Date.now();
      setNotesStatus('A guardar...');
      const identity = await getAuthenticatedFirebaseIdentity();
      if (identity.uid !== uid) {
        throw new Error('A sessão mudou. Entre novamente antes de sincronizar as notas.');
      }
      const authenticatedEndpoint = notesEndpoint(databaseUrl, uid, identity.idToken);
      await writeFirebaseNotes(authenticatedEndpoint, content, updatedAt);
      mostRecentSavedContent = content;
      latestSavedAt = updatedAt;
      setLastSaved(latestSavedAt);

      if (contentRevision === revision && textarea.value === content) {
        try {
          localStorage.removeItem(pendingKey);
          if (legacyToMigrate && content.includes(legacyToMigrate)) {
            localStorage.removeItem(legacyKey);
            legacyToMigrate = '';
            setVisible('legacyNotice', false);
          }
        } catch {
          setNotesStatus('Notas sincronizadas; não foi possível limpar a cópia antiga deste dispositivo.', 'error');
          return;
        }
        setNotesStatus('Guardado', 'saved');
      } else {
        setNotesStatus('Versão anterior guardada; há alterações por sincronizar.');
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveNotes(false), 0);
      }
    }).catch((error) => {
      setNotesStatus(error.message || 'Erro ao guardar. As notas permanecem no campo.', 'error');
    });
  }

  try {
    textarea.addEventListener('input', updateFromInput);
    saveButton.addEventListener('click', () => saveNotes(true));
    window.addEventListener('online', () => {
      if (endpoint && textarea.value !== mostRecentSavedContent) saveNotes(false);
    });

    if (endpoint) {
      setNotesStatus('A carregar...');
      const remoteNotes = await readFirebaseNotes(endpoint);
      mostRecentSavedContent = remoteNotes?.content ?? '';
      latestSavedAt = remoteNotes?.updatedAt ?? 0;
      setLastSaved(latestSavedAt);

      const pendingDraft = parseDraft(localStorage.getItem(pendingKey) || '');
      if (pendingDraft && pendingDraft.updatedAt > latestSavedAt) {
        pendingDraftWasRestored = true;
        textarea.value = pendingDraft.content;
        setNotesStatus('Rascunho local recuperado — por sincronizar.');
      } else {
        textarea.value = mostRecentSavedContent;
        setNotesStatus(remoteNotes ? 'Notas carregadas.' : 'Ainda não há notas guardadas.');
      }
    } else {
      const pendingDraft = parseDraft(localStorage.getItem(pendingKey) || '');
      textarea.value = pendingDraft?.content || legacyToMigrate;
      setNotesStatus('Sem sincronização: configure o Firebase Realtime Database.', 'error');
    }
    textarea.disabled = false;
    saveButton.disabled = false;
    updateCharacterCount(textarea.value);

    if (legacyToMigrate) {
      setText(
        'legacyMessage',
        mostRecentSavedContent
          ? 'Existe um rascunho antigo guardado apenas neste dispositivo. Pode anexá-lo às notas atuais; a cópia antiga só será apagada após confirmação do Firebase.'
          : 'Existe um rascunho antigo neste dispositivo. Será mantido até o Firebase confirmar a sincronização.'
      );
      setVisible('legacyNotice', true);
      setVisible('importLegacyNotes', true);
      setText(
        'importLegacyNotes',
        mostRecentSavedContent
          ? 'Anexar notas deste dispositivo'
          : 'Migrar notas deste dispositivo'
      );
      importButton.addEventListener('click', () => {
        if (textarea.value.includes(legacyToMigrate)) {
          setNotesStatus('Este rascunho já está incluído nas notas atuais.');
          return;
        }
        if (textarea.value) {
          const separator = '\n\n--- Notas antigas deste dispositivo ---\n\n';
          const imported = `${separator}${legacyToMigrate}`;
          const nextValue = `${textarea.value}${imported}`.slice(0, NOTE_LIMIT);
          if (nextValue === textarea.value) {
            setNotesStatus('Não há espaço para anexar o rascunho antigo.', 'error');
            return;
          }
          legacyToMigrate = imported.trim();
          textarea.value = nextValue;
        } else {
          textarea.value = legacyToMigrate;
        }
        updateFromInput();
      });
    }

    if (
      textarea.value &&
      textarea.value !== mostRecentSavedContent &&
      endpoint &&
      (pendingDraftWasRestored || !legacyToMigrate)
    ) {
      persistLocalDraft(textarea.value);
      setNotesStatus('Há notas por sincronizar.');
      saveTimer = window.setTimeout(() => saveNotes(false), SAVE_DELAY);
    } else if (!endpoint && textarea.value) {
      persistLocalDraft(textarea.value);
    }
  } catch (error) {
    textarea.disabled = false;
    saveButton.disabled = false;
    setNotesStatus(error.message || 'Erro ao carregar as notas. O texto deste dispositivo foi preservado.', 'error');
    const pendingDraft = parseDraft(localStorage.getItem(pendingKey) || '');
    textarea.value = pendingDraft?.content || legacyToMigrate;
    textarea.disabled = false;
    saveButton.disabled = false;
    updateCharacterCount(textarea.value);
  }
}

function safeDatabaseUrl(value) {
  const url = safeHttpsUrl(value);
  if (!url) return '';
  const parsed = new URL(url);
  if (!/\.firebasedatabase\.app$|\.firebaseio\.com$/i.test(parsed.hostname)) return '';
  return parsed.href.replace(/\/+$/, '');
}

function safeYouTubeChannelUrl(value) {
  const url = safeHttpsUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname.toLowerCase())) {
      return '';
    }
    return /^\/@[^/]+\/?$/.test(parsed.pathname) ? parsed.href : '';
  } catch {
    return '';
  }
}

async function initializeLiveRoom() {
  const member = await window.memberSessionReady;
  if (!member) return;

  setText('memberName', member.Nome_Completo || member.Nome_Usuario || 'Membro');
  const status = String(member.Status_Conta || '').trim();
  if (status) {
    setText('memberStatus', `Status: ${status}`);
    setVisible('memberStatus', true);
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    signOutMember();
    window.location.assign('index.html');
  });

  const roomState = getConfiguredRoomState(liveRoomConfig);
  setRoomStatus(roomState);

  try {
    const identity = await getAuthenticatedFirebaseIdentity();
    await initializeNotes(identity.uid, identity.idToken, member.ID_Membro || '');
  } catch (error) {
    setNotesStatus(error.message || 'Não foi possível validar a sessão para carregar as notas.', 'error');
  }
}

function startLiveRoom() {
  initializeLiveRoom().catch(() => {
    setRoomStatus({
      state: 'error',
      label: 'Erro',
      message: 'Não foi possível carregar a sala. Atualize a página ou fale com a equipe.',
    });
  });
}

if (typeof window !== 'undefined' && window.memberSessionReady) {
  startLiveRoom();
}

import { signOutMember } from './member-auth.js';
import { initializeLiveChat } from './live-room-chat.js';
import { liveRoomConfig } from './live-room-config.js';

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
      return {
        state: 'error',
        label: 'Erro na configuração',
        message: 'Não foi possível carregar a transmissão. A equipe deve conferir o URL configurado.',
      };
    }
    return { state: 'live', label: 'Ao vivo' };
  }

  if (status === 'SCHEDULED') return { state: 'scheduled', label: 'Agendada' };
  if (status === 'OFFLINE') return { state: 'offline', label: 'Offline' };
  return {
    state: 'error',
    label: 'Erro na configuração',
    message: 'A configuração da transmissão não é válida. A equipe deve conferir os dados da sala.',
  };
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
    const loadTimer = window.setTimeout(showPlayerError, 12000);
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

  setRoomStatus(getConfiguredRoomState(liveRoomConfig));
  initializeLiveChat(member).catch((error) => {
    const statusElement = document.getElementById('chatStatus');
    statusElement.textContent = error.message || 'Não foi possível ligar ao chat.';
    statusElement.dataset.state = 'error';
  });
}

if (typeof window !== 'undefined' && window.memberSessionReady) {
  initializeLiveRoom().catch(() => {
    setRoomStatus({
      state: 'error',
      label: 'Erro',
      message: 'Não foi possível carregar a sala. Atualize a página ou fale com a equipe.',
    });
  });
}

import { firebaseConfig } from './firebase-config.js';

const APP_SCRIPT_URL = '/api/membros';
const SESSION_KEY = 'serTraderFirebaseSession';
const MEMBER_KEY = 'serTraderMember';
const AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'CONFIGURE_FIREBASE_WEB_API_KEY'
  );
}

function requireFirebaseConfig() {
  if (!isFirebaseConfigured()) {
    throw new Error('A autenticação ainda não está configurada. Consulte membros/INSTRUCOES_FIREBASE.mb.');
  }
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = data.error?.message || '';
    const messages = {
      EMAIL_EXISTS: 'Este e-mail já possui uma conta. Entre ou redefina a senha.',
      EMAIL_NOT_FOUND: 'E-mail ou senha inválidos.',
      INVALID_PASSWORD: 'E-mail ou senha inválidos.',
      INVALID_LOGIN_CREDENTIALS: 'E-mail ou senha inválidos.',
      USER_DISABLED: 'Esta conta está desativada. Fale com o suporte.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Aguarde e tente novamente.',
      WEAK_PASSWORD: 'A senha deve ter pelo menos 8 caracteres.',
      INVALID_EMAIL: 'Informe um endereço de e-mail válido.',
      API_KEY_INVALID: 'A configuração do Firebase está inválida. Confira membros/assets/firebase-config.js.',
      OPERATION_NOT_ALLOWED: 'Ative o provedor E-mail/senha nas configurações de autenticação do Firebase.',
      EXPIRED_OOB_CODE: 'Este link expirou. Solicite uma nova recuperação.',
      INVALID_OOB_CODE: 'Este link não é válido. Solicite uma nova recuperação.',
    };
    const error = new Error(messages[code] || 'Não foi possível concluir a autenticação. Verifique os dados e tente novamente.');
    error.code = code;
    throw error;
  }

  return data;
}

async function firebaseRequest(action, body) {
  requireFirebaseConfig();
  const response = await fetch(`${AUTH_BASE_URL}:${action}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

async function appsScriptRequest(payload) {
  const response = await fetch(APP_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error('Não foi possível validar a conta com o servidor. Tente novamente mais tarde.');
  }

  return data;
}

function clearLocalSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(MEMBER_KEY);
  localStorage.removeItem(MEMBER_KEY);
}

export async function createMemberAccount({ email, password, registration }) {
  clearLocalSession();
  const normalizedEmail = email.trim().toLowerCase();
  let account;
  try {
    account = await firebaseRequest('signUp', {
      email: normalizedEmail,
      password,
      returnSecureToken: true,
    });
  } catch (error) {
    if (error.code !== 'EMAIL_EXISTS') throw error;
    account = await firebaseRequest('signInWithPassword', {
      email: normalizedEmail,
      password,
      returnSecureToken: true,
    });
  }

  if (account.emailVerified !== true) {
    await firebaseRequest('sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: account.idToken,
    });
  }

  const result = await appsScriptRequest({
    ...registration,
    action: 'register',
    email: normalizedEmail,
    firebaseIdToken: account.idToken,
  });

  if (!result.success) {
    throw new Error(result.message || 'Não foi possível enviar o cadastro.');
  }
}

export async function requestPasswordReset(email) {
  try {
    await firebaseRequest('sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email: email.trim().toLowerCase(),
    });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_FOUND' || error.code === 'INVALID_EMAIL') return;
    throw error;
  }
}

async function refreshFirebaseToken(session) {
  const response = await fetch(`${TOKEN_URL}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.id_token) {
    clearLocalSession();
    throw new Error('Sua sessão expirou. Entre novamente.');
  }

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

async function getValidToken() {
  requireFirebaseConfig();
  const rawSession = sessionStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    throw new Error('Entre para continuar.');
  }

  let session;
  try {
    session = JSON.parse(rawSession);
  } catch {
    clearLocalSession();
    throw new Error('Sua sessão está inválida. Entre novamente.');
  }

  if (!session.refreshToken || !session.idToken) {
    clearLocalSession();
    throw new Error('Sua sessão está inválida. Entre novamente.');
  }

  if (Date.now() > session.expiresAt - 60_000) {
    session = await refreshFirebaseToken(session);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session.idToken;
}

export async function authenticateMember(email, password) {
  clearLocalSession();
  const account = await firebaseRequest('signInWithPassword', {
    email: email.trim().toLowerCase(),
    password,
    returnSecureToken: true,
  });

  if (account.emailVerified !== true) {
    throw new Error('Confirme seu e-mail pelo link enviado antes de entrar.');
  }

  const session = {
    idToken: account.idToken,
    refreshToken: account.refreshToken,
    expiresAt: Date.now() + Number(account.expiresIn) * 1000,
  };

  const result = await appsScriptRequest({
    action: 'memberSession',
    firebaseIdToken: account.idToken,
  });

  if (!result.success) {
    throw new Error(result.message || 'Sua conta ainda não tem acesso ativo.');
  }

  clearLocalSession();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(MEMBER_KEY, JSON.stringify(result.member));
  return result.member;
}

export async function validateMemberSession() {
  try {
    const idToken = await getValidToken();
    const result = await appsScriptRequest({
      action: 'memberSession',
      firebaseIdToken: idToken,
    });

    if (!result.success) {
      clearLocalSession();
      return { valid: false, status: result.status || '' };
    }

    sessionStorage.setItem(MEMBER_KEY, JSON.stringify(result.member));
    return { valid: true, member: result.member };
  } catch (error) {
    clearLocalSession();
    return { valid: false, error };
  }
}

export function signOutMember() {
  clearLocalSession();
}

export function getCachedMember() {
  const rawMember = sessionStorage.getItem(MEMBER_KEY);
  if (!rawMember) return {};

  try {
    return JSON.parse(rawMember);
  } catch {
    sessionStorage.removeItem(MEMBER_KEY);
    return {};
  }
}

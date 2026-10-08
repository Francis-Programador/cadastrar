const APP_CONFIG = {
  appScriptUrl: '/api/membros',
  cloudinary: {
    cloudName: 'dgj5l53mw',
    uploadPreset: 'kvn6gum3',
    apiKey: '926288465169768'
  }
};

const APP_SCRIPT_URL = APP_CONFIG.appScriptUrl;
const CLOUDINARY_CLOUD_NAME = APP_CONFIG.cloudinary.cloudName;
const CLOUDINARY_UPLOAD_PRESET = APP_CONFIG.cloudinary.uploadPreset;
const CLOUDINARY_API_KEY = APP_CONFIG.cloudinary.apiKey;

function buildServerErrorMessage({ status, rawText = '', route = '/api/membros', redirected = false } = {}) {
  const responseText = String(rawText || '');
  const normalizedResponse = responseText.toLowerCase();
  const preview = responseText.slice(0, 180).replace(/\s+/g, ' ');
  const isHtmlResponse = preview.toLowerCase().includes('<!doctype') || preview.toLowerCase().includes('<html');

  if (normalizedResponse.includes('unable to verify the first certificate')) {
    return 'O Live Server não conseguiu validar o certificado HTTPS do Apps Script. Para cadastrar membros, pare o Live Server, execute npm run dev na pasta do projeto e abra http://localhost:8080/membros/. Não use o botão “Go Live” nesta página.';
  }

  if (normalizedResponse.includes('página não encontrada') && normalizedResponse.includes('google drive')) {
    return `A URL /exec configurada abriu uma página “Página não encontrada” do Google Drive. Atualize o proxy ${route} com a URL da implantação publicada do Apps Script de membros.`;
  }

  if (redirected || status === 301 || status === 302) {
    return `O Apps Script respondeu com redirecionamento (${status}) em vez de JSON. Verifique se a Web App do Google Apps Script está publicada com URL /exec e se o proxy do projeto aponta para essa mesma URL. Em localhost, rode o Vite com npm run dev. Em produção, configure o redirect do Netlify para ${route} apontando para o Apps Script publicado.`;
  }

  if (status === 404 || isHtmlResponse) {
    const htmlHint = isHtmlResponse ? ' O servidor respondeu com HTML em vez de JSON.' : '';
    return `Resposta inválida do servidor (${status}). a rota ${route} não está sendo encaminhada corretamente.${htmlHint} Confirme se o Vite está rodando em localhost ou se o Netlify está redirecionando ${route} para a URL /exec publicada do Apps Script.`;
  }

  if (!preview) {
    return `O servidor respondeu sem conteúdo JSON (status ${status}). Confirme se ${route} aponta para o Apps Script de membros publicado e se as funções doPost/doGet estão retornando JSON.`;
  }

  return `Resposta inválida do servidor: ${preview}`;
}

function validateConfig() {
  const hasAppScript = (APP_SCRIPT_URL.includes('script.google.com') || APP_SCRIPT_URL.startsWith('/api/')) && !APP_SCRIPT_URL.includes('SEU_ID_DO_WEB_APP');
  const hasCloudinary = CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== 'SEU_CLOUD_NAME' && CLOUDINARY_UPLOAD_PRESET && CLOUDINARY_UPLOAD_PRESET !== 'SEU_UPLOAD_PRESET';

  return hasAppScript && hasCloudinary;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();

  if (!rawText) {
    return { success: false, message: `Servidor respondeu vazio (status ${response.status}).` };
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error(buildServerErrorMessage({
      status: response.status,
      rawText,
      route: APP_SCRIPT_URL,
      redirected: response.redirected || response.status === 302 || response.status === 301
    }));
  }
}

if (typeof document !== 'undefined') {
  const tabs = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');
  const messageBox = document.getElementById('authMessage');

  function setMessage(text, type = 'info') {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = 'message ' + type;
  }

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('serTraderMember')) {
    window.location.href = 'dashboard.html';
  }

  if (!validateConfig()) {
    setMessage('Configure primeiro as credenciais do Apps Script e do Cloudinary no arquivo membros/assets/auth.js antes de publicar.', 'error');
  }

  tabs.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      tabs.forEach((item) => item.classList.toggle('active', item === button));
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === (target === 'login' ? 'login-panel' : 'signup-panel'));
      });
      setMessage('', 'info');
    });
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!formData.get('aceiteTermos')) {
      setMessage('Você precisa aceitar os termos para finalizar o cadastro.', 'error');
      return;
    }

    const file = formData.get('comprovante');
    const nomeUsuario = String(formData.get('nomeUsuario') || '').trim();

    if (!file || !file.name) {
      setMessage('Selecione um comprovante de pagamento.', 'error');
      return;
    }

    if (!nomeUsuario || nomeUsuario.length < 3) {
      setMessage('Informe um nome de usuário válido com pelo menos 3 caracteres.', 'error');
      return;
    }

    try {
      setMessage('Enviando comprovante e registrando seu acesso...', 'info');
      const comprovanteUrl = await uploadComprovante(file);
      formData.set('comprovanteUrl', comprovanteUrl);

      const payload = buildMemberPayload(formData);

      const response = await fetch(APP_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const rawText = await response.text();
      let result = {};

      try {
        result = JSON.parse(rawText);
      } catch (error) {
        throw new Error(buildServerErrorMessage({
          status: response.status,
          rawText,
          route: APP_SCRIPT_URL,
          redirected: response.redirected || response.status === 302 || response.status === 301
        }));
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Não foi possível concluir o cadastro.');
      }

      setMessage('Cadastro recebido! Assim que validarmos a sua mensalidade, seu acesso será ativado.', 'success');
      form.reset();
    } catch (error) {
      setMessage(error.message || 'Ocorreu um erro ao processar o cadastro.', 'error');
    }
  });

  document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim();

    if (!identifier) {
      setMessage('Informe seu usuário ou e-mail para continuar.', 'error');
      return;
    }

    try {
      setMessage('Validando suas credenciais...', 'info');

      const params = new URLSearchParams({
        action: 'login',
        usuario: identifier
      });

      const result = await fetchJson(`${APP_SCRIPT_URL}?${params.toString()}`);

      if (!result.success) {
        throw new Error(result.message || 'Credenciais inválidas.');
      }

      const user = result.user || {};
      sessionStorage.setItem('serTraderMember', JSON.stringify({
        Nome_Completo: user.nome || '',
        Nome_Usuario: user.usuario || identifier,
        Status_Conta: result.status || 'Ativo',
        Data_Vencimento: user.vencimento || ''
      }));
      window.location.href = 'dashboard.html';
    } catch (error) {
      setMessage(error.message || 'Não foi possível entrar no sistema.', 'error');
    }
  });
}

if (typeof window !== 'undefined') {
  window.buildServerErrorMessage = buildServerErrorMessage;
}

export { buildServerErrorMessage };

async function uploadComprovante(file) {
  if (!file) {
    throw new Error('Selecione o comprovante de pagamento antes de continuar.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('folder', 'verificacao_prints');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Não foi possível enviar o comprovante no momento.');
  }

  return result.secure_url;
}

function buildMemberPayload(formData) {
  return {
    action: 'register',
    nomeCompleto: formData.get('nomeCompleto'),
    usuario: formData.get('nomeUsuario'),
    email: formData.get('email'),
    whatsapp: formData.get('whatsapp'),
    idade: formData.get('idade'),
    pais: formData.get('paisResidencia'),
    urlComprovante: formData.get('comprovanteUrl') || '',
    aceiteTermos: formData.get('aceiteTermos') ? true : false
  };
}

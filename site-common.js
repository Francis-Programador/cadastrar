(function () {
  const verificationUrl = 'https://central-trader-sem-re.netlify.app/verificacao';
  const donationUrl = 'https://central-trader-sem-re.netlify.app/doacao';
  const siteLogoUrl = new URL('./static/img/logo_do_site.png', import.meta.url).href;
  const isNested = window.location.pathname.includes('/recursos/') || window.location.pathname.includes('/navegacao/');
  const pageRoot = isNested ? '..' : '.';

  const resolveRelative = (file) => `${pageRoot}/${file}`.replace(/\/+/g, '/');

  function ensureLoader() {
    if (document.querySelector('.site-page-loader')) return;
    const loader = document.createElement('div');
    loader.className = 'site-page-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-label', 'Carregando');
    loader.innerHTML = `<div class="site-loader-ring"><img class="site-loader-logo" src="${siteLogoUrl}" alt=""></div>`;
    document.body.appendChild(loader);

    window.addEventListener('load', () => {
      const currentLoader = document.querySelector('.site-page-loader');
      if (currentLoader) currentLoader.remove();
    }, { once: true });
  }

  function ensureActionButtons() {
    const header = document.querySelector('.header');
    if (!header || header.querySelector('[data-help-action="doar"]')) return;

    const group = document.createElement('div');
    group.className = 'page-cta-group';
    group.innerHTML = `
      <button type="button" class="btn btn-secondary page-action-btn" data-help-action="doar"><i class="fa-solid fa-heart" aria-hidden="true"></i> Doar</button>
      <button type="button" class="btn btn-save page-action-btn" data-help-action="materiais"><i class="fa-solid fa-box-open" aria-hidden="true"></i> Adquirir materiais</button>
    `;
    header.appendChild(group);
  }

  function ensureModal() {
    if (document.getElementById('helpModal')) return;

    const modal = document.createElement('div');
    modal.id = 'helpModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-content">
        <button type="button" class="modal-close" data-close-help aria-label="Fechar ajuda">✖</button>
        <h2>Ajuda e FAQ</h2>
        <div data-help-panel="geral">
          <p>Este projeto reúne ferramentas e materiais educativos para apoiar uma rotina de trading com gestão e disciplina.</p>
          <strong>Perguntas frequentes</strong>
          <ul>
            <li>O conteúdo é uma recomendação financeira? Não. É estritamente educacional.</li>
            <li>É necessário enviar dados para navegar? Não. Os dados só são solicitados quando necessários para um pedido de material.</li>
          </ul>
          <p>Dúvidas gerais: <a href="mailto:ser.tradersemre@gmail.com">ser.tradersemre@gmail.com</a></p>
          <div class="help-actions">
            <button type="button" class="btn btn-secondary" data-close-help>Fechar</button>
            <a class="btn btn-save" href="mailto:ser.tradersemre@gmail.com?subject=Pergunta%20SER%20TRADER%20SEM%20R%C3%89">Enviar dúvida</a>
          </div>
        </div>
        <div data-help-panel="doar" hidden>
          <p>Redirecionando para a página de doação voluntária...</p>
        </div>
        <div data-help-panel="materiais" hidden>
          <p>Siga os perfis oficiais e prepare capturas de tela que mostrem que você está seguindo. A página de verificação poderá solicitar essas imagens.</p>
          <nav class="acquisition-socials" aria-label="Redes sociais oficiais">
            <a href="https://cutt.ly/3ser_trader_youtube" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-youtube" aria-hidden="true"></i> YouTube</a>
            <a href="https://cutt.ly/ser_trader_instagram" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-instagram" aria-hidden="true"></i> Instagram</a>
            <a href="https://cutt.ly/sertrader_tiktok" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-tiktok" aria-hidden="true"></i> TikTok</a>
            <a href="https://cutt.ly/ser_trader_telegram" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram" aria-hidden="true"></i> Telegram</a>
            <a href="https://wa.me/244941674486" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>
          </nav>
          <div class="acquisition-product-field">
            <label for="acquisitionProductCode">Material ou curso solicitado</label>
            <input id="acquisitionProductCode" type="text" autocomplete="off" maxlength="80" placeholder="Ex.: Introdução ao Trading ou CUR-220" required>
            <small>O nome ou código será enviado à página de verificação.</small>
          </div>
          <label class="acquisition-confirm">
            <input type="checkbox" id="acquisitionSocialConfirm">
            <span>Segui as redes sociais e preparei os prints para apresentar na verificação.</span>
          </label>
          <p class="acquisition-error" id="acquisitionError" role="alert" hidden>Informe o material ou curso e confirme que seguiu as redes e preparou os prints.</p>
          <div class="help-actions">
            <button type="button" class="btn btn-secondary" data-close-help>Fechar</button>
            <button type="button" class="btn btn-save" data-continue-acquisition disabled>Continuar para verificação</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const productCodeInput = modal.querySelector('#acquisitionProductCode');
    const socialConfirm = modal.querySelector('#acquisitionSocialConfirm');
    const continueButton = modal.querySelector('[data-continue-acquisition]');
    const acquisitionError = modal.querySelector('#acquisitionError');

    const updateAcquisitionState = () => {
      continueButton.disabled = !productCodeInput.value.trim() || !socialConfirm.checked;
      acquisitionError.hidden = true;
    };

    productCodeInput.addEventListener('input', updateAcquisitionState);
    socialConfirm.addEventListener('change', updateAcquisitionState);
    continueButton.addEventListener('click', () => {
      const requestedProduct = productCodeInput.value.trim();
      const product = /^[a-z]{3}-\d+$/i.test(requestedProduct)
        ? requestedProduct.toUpperCase()
        : requestedProduct;
      if (!product || !socialConfirm.checked) {
        acquisitionError.hidden = false;
        return;
      }

      try {
        localStorage.setItem('centralTraderProductCode', product);
      } catch (error) {
        console.warn('O item será enviado pela URL, mas não foi possível salvá-lo localmente.', error);
      }

      const destination = new URL(verificationUrl);
      destination.searchParams.set('produto', product);
      window.location.assign(destination.href);
    });

    const closeButtons = modal.querySelectorAll('[data-close-help]');
    closeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.style.display = 'none';
    });
  }

  function openHelp(type = 'geral', productCode = '') {
    const modal = document.getElementById('helpModal');
    if (!modal) return;

    const activePanel = type === 'materiais' ? 'materiais' : 'geral';
    if (activePanel === 'materiais') {
      const productCodeInput = modal.querySelector('#acquisitionProductCode');
      const socialConfirm = modal.querySelector('#acquisitionSocialConfirm');
      productCodeInput.value = productCode;
      socialConfirm.checked = false;
      modal.querySelector('[data-continue-acquisition]').disabled = !productCodeInput.value.trim() || !socialConfirm.checked;
      modal.querySelector('#acquisitionError').hidden = true;
    }
    const title = modal.querySelector('h2');
    if (title) {
      title.textContent = {
        geral: 'Ajuda e FAQ',
        materiais: 'Adquirir materiais'
      }[activePanel];
    }

    modal.querySelectorAll('[data-help-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.helpPanel !== activePanel;
    });

    modal.style.display = 'flex';
  }

  function attachHelpBindings() {
    const helpButton = document.getElementById('helpBtn');
    if (helpButton) {
      helpButton.addEventListener('click', () => openHelp('geral'));
    }

    document.querySelectorAll('[data-help-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        if (button.dataset.helpAction === 'doar') {
          window.location.assign(donationUrl);
          return;
        }
        const productName = button.tagName === 'A'
          ? button.textContent.replace(/\s+/g, ' ').trim()
          : '';
        openHelp(button.dataset.helpAction, productName);
      });
    });

    document.querySelectorAll('[data-acquire-product]').forEach((button) => {
      button.addEventListener('click', () => openHelp('materiais', button.dataset.acquireProduct));
    });
  }

  function loadFooter() {
    const host = document.querySelector('[data-footer]');
    if (!host) return;

    fetch(resolveRelative('footer.html'))
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar o rodapé.');
        return response.text();
      })
      .then((html) => {
        host.innerHTML = html;
        host.querySelector('[data-footer-home]').href = resolveRelative('navegacao/dashboard.html');
        host.querySelector('[data-footer-resources]').href = resolveRelative('navegacao/recursos.html');
        host.querySelector('[data-footer-logo]').src = siteLogoUrl;
      })
      .catch((error) => console.error(error));
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureLoader();
    ensureModal();
    ensureActionButtons();
    attachHelpBindings();
    loadFooter();
  });
})();

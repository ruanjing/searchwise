const GrowthVaultI18n = (() => {
  let customMessages = null;
  let currentLang = 'auto';

  function getMessage(key, placeholders = []) {
    if (customMessages && customMessages[key]) {
      const entry = customMessages[key];
      let msg = entry.message || '';
      
      if (entry.placeholders) {
        Object.keys(entry.placeholders).forEach((pName) => {
          const pConfig = entry.placeholders[pName];
          if (pConfig && pConfig.content) {
            const match = pConfig.content.match(/\$(\d+)/);
            if (match) {
              const argIndex = parseInt(match[1], 10) - 1;
              if (argIndex >= 0 && argIndex < placeholders.length) {
                msg = msg.replace(new RegExp(`\\$${pName}\\$`, 'gi'), placeholders[argIndex]);
              }
            }
          }
        });
      } else if (placeholders && placeholders.length > 0) {
        placeholders.forEach((val, index) => {
          msg = msg.replace(new RegExp(`\\$${index + 1}`, 'g'), val);
        });
      }
      return msg;
    }
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key, placeholders);
    }
    return '';
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const message = getMessage(key);
      if (message) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.setAttribute('placeholder', message);
        } else {
          element.textContent = message;
        }
      }
    });

    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      const key = titleEl.getAttribute('data-i18n');
      const message = getMessage(key);
      if (message) {
        document.title = message;
      }
    }
  }

  async function init() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.get(['growthvault_language'], async (res) => {
        const lang = res.growthvault_language || 'auto';
        currentLang = lang;
        if (lang !== 'auto') {
          try {
            const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
            const response = await fetch(url);
            customMessages = await response.json();
          } catch (e) {
            console.error('Failed to load custom locale file', e);
          }
        }
        translatePage();
        document.dispatchEvent(new CustomEvent('gv-i18n-ready'));
        resolve();
      });
    });
  }

  function setLanguage(lang) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ growthvault_language: lang }, () => {
        window.location.reload();
      });
    }
  }

  function getActiveLanguage() {
    if (currentLang !== 'auto') return currentLang;
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      const uiLang = chrome.i18n.getUILanguage();
      if (uiLang.toLowerCase().startsWith('zh')) return 'zh_CN';
    }
    return 'en';
  }

  function renderLanguageSwitcher(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'gv-lang-switcher';
    wrapper.style.marginTop = '24px';
    wrapper.style.paddingTop = '16px';
    wrapper.style.borderTop = '1px solid #1d6f5f';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '6px';

    const label = document.createElement('label');
    label.style.color = '#c7f3e6';
    label.style.fontSize = '12px';
    label.textContent = getActiveLanguage() === 'zh_CN' ? '语言 / Language' : 'Language / 语言';
    
    const select = document.createElement('select');
    select.style.padding = '6px 8px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #1d6f5f';
    select.style.background = '#163b35';
    select.style.color = '#fff';
    select.style.fontSize = '12px';
    select.style.cursor = 'pointer';
    select.style.fontFamily = 'inherit';
    select.style.width = '100%';

    const options = [
      { value: 'auto', text: getActiveLanguage() === 'zh_CN' ? '跟随浏览器 (Auto)' : 'Auto (Browser)' },
      { value: 'en', text: 'English' },
      { value: 'zh_CN', text: '简体中文' }
    ];

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      if (currentLang === opt.value) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      setLanguage(select.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  }

  const initPromise = init();

  return {
    getMessage,
    translatePage,
    getActiveLanguage,
    setLanguage,
    renderLanguageSwitcher,
    initPromise
  };
})();

// DraftWise - popup controller.
(function () {
  'use strict';

  const SETTINGS_KEY = 'draftwise_settings';
  const DRAFT_PREFIX = 'draftwise_draft_';
  const DEFAULT_SETTINGS = {
    globalEnabled: true,
    disabledHosts: [],
    maxDrafts: 200,
    retentionDays: 30,
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    tab: null,
    host: '',
  };

  const $ = id => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    applyI18n();
    await loadActiveTab();
    await loadSettings();
    await ensureContentScript();
    bindEvents();
    await render();
  }

  async function loadActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tab = tab || null;
    try {
      state.host = tab?.url ? new URL(tab.url).hostname.toLowerCase() : '';
    } catch {
      state.host = '';
    }
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(data[SETTINGS_KEY] || {}),
    };
  }

  function bindEvents() {
    $('global-toggle').addEventListener('change', async event => {
      state.settings.globalEnabled = event.target.checked;
      await saveSettings();
      await notifyContentScript();
      await render();
    });

    $('site-toggle').addEventListener('change', async event => {
      if (!state.host) return;
      const disabled = new Set(state.settings.disabledHosts || []);
      if (event.target.checked) {
        disabled.delete(state.host);
      } else {
        disabled.add(state.host);
      }
      state.settings.disabledHosts = Array.from(disabled).sort();
      await saveSettings();
      await notifyContentScript();
      await render();
    });

    $('clear-site').addEventListener('click', async () => {
      if (!state.host) return;
      const keys = await draftKeys(draft => draft.host === state.host);
      if (keys.length) await chrome.storage.local.remove(keys);
      showMessage(t('cleared'));
      await render();
    });

    $('clear-all').addEventListener('click', async () => {
      const keys = await draftKeys(() => true);
      if (keys.length) await chrome.storage.local.remove(keys);
      showMessage(t('cleared'));
      await render();
    });
  }

  async function render() {
    const drafts = await allDrafts();
    const siteDrafts = state.host ? drafts.filter(draft => draft.value.host === state.host) : [];
    const last = drafts.reduce((max, draft) => Math.max(max, Number(draft.value.updatedAt || 0)), 0);
    const siteEnabled = !!state.host && !(state.settings.disabledHosts || []).includes(state.host);

    $('site-label').textContent = state.host || t('openPageFirst');
    $('global-toggle').checked = !!state.settings.globalEnabled;
    $('site-toggle').checked = siteEnabled;
    $('site-toggle').disabled = !state.host;
    $('clear-site').disabled = !state.host || siteDrafts.length === 0;
    $('clear-all').disabled = drafts.length === 0;

    $('global-status').textContent = state.settings.globalEnabled ? t('enabled') : t('disabled');
    $('site-status').textContent = siteEnabled ? t('enabled') : t('disabled');
    $('total-count').textContent = String(drafts.length);
    $('site-count').textContent = String(siteDrafts.length);
    $('last-saved').textContent = last ? formatTime(last) : t('never');
  }

  async function saveSettings() {
    await chrome.storage.local.set({ [SETTINGS_KEY]: state.settings });
  }

  async function ensureContentScript() {
    if (!state.tab?.id || !isWebPage(state.tab.url)) return false;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: state.tab.id },
        files: ['content/draftwise.js'],
      });
      return true;
    } catch {
      return false;
    }
  }

  async function notifyContentScript() {
    if (!state.tab?.id) return;
    try {
      await ensureContentScript();
      await chrome.tabs.sendMessage(state.tab.id, { type: 'DRAFTWISE_REFRESH_SETTINGS' });
    } catch {
      // The current tab might be a browser page or a site where the content script is unavailable.
    }
  }

  async function allDrafts() {
    const data = await chrome.storage.local.get(null);
    return Object.entries(data)
      .filter(([key, value]) => key.startsWith(DRAFT_PREFIX) && value?.updatedAt)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => Number(b.value.updatedAt || 0) - Number(a.value.updatedAt || 0));
  }

  async function draftKeys(predicate) {
    return (await allDrafts())
      .filter(({ value }) => predicate(value))
      .map(({ key }) => key);
  }

  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  }

  function isWebPage(url) {
    return /^https?:\/\//i.test(url || '');
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
  }

  function showMessage(text) {
    const message = $('message');
    message.textContent = text;
    message.hidden = false;
    setTimeout(() => {
      message.hidden = true;
    }, 1600);
  }

  function t(key) {
    return chrome.i18n.getMessage(key) || key;
  }
})();

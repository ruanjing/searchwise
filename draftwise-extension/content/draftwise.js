// DraftWise - local form draft autosave content script.
(function () {
  'use strict';

  const SETTINGS_KEY = 'draftwise_settings';
  const DRAFT_PREFIX = 'draftwise_draft_';
  const STATE = {
    settings: {
      globalEnabled: true,
      disabledHosts: [],
      maxDrafts: 200,
      retentionDays: 30,
    },
    fields: new WeakMap(),
    restoreItems: new Map(),
    saveTimers: new WeakMap(),
    lastSavedToast: 0,
    scanTimer: null,
  };

  const SENSITIVE_PATTERN = /(pass|password|passwd|pwd|token|secret|auth|otp|2fa|mfa|code|pin|card|cc-|credit|cvv|cvc|iban|ssn|social|private|key)/i;
  const INPUT_TYPES = new Set([
    'text',
    'search',
    'email',
    'url',
    'tel',
    'number',
    'date',
    'datetime-local',
    'month',
    'time',
    'week',
  ]);

  init();

  async function init() {
    if (!chrome.runtime?.id) return;
    await loadSettings();
    if (!isEnabledForPage()) return;

    injectStyles();
    await scanFields();
    bindGlobalEvents();
    scheduleCleanup();
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get({
      [SETTINGS_KEY]: STATE.settings,
    });
    STATE.settings = {
      ...STATE.settings,
      ...(data[SETTINGS_KEY] || {}),
    };
  }

  function isEnabledForPage() {
    if (!STATE.settings.globalEnabled) return false;
    const host = location.hostname.toLowerCase();
    return !(STATE.settings.disabledHosts || []).includes(host);
  }

  function bindGlobalEvents() {
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('submit', handleSubmit, true);

    const observer = new MutationObserver(() => {
      clearTimeout(STATE.scanTimer);
      STATE.scanTimer = setTimeout(scanFields, 600);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleRuntimeMessage(message).then(sendResponse);
      return true;
    });
  }

  async function handleRuntimeMessage(message) {
    if (!message || typeof message !== 'object') return {};

    if (message.type === 'DRAFTWISE_GET_PAGE_INFO') {
      return {
        ok: true,
        host: location.hostname,
        origin: location.origin,
        enabled: isEnabledForPage(),
      };
    }

    if (message.type === 'DRAFTWISE_REFRESH_SETTINGS') {
      await loadSettings();
      if (isEnabledForPage()) {
        await scanFields();
      } else {
        removeRestoreUi();
      }
      return { ok: true, enabled: isEnabledForPage() };
    }

    return {};
  }

  async function scanFields() {
    if (!isEnabledForPage()) return;

    const candidates = Array.from(document.querySelectorAll('textarea, input, [contenteditable=""], [contenteditable="true"]'));
    const fields = candidates.filter(isSupportedField);
    const keys = fields.map(field => fieldKey(field));
    const draftKeys = keys.map(key => draftStorageKey(key));
    const stored = draftKeys.length ? await chrome.storage.local.get(draftKeys) : {};

    fields.forEach((field, index) => {
      const key = keys[index];
      const storageKey = draftStorageKey(key);
      const draft = stored[storageKey];
      STATE.fields.set(field, { key, storageKey });

      if (draft?.value && isEmptyField(field)) {
        addRestoreControl(field, draft);
      }
    });

    showPageRestoreNotice();
  }

  function isSupportedField(field) {
    if (!(field instanceof HTMLElement)) return false;
    if (field.closest('[data-draftwise-ignore], [data-no-draftwise]')) return false;
    if (field.isContentEditable) return isEditableTextField(field);

    const tag = field.tagName.toLowerCase();
    if (tag === 'textarea') return !isSensitiveField(field);
    if (tag !== 'input') return false;

    const type = String(field.getAttribute('type') || 'text').toLowerCase();
    if (!INPUT_TYPES.has(type)) return false;
    if (field.disabled || field.readOnly) return false;
    return !isSensitiveField(field);
  }

  function isEditableTextField(field) {
    if (field.closest('code, pre')) return false;
    if (field.getAttribute('role') === 'textbox') return !isSensitiveField(field);
    return !isSensitiveField(field);
  }

  function isSensitiveField(field) {
    const type = String(field.getAttribute('type') || '').toLowerCase();
    if (['password', 'hidden', 'file', 'checkbox', 'radio'].includes(type)) return true;

    const autocomplete = String(field.getAttribute('autocomplete') || '').toLowerCase();
    if (['current-password', 'new-password', 'one-time-code', 'cc-number', 'cc-csc'].includes(autocomplete)) {
      return true;
    }

    const combined = [
      field.id,
      field.name,
      field.getAttribute('aria-label'),
      field.getAttribute('placeholder'),
      field.getAttribute('data-testid'),
      field.getAttribute('data-test'),
    ].filter(Boolean).join(' ');

    return SENSITIVE_PATTERN.test(combined);
  }

  function handleInput(event) {
    const field = event.target;
    if (!isSupportedField(field)) return;

    const info = STATE.fields.get(field) || {
      key: fieldKey(field),
      storageKey: draftStorageKey(fieldKey(field)),
    };
    STATE.fields.set(field, info);

    clearTimeout(STATE.saveTimers.get(field));
    STATE.saveTimers.set(field, setTimeout(() => saveField(field, info), 700));
  }

  async function saveField(field, info) {
    const value = getFieldValue(field);
    if (!value.trim()) {
      await chrome.storage.local.remove(info.storageKey);
      removeRestoreControl(field);
      return;
    }

    const draft = {
      value,
      pageUrl: location.href,
      origin: location.origin,
      host: location.hostname,
      path: location.pathname,
      title: document.title,
      label: fieldLabel(field),
      updatedAt: Date.now(),
      fieldType: fieldDescriptor(field),
    };

    await chrome.storage.local.set({ [info.storageKey]: draft });
    showSavedToast();
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const fields = Array.from(form.querySelectorAll('textarea, input, [contenteditable=""], [contenteditable="true"]'))
      .filter(isSupportedField);
    const keys = fields.map(field => {
      const info = STATE.fields.get(field);
      return info?.storageKey || draftStorageKey(fieldKey(field));
    });
    if (keys.length) chrome.storage.local.remove(keys);
  }

  function addRestoreControl(field, draft) {
    if (STATE.restoreItems.has(field)) return;

    const row = document.createElement('div');
    row.className = 'draftwise-restore-row';
    row.innerHTML = `
      <button type="button" class="draftwise-restore-btn">${escapeHtml(t('restoreDraft'))}</button>
      <button type="button" class="draftwise-discard-btn">${escapeHtml(t('discardDraft'))}</button>
    `;

    row.querySelector('.draftwise-restore-btn').addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setFieldValue(field, draft.value);
      removeRestoreControl(field);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.focus();
    });

    row.querySelector('.draftwise-discard-btn').addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      const info = STATE.fields.get(field);
      if (info) await chrome.storage.local.remove(info.storageKey);
      removeRestoreControl(field);
      showPageRestoreNotice();
    });

    const parent = field.parentElement;
    if (parent) {
      parent.insertBefore(row, field.nextSibling);
      STATE.restoreItems.set(field, row);
    }
  }

  function removeRestoreControl(field) {
    const row = STATE.restoreItems.get(field);
    if (row) row.remove();
    STATE.restoreItems.delete(field);
    showPageRestoreNotice();
  }

  function removeRestoreUi() {
    STATE.restoreItems.forEach(row => row.remove());
    STATE.restoreItems.clear();
    const notice = document.getElementById('draftwise-page-notice');
    if (notice) notice.remove();
  }

  function showPageRestoreNotice() {
    const count = STATE.restoreItems.size;
    const existing = document.getElementById('draftwise-page-notice');
    if (!count) {
      if (existing) existing.remove();
      return;
    }

    const notice = existing || document.createElement('div');
    notice.id = 'draftwise-page-notice';
    notice.innerHTML = `
      <span>${escapeHtml(t('draftFound'))}</span>
      <button type="button" data-action="restore">${escapeHtml(t('restoreAll'))}</button>
      <button type="button" data-action="dismiss">${escapeHtml(t('dismiss'))}</button>
    `;

    if (!existing) {
      notice.addEventListener('click', event => {
        const action = event.target?.dataset?.action;
        if (action === 'restore') {
          Array.from(STATE.restoreItems.keys()).forEach(field => {
            const row = STATE.restoreItems.get(field);
            row?.querySelector('.draftwise-restore-btn')?.click();
          });
        }
        if (action === 'dismiss') {
          const node = document.getElementById('draftwise-page-notice');
          if (node) node.remove();
        }
      });
      document.documentElement.appendChild(notice);
    }
  }

  function showSavedToast() {
    const now = Date.now();
    if (now - STATE.lastSavedToast < 5000) return;
    STATE.lastSavedToast = now;

    let toast = document.getElementById('draftwise-saved-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'draftwise-saved-toast';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = t('draftSaved');
    toast.dataset.visible = 'true';
    setTimeout(() => {
      if (toast) toast.dataset.visible = 'false';
    }, 1600);
  }

  function fieldKey(field) {
    const page = `${location.origin}${location.pathname}`;
    const identity = [
      field.tagName.toLowerCase(),
      field.getAttribute('name') || '',
      field.id || '',
      field.getAttribute('aria-label') || '',
      cssPath(field),
    ].join('|');
    return `${page}|${identity}`;
  }

  function draftStorageKey(key) {
    return `${DRAFT_PREFIX}${hashString(key)}`;
  }

  function cssPath(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter(child => child.tagName === node.tagName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(`${tag}:nth-of-type(${Math.max(index, 1)})`);
      node = parent;
    }
    return parts.join('>');
  }

  function hashString(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
  }

  function getFieldValue(field) {
    return field.isContentEditable ? field.textContent || '' : field.value || '';
  }

  function setFieldValue(field, value) {
    if (field.isContentEditable) {
      field.textContent = value;
    } else {
      field.value = value;
    }
  }

  function isEmptyField(field) {
    return !getFieldValue(field).trim();
  }

  function fieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (label?.textContent) return label.textContent.trim().slice(0, 80);
    }
    return (
      field.getAttribute('aria-label') ||
      field.getAttribute('placeholder') ||
      field.getAttribute('name') ||
      fieldDescriptor(field)
    ).trim().slice(0, 80);
  }

  function fieldDescriptor(field) {
    if (field.isContentEditable) return 'contenteditable';
    const tag = field.tagName.toLowerCase();
    const type = field.getAttribute('type');
    return type ? `${tag}:${type}` : tag;
  }

  async function scheduleCleanup() {
    setTimeout(async () => {
      const all = await chrome.storage.local.get(null);
      const draftEntries = Object.entries(all)
        .filter(([key, value]) => key.startsWith(DRAFT_PREFIX) && value?.updatedAt)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt);

      const cutoff = Date.now() - Number(STATE.settings.retentionDays || 30) * 24 * 60 * 60 * 1000;
      const remove = draftEntries
        .filter(([_key, value], index) => index >= Number(STATE.settings.maxDrafts || 200) || value.updatedAt < cutoff)
        .map(([key]) => key);

      if (remove.length) await chrome.storage.local.remove(remove);
    }, 2500);
  }

  function injectStyles() {
    if (document.getElementById('draftwise-content-styles')) return;
    const style = document.createElement('style');
    style.id = 'draftwise-content-styles';
    style.textContent = `
      .draftwise-restore-row {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 6px 0 !important;
        font: 12px/1.4 Arial, "Microsoft YaHei", sans-serif !important;
        letter-spacing: 0 !important;
        z-index: 2147483646 !important;
      }

      .draftwise-restore-row button,
      #draftwise-page-notice button {
        all: unset !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        font: 600 12px/1.2 Arial, "Microsoft YaHei", sans-serif !important;
        letter-spacing: 0 !important;
        padding: 5px 10px !important;
      }

      .draftwise-restore-btn,
      #draftwise-page-notice button[data-action="restore"] {
        background: #1a73e8 !important;
        color: #fff !important;
      }

      .draftwise-discard-btn,
      #draftwise-page-notice button[data-action="dismiss"] {
        background: #f1f3f4 !important;
        color: #3c4043 !important;
      }

      #draftwise-page-notice {
        position: fixed !important;
        left: 50% !important;
        bottom: 20px !important;
        transform: translateX(-50%) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        max-width: min(680px, calc(100vw - 32px)) !important;
        box-sizing: border-box !important;
        background: #202124 !important;
        color: #fff !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22) !important;
        padding: 12px 14px !important;
        font: 13px/1.4 Arial, "Microsoft YaHei", sans-serif !important;
      }

      #draftwise-saved-toast {
        position: fixed !important;
        right: 20px !important;
        bottom: 20px !important;
        z-index: 2147483647 !important;
        background: #188038 !important;
        color: #fff !important;
        border-radius: 999px !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18) !important;
        padding: 8px 12px !important;
        font: 12px/1.3 Arial, "Microsoft YaHei", sans-serif !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.18s ease !important;
      }

      #draftwise-saved-toast[data-visible="true"] {
        opacity: 1 !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function t(key) {
    return chrome.i18n.getMessage(key) || key;
  }
})();

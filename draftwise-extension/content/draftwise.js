// DraftWise - local form draft autosave content script.
(function () {
  'use strict';

  if (window.__draftwiseContentScriptReady) return;
  window.__draftwiseContentScriptReady = true;

  const SETTINGS_KEY = 'draftwise_settings';
  const DRAFT_PREFIX = 'draftwise_draft_';
  const STATE = {
    settings: {
      globalEnabled: true,
      disabledHosts: [],
      maxDrafts: 200,
      retentionDays: 30,
      blacklistPatterns: [],
      whitelistPatterns: [],
      sensitiveKeywords: [],
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

    try {
      await chrome.runtime.sendMessage({ type: 'DRAFTWISE_INJECT_MAIN_WORLD' });
    } catch (e) {
      console.warn('DraftWise main-world inject message failed:', e);
    }

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

  function matchPattern(url, pattern) {
    if (!pattern || typeof pattern !== 'string') return false;
    try {
      const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('.*') + '$');
      return regex.test(url);
    } catch {
      return false;
    }
  }

  function isEnabledForPage() {
    if (!STATE.settings.globalEnabled) return false;
    
    const url = location.href;
    const host = location.hostname.toLowerCase();

    if ((STATE.settings.disabledHosts || []).includes(host)) {
      return false;
    }

    const blacklist = STATE.settings.blacklistPatterns || [];
    if (blacklist.some(pattern => matchPattern(url, pattern))) {
      return false;
    }

    const whitelist = STATE.settings.whitelistPatterns || [];
    if (whitelist.length > 0) {
      return whitelist.some(pattern => matchPattern(url, pattern));
    }

    return true;
  }

  function bindGlobalEvents() {
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('keydown', handleKeydown, true);

    const observer = new MutationObserver((mutations) => {
      if (!chrome.runtime?.id) {
        observer.disconnect();
        return;
      }
      for (const mutation of mutations) {
        const target = mutation.target;
        if (target instanceof HTMLElement) {
          const field = target.closest('textarea, input, select, [contenteditable="true"]');
          if (field && isSupportedField(field)) {
            const info = STATE.fields.get(field) || {
              key: fieldKey(field),
              storageKey: draftStorageKey(fieldKey(field)),
            };
            STATE.fields.set(field, info);
            clearTimeout(STATE.saveTimers.get(field));
            STATE.saveTimers.set(field, setTimeout(() => saveField(field, info), 1500));
          }
        }
      }

      clearTimeout(STATE.scanTimer);
      STATE.scanTimer = setTimeout(scanFields, 600);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'class', 'data-percent']
    });

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
    if (!chrome.runtime?.id) return;
    if (!isEnabledForPage()) return;

    const candidates = Array.from(document.querySelectorAll('textarea, input, select, [contenteditable=""], [contenteditable="true"]'));
    const fields = candidates.filter(isSupportedField);
    const keys = fields.map(field => fieldKey(field));
    const draftKeys = keys.map(key => draftStorageKey(key));
    const stored = draftKeys.length ? await chrome.storage.local.get(draftKeys) : {};

    fields.forEach((field, index) => {
      const key = keys[index];
      const storageKey = draftStorageKey(key);
      STATE.fields.set(field, { key, storageKey });
      updateControlBar(field);
    });

    showPageRestoreNotice();
  }

  function isSupportedField(field) {
    if (!(field instanceof HTMLElement)) return false;
    if (field.closest('[data-draftwise-ignore], [data-no-draftwise]')) return false;
    if (field.isContentEditable) return isEditableTextField(field);

    const tag = field.tagName.toLowerCase();
    if (tag === 'textarea') return !isSensitiveField(field);
    if (tag === 'select') {
      if (field.disabled) return false;
      return !isSensitiveField(field);
    }
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

    let pattern = SENSITIVE_PATTERN;
    if (Array.isArray(STATE.settings.sensitiveKeywords) && STATE.settings.sensitiveKeywords.length > 0) {
      try {
        const escaped = STATE.settings.sensitiveKeywords.map(k => k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        pattern = new RegExp(`(${escaped})`, 'i');
      } catch (e) {
        console.warn('DraftWise invalid custom sensitive pattern:', e);
      }
    }

    return pattern.test(combined);
  }

  function handleInput(event) {
    if (!chrome.runtime?.id) return;
    const field = event.target;
    if (!isSupportedField(field)) return;

    const info = STATE.fields.get(field) || {
      key: fieldKey(field),
      storageKey: draftStorageKey(fieldKey(field)),
    };
    STATE.fields.set(field, info);

    clearTimeout(STATE.saveTimers.get(field));
    STATE.saveTimers.set(field, setTimeout(() => saveField(field, info), 700));

    updateControlBar(field);
  }

  function handleKeydown(event) {
    if (!chrome.runtime?.id) return;
    const isSaveKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
    if (!isSaveKey) return;

    const field = event.target;
    if (!isSupportedField(field)) return;

    event.preventDefault();
    event.stopPropagation();

    const info = STATE.fields.get(field) || {
      key: fieldKey(field),
      storageKey: draftStorageKey(fieldKey(field)),
    };
    STATE.fields.set(field, info);

    saveField(field, info);
  }

  async function saveField(field, info) {
    if (!chrome.runtime?.id) return;
    if (isEmptyField(field)) {
      await chrome.storage.local.remove(info.storageKey);
      removeRestoreControl(field);
      return;
    }

    const value = await getFieldValue(field);
    const textVal = getFieldText(field);
    const textLength = textVal.trim().length;

    let existing = null;
    try {
      const stored = await chrome.storage.local.get(info.storageKey);
      existing = stored[info.storageKey];
    } catch (e) {
      console.warn('DraftWise failed to load existing draft:', e);
    }

    let versions = [];
    if (existing) {
      if (Array.isArray(existing.versions)) {
        versions = existing.versions;
      } else if (existing.value) {
        versions = [{
          value: existing.value,
          updatedAt: existing.updatedAt || Date.now(),
          textLength: typeof existing.value === 'string' ? existing.value.replace(/<[^>]*>/g, '').length : 0
        }];
      }
    }

    const now = Date.now();
    const newVersion = {
      value,
      updatedAt: now,
      textLength
    };

    if (versions.length === 0) {
      versions.push(newVersion);
    } else {
      const latest = versions[0];
      if (latest.value === value) {
        latest.updatedAt = now;
      } else if (now - latest.updatedAt < 60000) {
        latest.value = value;
        latest.updatedAt = now;
        latest.textLength = textLength;
      } else {
        versions.unshift(newVersion);
      }
    }

    if (versions.length > 10) {
      versions = versions.slice(0, 10);
    }

    const draft = {
      versions,
      pageUrl: location.href,
      origin: location.origin,
      host: location.hostname,
      path: location.pathname,
      title: document.title,
      label: fieldLabel(field),
      updatedAt: now,
      fieldType: fieldDescriptor(field),
    };

    await chrome.storage.local.set({ [info.storageKey]: draft });
    showSavedToast();
    updateControlBar(field);
  }

  function handleSubmit(event) {
    if (!chrome.runtime?.id) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const fields = Array.from(form.querySelectorAll('textarea, input, select, [contenteditable=""], [contenteditable="true"]'))
      .filter(isSupportedField);
    const keys = fields.map(field => {
      const info = STATE.fields.get(field);
      return info?.storageKey || draftStorageKey(fieldKey(field));
    });
    if (keys.length) chrome.storage.local.remove(keys);
  }

  function formatVersionTime(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    
    if (isToday) {
      return `${t('today')} ${timeStr}`;
    }
    
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
  }

  function handleFocus(event) {
    const field = event.target;
    if (isSupportedField(field)) {
      updateControlBar(field);
    }
  }

  function handleBlur(event) {
    const field = event.target;
    if (isSupportedField(field)) {
      setTimeout(() => {
        const row = STATE.restoreItems.get(field);
        const activeEl = document.activeElement;
        if (activeEl && row && (row === activeEl || row.contains(activeEl))) {
          return;
        }
        if (document.activeElement !== field) {
          updateControlBar(field);
        }
      }, 200);
    }
  }

  async function updateControlBar(field) {
    if (!chrome.runtime?.id) return;
    if (!isSupportedField(field)) return;

    const info = STATE.fields.get(field) || {
      key: fieldKey(field),
      storageKey: draftStorageKey(fieldKey(field)),
    };
    STATE.fields.set(field, info);

    const stored = await chrome.storage.local.get(info.storageKey);
    const draft = stored[info.storageKey];

    const hasDraft = draft && (draft.value || (Array.isArray(draft.versions) && draft.versions.length > 0));
    const hasValue = !isEmptyField(field);
    const isFocused = document.activeElement === field;

    const shouldShow = (isFocused && (hasValue || hasDraft)) || (!isFocused && isEmptyField(field) && hasDraft);

    if (!shouldShow) {
      removeRestoreControl(field);
      return;
    }

    let row = STATE.restoreItems.get(field);
    if (!row) {
      row = document.createElement('div');
      row.className = 'draftwise-restore-row';
      const parent = field.parentElement;
      if (parent) {
        parent.insertBefore(row, field.nextSibling);
        STATE.restoreItems.set(field, row);
      }
    }

    let versions = [];
    if (draft) {
      if (Array.isArray(draft.versions)) {
        versions = draft.versions;
      } else if (draft.value) {
        versions = [{
          value: draft.value,
          updatedAt: draft.updatedAt || Date.now(),
          textLength: typeof draft.value === 'string' ? draft.value.replace(/<[^>]*>/g, '').length : 0
        }];
      }
    }

    let switcherHtml = '';
    if (versions.length > 1) {
      switcherHtml = `<select class="draftwise-version-select">`;
      versions.forEach((ver, index) => {
        const dateStr = formatVersionTime(ver.updatedAt);
        const lenStr = ver.textLength !== undefined ? ` (${ver.textLength}字)` : '';
        switcherHtml += `<option value="${index}">${dateStr}${lenStr}</option>`;
      });
      switcherHtml += `</select>`;
    }

    const restoreBtnHtml = hasDraft ? `<button type="button" class="draftwise-restore-btn">${escapeHtml(t('restoreDraft'))}</button>` : '';
    const saveBtnHtml = hasValue ? `<button type="button" class="draftwise-save-btn">${escapeHtml(t('saveDraftManual'))}</button>` : '';
    const discardBtnHtml = hasDraft ? `<button type="button" class="draftwise-discard-btn">${escapeHtml(t('discardDraft'))}</button>` : '';

    row.innerHTML = `
      ${switcherHtml}
      ${restoreBtnHtml}
      ${saveBtnHtml}
      ${discardBtnHtml}
    `;

    const selectEl = row.querySelector('.draftwise-version-select');

    if (hasDraft) {
      row.querySelector('.draftwise-restore-btn')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const selectedIndex = selectEl ? parseInt(selectEl.value, 10) : 0;
        const targetVersion = versions[selectedIndex] || versions[0];
        setFieldValue(field, targetVersion.value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.focus();
        updateControlBar(field);
      });

      row.querySelector('.draftwise-discard-btn')?.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        const info = STATE.fields.get(field);
        if (info) await chrome.storage.local.remove(info.storageKey);
        removeRestoreControl(field);
        showPageRestoreNotice();
      });
    }

    if (hasValue) {
      row.querySelector('.draftwise-save-btn')?.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        await saveField(field, info);
        field.focus();
        updateControlBar(field);
      });
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
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter(child => child.tagName === node.tagName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
      node = parent;
    }
    return parts.join(' > ');
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

  async function imageToSelectorBase64(imgElement) {
    if (!chrome.runtime?.id) return null;
    const selector = cssPath(imgElement);
    const blobUrl = imgElement.getAttribute('src');
    
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      
      const listener = (event) => {
        if (event.detail && event.detail.requestId === requestId) {
          window.removeEventListener('draftwise-convert-response', listener);
          if (event.detail.success) {
            resolve(event.detail.base64);
          } else {
            console.warn('DraftWise main-world conversion failed:', event.detail.error);
            resolve(null);
          }
        }
      };
      
      window.addEventListener('draftwise-convert-response', listener);
      
      const timer = setTimeout(() => {
        window.removeEventListener('draftwise-convert-response', listener);
        resolve(null);
      }, 5000);
      
      try {
        const requestEvent = new CustomEvent('draftwise-convert-request', {
          detail: { requestId, blobUrl, selector }
        });
        window.dispatchEvent(requestEvent);
      } catch (e) {
        console.error('DraftWise dispatchEvent error:', e);
        clearTimeout(timer);
        window.removeEventListener('draftwise-convert-response', listener);
        resolve(null);
      }
    });
  }

  async function getFieldValue(field) {
    if (field.isContentEditable) {
      const clone = field.cloneNode(true);
      const originalImgs = field.querySelectorAll('img');
      const clonedImgs = clone.querySelectorAll('img');
      
      for (let index = 0; index < clonedImgs.length; index++) {
        const clonedImg = clonedImgs[index];
        const originalImg = originalImgs[index];
        if (originalImg) {
          const src = originalImg.getAttribute('src');
          if (src && src.startsWith('blob:')) {
            const base64 = await imageToSelectorBase64(originalImg);
            if (base64) {
              clonedImg.setAttribute('src', base64);
            }
          }
        }
      }
      return clone.innerHTML || '';
    }
    return field.value || '';
  }

  function getFieldText(field) {
    return field.isContentEditable ? field.textContent || '' : field.value || '';
  }

  function setFieldValue(field, value) {
    if (field.isContentEditable) {
      field.focus();
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(field);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete', false, null);
      } catch (e) {
        console.warn('DraftWise clear selection failed:', e);
      }

      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/html', value);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = value;
        dataTransfer.setData('text/plain', tempDiv.textContent || '');
        
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        });
        field.dispatchEvent(pasteEvent);
      } catch (e) {
        console.error('DraftWise simulated paste failed, falling back to innerHTML:', e);
        field.innerHTML = value;
      }
    } else {
      field.value = value;
    }
  }

  function isEmptyField(field) {
    if (field.tagName.toLowerCase() === 'select') {
      return field.selectedIndex <= 0 || !field.value;
    }
    const text = getFieldText(field).trim();
    if (text) return false;
    if (field.isContentEditable && field.querySelector('img')) {
      return false;
    }
    return true;
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

      .draftwise-version-select {
        all: unset !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        border: 1px solid #dadce0 !important;
        border-radius: 4px !important;
        padding: 4px 24px 4px 8px !important;
        background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%235f6368' d='M0 3l5 5 5-5z'/%3E%3C/svg%3E") no-repeat right 8px center !important;
        color: #3c4043 !important;
        font: 12px/1.4 Arial, "Microsoft YaHei", sans-serif !important;
        cursor: pointer !important;
        outline: none !important;
        max-width: 200px !important;
      }

      .draftwise-version-select:hover {
        border-color: #1a73e8 !important;
        background-color: #f8f9fa !important;
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
      .draftwise-restore-btn:hover,
      #draftwise-page-notice button[data-action="restore"]:hover {
        background: #1557b0 !important;
      }

      .draftwise-save-btn {
        background: #34a853 !important;
        color: #fff !important;
      }
      .draftwise-save-btn:hover {
        background: #2d8e47 !important;
      }

      .draftwise-discard-btn,
      #draftwise-page-notice button[data-action="dismiss"] {
        background: #f1f3f4 !important;
        color: #3c4043 !important;
      }
      .draftwise-discard-btn:hover,
      #draftwise-page-notice button[data-action="dismiss"]:hover {
        background: #e8eaed !important;
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

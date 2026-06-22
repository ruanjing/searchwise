(async () => {
  'use strict';

  const SETTINGS_KEY = 'draftwise_settings';
  const DRAFT_PREFIX = 'draftwise_draft_';

  const $ = (id) => document.getElementById(id);

  let currentSettings = {
    globalEnabled: true,
    disabledHosts: [],
    maxDrafts: 200,
    retentionDays: 30,
    blacklistPatterns: [],
    whitelistPatterns: [],
    sensitiveKeywords: [],
    webdavUrl: '',
    webdavAccount: '',
    webdavPassword: '',
    webdavAutoSync: false
  };

  let allDraftsList = []; // Array of { key, value }
  let selectedDraft = null; // { key, value }

  // Translate a key
  function t(key) {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key) || key;
    }
    return key;
  }

  // Display status message
  function showStatus(msg, isError = false) {
    const statusEl = $('status');
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#d93025' : '#188038';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 4000);
  }

  // Format version timestamp
  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  }

  // --- Tab Switching ---
  $('nav-drafts-btn').addEventListener('click', () => {
    switchTab('drafts');
  });

  $('nav-settings-btn').addEventListener('click', () => {
    switchTab('settings');
  });

  function switchTab(tab) {
    if (tab === 'drafts') {
      $('nav-drafts-btn').classList.add('active');
      $('nav-settings-btn').classList.remove('active');
      $('view-drafts').style.display = 'block';
      $('view-settings').style.display = 'none';
      loadAndRenderDrafts();
    } else {
      $('nav-drafts-btn').classList.remove('active');
      $('nav-settings-btn').classList.add('active');
      $('view-drafts').style.display = 'none';
      $('view-settings').style.display = 'block';
      loadSettingsForm();
    }
  }

  // --- Draft List & Tree Rendering ---
  async function loadAndRenderDrafts() {
    try {
      const data = await chrome.storage.local.get(null);
      allDraftsList = Object.entries(data)
        .filter(([key, value]) => key.startsWith(DRAFT_PREFIX) && value && (value.value || Array.isArray(value.versions)))
        .map(([key, value]) => {
          // Normalize versions format for backward compatibility
          let versions = [];
          if (Array.isArray(value.versions)) {
            versions = value.versions;
          } else if (value.value) {
            versions = [{
              value: value.value,
              updatedAt: value.updatedAt || Date.now(),
              textLength: typeof value.value === 'string' ? value.value.replace(/<[^>]*>/g, '').length : 0
            }];
          }
          return {
            key,
            value: { ...value, versions }
          };
        })
        .sort((a, b) => Number(b.value.updatedAt || 0) - Number(a.value.updatedAt || 0));

      renderDraftTree();
    } catch (e) {
      console.error('Failed to load drafts:', e);
    }
  }

  function renderDraftTree() {
    const treeEl = $('draft-tree');
    treeEl.innerHTML = '';

    const query = $('search-input').value.trim().toLowerCase();

    // Group by host
    const groups = {};
    allDraftsList.forEach(draft => {
      // Search filter
      if (query) {
        const matchesQuery = 
          (draft.value.label || '').toLowerCase().includes(query) ||
          (draft.value.host || '').toLowerCase().includes(query) ||
          (draft.value.path || '').toLowerCase().includes(query) ||
          draft.value.versions.some(v => String(v.value || '').toLowerCase().includes(query));
        
        if (!matchesQuery) return;
      }

      const host = draft.value.host || 'Unknown Site';
      if (!groups[host]) groups[host] = [];
      groups[host].push(draft);
    });

    const hosts = Object.keys(groups).sort();

    if (hosts.length === 0) {
      treeEl.innerHTML = `<div class="empty-state">${t('noDraftsFound')}</div>`;
      return;
    }

    hosts.forEach(host => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'tree-group';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'tree-group-title';
      titleDiv.textContent = host;
      groupDiv.appendChild(titleDiv);

      groups[host].forEach(draft => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-item';
        if (selectedDraft && selectedDraft.key === draft.key) {
          itemDiv.classList.add('active');
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'tree-item-label';
        labelSpan.textContent = draft.value.label || 'Untitled Field';
        itemDiv.appendChild(labelSpan);

        const urlSpan = document.createElement('span');
        urlSpan.className = 'tree-item-url';
        urlSpan.textContent = draft.value.path || '';
        itemDiv.appendChild(urlSpan);

        itemDiv.addEventListener('click', () => {
          selectDraftItem(draft);
        });

        groupDiv.appendChild(itemDiv);
      });

      treeEl.appendChild(groupDiv);
    });
  }

  function selectDraftItem(draft) {
    selectedDraft = draft;
    renderDraftTree(); // refresh active state in sidebar

    $('no-draft-selected').style.display = 'none';
    $('draft-details').style.display = 'flex';

    $('detail-label').textContent = draft.value.label || 'Untitled Field';
    $('detail-field-type').textContent = draft.value.fieldType || 'Unknown';
    
    const urlLink = $('detail-url');
    urlLink.href = draft.value.pageUrl || '#';
    urlLink.textContent = draft.value.pageUrl || 'View Page';

    // Populate version selector
    const selectEl = $('version-select');
    selectEl.innerHTML = '';

    draft.value.versions.forEach((ver, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${formatTime(ver.updatedAt)} (${ver.textLength || 0} chars)`;
      selectEl.appendChild(option);
    });

    selectEl.onchange = () => {
      renderSelectedVersion(draft.value.versions[selectEl.value], draft.value.fieldType);
    };

    // Render first version by default
    if (draft.value.versions.length > 0) {
      renderSelectedVersion(draft.value.versions[0], draft.value.fieldType);
    }
  }

  function renderSelectedVersion(version, fieldType) {
    const previewArea = $('preview-area');
    previewArea.innerHTML = '';

    if (!version) {
      $('detail-word-count').textContent = '字数: 0';
      return;
    }

    if (fieldType === 'contenteditable') {
      // Contenteditable (Rich Text) can contain HTML structure and base64 images
      previewArea.innerHTML = version.value || '';
    } else {
      // Textarea / Inputs
      previewArea.textContent = version.value || '';
    }

    const textLength = version.textLength !== undefined ? version.textLength : (version.value || '').replace(/<[^>]*>/g, '').length;
    $('detail-word-count').textContent = `字数: ${textLength}`;
  }

  // --- Draft Actions ---
  $('copy-btn').addEventListener('click', async () => {
    if (!selectedDraft) return;
    const selectEl = $('version-select');
    const version = selectedDraft.value.versions[selectEl.value];
    if (!version) return;

    try {
      // Copy text content. For HTML, we also copy clean plain text.
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = version.value;
      const textToCopy = selectedDraft.value.fieldType === 'contenteditable'
        ? tempDiv.textContent || ''
        : version.value;

      await navigator.clipboard.writeText(textToCopy);
      showStatus(t('contentCopied'));
    } catch (e) {
      showStatus('Copy failed: ' + e.message, true);
    }
  });

  $('export-md-btn').addEventListener('click', () => {
    if (!selectedDraft) return;
    const selectEl = $('version-select');
    const version = selectedDraft.value.versions[selectEl.value];
    if (!version) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = version.value;
    const textVal = selectedDraft.value.fieldType === 'contenteditable'
      ? tempDiv.innerText || tempDiv.textContent
      : version.value;

    const markdownContent = `# 草稿: ${selectedDraft.value.label || '未命名表单'}\n\n* **来源网站:** ${selectedDraft.value.host || '未知'}\n* **页面链接:** ${selectedDraft.value.pageUrl || '无'}\n* **保存时间:** ${formatTime(version.updatedAt)}\n\n---\n\n${textVal}`;

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    downloadBlob(blob, `${selectedDraft.value.label || 'draft'}.md`);
  });

  $('export-txt-btn').addEventListener('click', () => {
    if (!selectedDraft) return;
    const selectEl = $('version-select');
    const version = selectedDraft.value.versions[selectEl.value];
    if (!version) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = version.value;
    const textVal = selectedDraft.value.fieldType === 'contenteditable'
      ? tempDiv.innerText || tempDiv.textContent
      : version.value;

    const blob = new Blob([textVal], { type: 'text/plain' });
    downloadBlob(blob, `${selectedDraft.value.label || 'draft'}.txt`);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  $('delete-ver-btn').addEventListener('click', async () => {
    if (!selectedDraft) return;
    if (!confirm(t('confirmDeleteVersion'))) return;

    const selectEl = $('version-select');
    const selectedIndex = parseInt(selectEl.value, 10);
    
    selectedDraft.value.versions.splice(selectedIndex, 1);

    if (selectedDraft.value.versions.length === 0) {
      // Deleted the last version, delete entire draft
      await chrome.storage.local.remove(selectedDraft.key);
      selectedDraft = null;
      $('draft-details').style.display = 'none';
      $('no-draft-selected').style.display = 'flex';
    } else {
      // Save updated versions list
      await chrome.storage.local.set({ [selectedDraft.key]: selectedDraft.value });
      selectDraftItem(selectedDraft);
    }
    loadAndRenderDrafts();
  });

  $('delete-draft-btn').addEventListener('click', async () => {
    if (!selectedDraft) return;
    if (!confirm(t('confirmDeleteDraft'))) return;

    await chrome.storage.local.remove(selectedDraft.key);
    selectedDraft = null;
    $('draft-details').style.display = 'none';
    $('no-draft-selected').style.display = 'flex';
    
    loadAndRenderDrafts();
  });

  $('search-input').addEventListener('input', () => {
    renderDraftTree();
  });

  // --- Settings Tab Operations ---
  async function loadSettingsForm() {
    try {
      const res = await chrome.storage.local.get(SETTINGS_KEY);
      currentSettings = { ...currentSettings, ...(res[SETTINGS_KEY] || {}) };
      
      $('setting-max-drafts').value = currentSettings.maxDrafts || 200;
      $('setting-retention-days').value = currentSettings.retentionDays || 30;
      
      $('setting-blacklist').value = (currentSettings.blacklistPatterns || []).join('\n');
      $('setting-whitelist').value = (currentSettings.whitelistPatterns || []).join('\n');
      $('setting-sensitive').value = (currentSettings.sensitiveKeywords || []).join('\n');
      $('setting-webdav-url').value = currentSettings.webdavUrl || '';
      $('setting-webdav-account').value = currentSettings.webdavAccount || '';
      $('setting-webdav-password').value = currentSettings.webdavPassword || '';
      $('setting-webdav-autosync').checked = !!currentSettings.webdavAutoSync;
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  $('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const maxDrafts = parseInt($('setting-max-drafts').value, 10);
    const retentionDays = parseInt($('setting-retention-days').value, 10);

    const blacklistPatterns = $('setting-blacklist').value.split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const whitelistPatterns = $('setting-whitelist').value.split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const sensitiveKeywords = $('setting-sensitive').value.split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const webdavUrl = $('setting-webdav-url').value.trim();
    const webdavAccount = $('setting-webdav-account').value.trim();
    const webdavPassword = $('setting-webdav-password').value.trim();
    const webdavAutoSync = $('setting-webdav-autosync').checked;

    currentSettings = {
      ...currentSettings,
      maxDrafts,
      retentionDays,
      blacklistPatterns,
      whitelistPatterns,
      sensitiveKeywords,
      webdavUrl,
      webdavAccount,
      webdavPassword,
      webdavAutoSync
    };

    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: currentSettings });
      showStatus(t('settingsSaved'));
      
      if (webdavAutoSync) {
        // Trigger silent background upload
        uploadToWebDAVBackground();
      }
    } catch (err) {
      showStatus('Failed to save settings: ' + err.message, true);
    }
  });

  // --- WebDAV Core Requests ---
  async function webdavRequest(method, filename = '', dataString = null) {
    const url = $('setting-webdav-url').value.trim();
    const username = $('setting-webdav-account').value.trim();
    const password = $('setting-webdav-password').value.trim();

    if (!url || !username || !password) {
      throw new Error('请先在设置中填写完整的 WebDAV 配置（服务器地址、账户和密码）。');
    }

    const auth = btoa(`${username}:${password}`);
    const endpoint = `${url.replace(/\/$/, '')}/${filename}`;
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`
      }
    };
    if (dataString !== null) {
      options.body = dataString;
      options.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint, options);
    if (!response.ok) {
      throw new Error(`WebDAV 请求失败: ${response.status} ${response.statusText}`);
    }
    return response;
  }

  async function uploadToWebDAVBackground() {
    try {
      const data = await chrome.storage.local.get(null);
      const drafts = {};
      Object.entries(data).forEach(([key, val]) => {
        if (key === SETTINGS_KEY || key.startsWith(DRAFT_PREFIX)) {
          drafts[key] = val;
        }
      });
      const backup = {
        version: '1.0',
        generator: 'DraftWise Backup',
        timestamp: new Date().toISOString(),
        data: drafts
      };
      await webdavRequest('PUT', 'draftwise_backup.json', JSON.stringify(backup, null, 2));
    } catch (e) {
      console.warn('WebDAV auto backup failed in background:', e);
    }
  }

  $('webdav-upload-btn').addEventListener('click', async () => {
    try {
      showStatus('正在备份到 WebDAV...');
      const data = await chrome.storage.local.get(null);
      const drafts = {};
      Object.entries(data).forEach(([key, val]) => {
        if (key === SETTINGS_KEY || key.startsWith(DRAFT_PREFIX)) {
          drafts[key] = val;
        }
      });
      const backup = {
        version: '1.0',
        generator: 'DraftWise Backup',
        timestamp: new Date().toISOString(),
        data: drafts
      };
      await webdavRequest('PUT', 'draftwise_backup.json', JSON.stringify(backup, null, 2));
      showStatus('备份上传成功！ (WebDAV Backup Succeeded)');
    } catch (e) {
      showStatus('备份失败: ' + e.message, true);
    }
  });

  $('webdav-download-btn').addEventListener('click', async () => {
    try {
      showStatus('正在从 WebDAV 下载恢复数据...');
      const response = await webdavRequest('GET', 'draftwise_backup.json');
      const text = await response.text();
      const backup = JSON.parse(text);
      if (!backup || typeof backup.data !== 'object') {
        throw new Error('网盘上的备份文件格式无效。');
      }

      const keysToSet = {};
      Object.entries(backup.data).forEach(([key, val]) => {
        if (key === SETTINGS_KEY || key.startsWith(DRAFT_PREFIX)) {
          keysToSet[key] = val;
        }
      });

      if (Object.keys(keysToSet).length > 0) {
        await chrome.storage.local.set(keysToSet);
        showStatus('WebDAV 数据恢复合并成功！ (Restore Succeeded)');
        await loadAndRenderDrafts();
      } else {
        showStatus('未在备份中找到有效的草稿数据。', true);
      }
    } catch (e) {
      showStatus('恢复失败: ' + e.message, true);
    }
  });

  // --- Backup & Restore Center (Local File) ---
  $('export-btn').addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get(null);
      const drafts = {};
      
      // Filter out only configurations and drafts keys
      Object.entries(data).forEach(([key, val]) => {
        if (key === SETTINGS_KEY || key.startsWith(DRAFT_PREFIX)) {
          drafts[key] = val;
        }
      });

      const backup = {
        version: '1.0',
        generator: 'DraftWise Backup',
        timestamp: new Date().toISOString(),
        data: drafts
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `draftwise_backup_${new Date().toISOString().slice(0, 10)}.json`);

      showStatus(t('backupExportSuccess') || 'Backup downloaded successfully.');
    } catch (e) {
      showStatus('Export failed: ' + e.message, true);
    }
  });

  $('import-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup || typeof backup.data !== 'object') {
          throw new Error('Invalid format');
        }

        const keysToSet = {};
        
        // Merge drafts & settings
        Object.entries(backup.data).forEach(([key, value]) => {
          if (key === SETTINGS_KEY || key.startsWith(DRAFT_PREFIX)) {
            keysToSet[key] = value;
          }
        });

        if (Object.keys(keysToSet).length > 0) {
          await chrome.storage.local.set(keysToSet);
          showStatus(t('importSuccess'));
          await loadAndRenderDrafts();
        } else {
          showStatus(t('importError'), true);
        }
      } catch (err) {
        showStatus(t('importError'), true);
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  // Init
  if (typeof GrowthVaultI18n !== 'undefined') {
    // Note: Use GrowthVaultI18n dynamically if available, or load standalone
    await GrowthVaultI18n.initPromise;
  }

  // Query DOM translation
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (key.startsWith('[placeholder]')) {
      const realKey = key.replace('[placeholder]', '');
      element.placeholder = t(realKey);
    } else {
      element.textContent = t(key);
    }
  });

  await loadAndRenderDrafts();
})();

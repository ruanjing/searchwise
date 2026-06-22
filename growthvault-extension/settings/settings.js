(async () => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEYS = {
    PROJECTS: 'growthvault_projects',
    CLIPS: 'growthvault_clips',
    TEMPLATES: 'growthvault_custom_templates'
  };

  let customTemplates = [];

  // Helper: display status message
  function showStatus(message, isError = false) {
    const statusEl = $('status');
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#c0392b' : '#1d6f5f';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 4000);
  }

  // Translate a key using i18n
  function t(key) {
    if (typeof GrowthVaultI18n !== 'undefined') {
      return GrowthVaultI18n.getMessage(key) || key;
    }
    return key;
  }

  // --- Backup & Restore Logic ---
  $('export-backup-btn').addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get({
        [STORAGE_KEYS.PROJECTS]: [],
        [STORAGE_KEYS.CLIPS]: [],
        [STORAGE_KEYS.TEMPLATES]: []
      });

      const backup = {
        version: '1.0',
        generator: 'GrowthVault Backup',
        timestamp: new Date().toISOString(),
        projects: data[STORAGE_KEYS.PROJECTS] || [],
        clips: data[STORAGE_KEYS.CLIPS] || [],
        customTemplates: data[STORAGE_KEYS.TEMPLATES] || []
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `growthvault_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus(t('backupExportSuccess'));
    } catch (e) {
      console.error('Backup export failed:', e);
      showStatus('Export failed: ' + e.message, true);
    }
  });

  $('import-backup-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        
        // Validate basic structure
        if (!backup || !Array.isArray(backup.projects) || !Array.isArray(backup.clips)) {
          throw new Error('Invalid format');
        }

        // Get current data
        const local = await chrome.storage.local.get({
          [STORAGE_KEYS.PROJECTS]: [],
          [STORAGE_KEYS.CLIPS]: [],
          [STORAGE_KEYS.TEMPLATES]: []
        });

        // Merge Projects (deduplicate by id)
        const projectMap = new Map();
        local[STORAGE_KEYS.PROJECTS].forEach(p => projectMap.set(p.id, p));
        backup.projects.forEach(p => {
          if (p && p.id) projectMap.set(p.id, p);
        });

        // Merge Clips (deduplicate by id)
        const clipMap = new Map();
        local[STORAGE_KEYS.CLIPS].forEach(c => clipMap.set(c.id, c));
        backup.clips.forEach(c => {
          if (c && c.id) clipMap.set(c.id, c);
        });

        // Merge Custom Templates
        const templateMap = new Map();
        local[STORAGE_KEYS.TEMPLATES].forEach(t => templateMap.set(t.id, t));
        if (Array.isArray(backup.customTemplates)) {
          backup.customTemplates.forEach(t => {
            if (t && t.id) templateMap.set(t.id, t);
          });
        }

        // Write back
        await chrome.storage.local.set({
          [STORAGE_KEYS.PROJECTS]: Array.from(projectMap.values()),
          [STORAGE_KEYS.CLIPS]: Array.from(clipMap.values()),
          [STORAGE_KEYS.TEMPLATES]: Array.from(templateMap.values())
        });

        showStatus(t('backupImportSuccess'));
        // Reload list after merge
        await loadTemplates();
      } catch (err) {
        console.error('Backup import failed:', err);
        showStatus(t('backupImportError'), true);
      }
      
      // Clear value so the same file can be selected again
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  // --- Custom Templates CRUD ---
  async function loadTemplates() {
    try {
      const res = await chrome.storage.local.get({ [STORAGE_KEYS.TEMPLATES]: [] });
      customTemplates = res[STORAGE_KEYS.TEMPLATES] || [];
      renderTemplateList();
    } catch (e) {
      console.warn('Failed to load templates:', e);
    }
  }

  function renderTemplateList() {
    const listEl = $('template-list');
    listEl.innerHTML = '';

    if (customTemplates.length === 0) {
      listEl.innerHTML = '<div style="font-size:13px; color:#5b6673; text-align:center; padding:12px;">No custom templates.</div>';
      return;
    }

    customTemplates.forEach((template) => {
      const item = document.createElement('div');
      item.className = 'template-item';
      if ($('template-id').value === template.id) {
        item.classList.add('active');
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = template.name;
      item.appendChild(nameSpan);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = t('delete') || 'Delete';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(t('templateDeleteConfirm') || 'Delete this template?')) {
          customTemplates = customTemplates.filter(t => t.id !== template.id);
          await chrome.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: customTemplates });
          
          if ($('template-id').value === template.id) {
            clearForm();
          }
          loadTemplates();
        }
      });
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        $('template-id').value = template.id;
        $('template-name').value = template.name;
        $('template-content').value = template.content;
        $('cancel-template-btn').style.display = 'inline-flex';
        renderTemplateList();
      });

      listEl.appendChild(item);
    });
  }

  function clearForm() {
    $('template-id').value = '';
    $('template-name').value = '';
    $('template-content').value = '';
    $('cancel-template-btn').style.display = 'none';
  }

  $('cancel-template-btn').addEventListener('click', () => {
    clearForm();
    renderTemplateList();
  });

  $('template-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = $('template-id').value;
    const name = $('template-name').value.trim();
    const content = $('template-content').value;

    if (!name || !content) return;

    if (id) {
      // Edit existing
      customTemplates = customTemplates.map(t => {
        if (t.id === id) {
          return { ...t, name, content };
        }
        return t;
      });
    } else {
      // Create new
      const newId = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      customTemplates.unshift({ id: newId, name, content });
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: customTemplates });
    showStatus(t('templateSaveSuccess'));
    clearForm();
    await loadTemplates();
  });

  // Init
  if (typeof GrowthVaultI18n !== 'undefined') {
    await GrowthVaultI18n.initPromise;
    GrowthVaultI18n.renderLanguageSwitcher('aside');
  }

  await loadTemplates();
})();

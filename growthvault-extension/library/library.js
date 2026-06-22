const projectFilter = document.querySelector('#project-filter');
const typeFilter = document.querySelector('#type-filter');
const tagFilter = document.querySelector('#tag-filter');
const domainFilter = document.querySelector('#domain-filter');
const searchInput = document.querySelector('#search-input');
const clipList = document.querySelector('#clip-list');
const statusEl = document.querySelector('#status');
const projectMgrList = document.querySelector('#project-mgr-list');
const sidebarNewProjectName = document.querySelector('#new-project-sidebar-name');
const sidebarNewProjectBtn = document.querySelector('#new-project-sidebar-btn');

let projects = [];
let clips = [];

function sendMessage(message) {
  return chrome.runtime.sendMessage(message).then((response) => {
    if (!response || !response.ok) throw new Error(response?.error || 'GrowthVault request failed.');
    return response.result;
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function projectName(projectId) {
  return projects.find((project) => project.id === projectId)?.name || GrowthVaultI18n.getMessage('unknownProject') || 'Unknown project';
}

function typeLabel(typeId) {
  return GrowthVaultConstants.MATERIAL_TYPES.find((type) => type.id === typeId)?.label || typeId;
}

function fillFilters() {
  projectFilter.innerHTML = `<option value="">${escapeHtml(GrowthVaultI18n.getMessage('allProjects') || 'All projects')}</option>` + projects.map((project) => (
    `<option value="${project.id}">${escapeHtml(project.name)}</option>`
  )).join('');

  typeFilter.innerHTML = `<option value="">${escapeHtml(GrowthVaultI18n.getMessage('allTypes') || 'All types')}</option>` + GrowthVaultConstants.MATERIAL_TYPES.map((type) => (
    `<option value="${type.id}">${escapeHtml(type.label)}</option>`
  )).join('');

  // Collect all unique tags
  const tags = [...new Set(clips.flatMap((clip) => clip.tags || []).filter(Boolean))].sort();
  tagFilter.innerHTML = `<option value="">所有标签 (All Tags)</option>` + tags.map((tag) => (
    `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`
  )).join('');

  const domains = [...new Set(clips.map((clip) => clip.domain).filter(Boolean))].sort();
  domainFilter.innerHTML = `<option value="">${escapeHtml(GrowthVaultI18n.getMessage('allDomains') || 'All domains')}</option>` + domains.map((domain) => (
    `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`
  )).join('');
}

function filteredClips() {
  const query = searchInput.value.trim().toLowerCase();
  return clips.filter((clip) => {
    if (projectFilter.value && clip.projectId !== projectFilter.value) return false;
    if (typeFilter.value && clip.type !== typeFilter.value) return false;
    if (tagFilter.value && (!Array.isArray(clip.tags) || !clip.tags.includes(tagFilter.value))) return false;
    if (domainFilter.value && clip.domain !== domainFilter.value) return false;
    if (query) {
      const tagHaystack = Array.isArray(clip.tags) ? clip.tags.join(' ') : '';
      const haystack = [clip.text, clip.note, clip.title, clip.url, clip.domain, tagHaystack].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function render() {
  const visible = filteredClips();
  const saveLabel = GrowthVaultI18n.getMessage('saveChanges') || 'Save changes';
  const copyLabel = GrowthVaultI18n.getMessage('copy') || 'Copy';
  const deleteLabel = GrowthVaultI18n.getMessage('delete') || 'Delete';
  const placeholderNote = GrowthVaultI18n.getMessage('notePlaceholder') || 'Note';

  clipList.innerHTML = visible.map((clip) => {
    // Project selection dropdown
    const projectSelectHtml = `
      <select class="clip-project-select" data-field="projectId">
        ${projects.map((p) => `<option value="${p.id}" ${p.id === clip.projectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
    `;

    // Type selection dropdown
    const typeSelectHtml = `
      <select class="clip-type-select" data-field="type">
        ${GrowthVaultConstants.MATERIAL_TYPES.map((t) => `<option value="${t.id}" ${t.id === clip.type ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
      </select>
    `;

    // Tags list html
    const tagsList = Array.isArray(clip.tags) ? clip.tags : [];
    const tagsHtml = `
      <div class="clip-tags-container" data-id="${clip.id}">
        ${tagsList.map((tag) => `
          <span class="clip-tag">
            ${escapeHtml(tag)}
            <span class="remove-tag" data-tag="${escapeHtml(tag)}">&times;</span>
          </span>
        `).join('')}
        <input class="add-tag-input" type="text" placeholder="+ 标签 (Tag)" />
      </div>
    `;

    return `
      <article class="clip" data-id="${clip.id}">
        <div class="clip-meta" style="display:flex; gap:10px; align-items:center;">
          ${projectSelectHtml}
          <span>/</span>
          ${typeSelectHtml}
          <span>/</span>
          <span>${escapeHtml(clip.domain)}</span>
        </div>
        <textarea data-field="text">${escapeHtml(clip.text)}</textarea>
        <textarea data-field="note" placeholder="${escapeHtml(placeholderNote)}">${escapeHtml(clip.note)}</textarea>
        ${tagsHtml}
        <div class="clip-meta">${escapeHtml(clip.title)} ${clip.url ? `- ${escapeHtml(clip.url)}` : ''}</div>
        <div class="clip-actions">
          <button data-action="save">${escapeHtml(saveLabel)}</button>
          <button class="secondary" data-action="copy">${escapeHtml(copyLabel)}</button>
          <button class="secondary" data-action="delete">${escapeHtml(deleteLabel)}</button>
        </div>
      </article>
    `;
  }).join('');

  // Sidebar projects manager list
  projectMgrList.innerHTML = projects.map((p) => `
    <div class="project-mgr-item" data-id="${p.id}" style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#c7f3e6;">
      <span class="project-mgr-name">${escapeHtml(p.name)}</span>
      <div style="display:flex; gap:8px;">
        <span class="project-mgr-rename-btn" style="cursor:pointer; font-size:11px; color:#8ae2ca;">改名</span>
        ${p.name !== 'Inbox' ? `<span class="project-mgr-delete-btn" style="cursor:pointer; font-size:11px; color:#f5a3a3;">删除</span>` : ''}
      </div>
    </div>
  `).join('');

  const isEn = GrowthVaultI18n.getActiveLanguage().startsWith('en');
  statusEl.textContent = isEn ? `${visible.length} clip${visible.length === 1 ? '' : 's'}` : `${visible.length} 条素材`;
}

async function refresh() {
  projects = await sendMessage({ type: 'LIST_PROJECTS' });
  clips = await sendMessage({ type: 'LIST_CLIPS', filters: {} });
  fillFilters();
  render();
}

// Global actions listener
clipList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  const removeTagBtn = event.target.closest('.remove-tag');
  
  if (removeTagBtn) {
    const container = removeTagBtn.closest('.clip-tags-container');
    const clipId = container.dataset.id;
    const tagToRemove = removeTagBtn.dataset.tag;
    const clip = clips.find((item) => item.id === clipId);
    if (clip && Array.isArray(clip.tags)) {
      const nextTags = clip.tags.filter((t) => t !== tagToRemove);
      await sendMessage({
        type: 'UPDATE_CLIP',
        clipId,
        patch: { tags: nextTags }
      });
      await refresh();
    }
    return;
  }

  if (!button) return;

  const card = event.target.closest('.clip');
  const clipId = card.dataset.id;
  const clip = clips.find((item) => item.id === clipId);
  const action = button.dataset.action;

  if (action === 'save') {
    await sendMessage({
      type: 'UPDATE_CLIP',
      clipId,
      patch: {
        text: card.querySelector('[data-field="text"]').value,
        note: card.querySelector('[data-field="note"]').value,
        projectId: card.querySelector('[data-field="projectId"]').value,
        type: card.querySelector('[data-field="type"]').value
      }
    });
    statusEl.textContent = GrowthVaultI18n.getMessage('savedChanges') || 'Saved changes.';
    await refresh();
  }

  if (action === 'copy') {
    await navigator.clipboard.writeText(`${clip.text}\n${clip.url || ''}`.trim());
    statusEl.textContent = GrowthVaultI18n.getMessage('copied') || 'Copied.';
  }

  if (action === 'delete') {
    if (confirm(GrowthVaultI18n.getMessage('deleteConfirmation') || 'Delete this clip?')) {
      await sendMessage({ type: 'DELETE_CLIP', clipId });
      await refresh();
    }
  }
});

// Listener for tag input keydowns
clipList.addEventListener('keydown', async (event) => {
  const input = event.target.closest('.add-tag-input');
  if (!input || event.key !== 'Enter') return;

  event.preventDefault();
  const val = input.value.trim();
  if (!val) return;

  const container = input.closest('.clip-tags-container');
  const clipId = container.dataset.id;
  const clip = clips.find((item) => item.id === clipId);
  if (clip) {
    const tagsList = Array.isArray(clip.tags) ? clip.tags : [];
    if (!tagsList.includes(val)) {
      const nextTags = [...tagsList, val];
      await sendMessage({
        type: 'UPDATE_CLIP',
        clipId,
        patch: { tags: nextTags }
      });
      await refresh();
    }
  }
});

// Sidebar project manager actions
sidebarNewProjectBtn.addEventListener('click', async () => {
  const name = sidebarNewProjectName.value.trim();
  if (!name) return;
  try {
    await sendMessage({ type: 'CREATE_PROJECT', name });
    sidebarNewProjectName.value = '';
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

sidebarNewProjectName.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    sidebarNewProjectBtn.click();
  }
});

projectMgrList.addEventListener('click', async (e) => {
  const renameBtn = e.target.closest('.project-mgr-rename-btn');
  const deleteBtn = e.target.closest('.project-mgr-delete-btn');
  if (!renameBtn && !deleteBtn) return;

  const item = e.target.closest('.project-mgr-item');
  const projectId = item.dataset.id;
  const project = projects.find((p) => p.id === projectId);

  if (renameBtn) {
    const newName = prompt('输入新的项目名称:', project.name);
    if (newName && newName.trim()) {
      try {
        await sendMessage({
          type: 'RENAME_PROJECT',
          projectId,
          name: newName.trim()
        });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    }
  }

  if (deleteBtn) {
    if (confirm(`确定要删除项目 "${project.name}" 及其包含的所有素材吗？`)) {
      try {
        await sendMessage({
          type: 'DELETE_PROJECT',
          projectId
        });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    }
  }
});

[projectFilter, typeFilter, tagFilter, domainFilter, searchInput].forEach((element) => {
  element.addEventListener('input', render);
});

// Wait for i18n initialization to complete
GrowthVaultI18n.initPromise.then(() => {
  GrowthVaultI18n.renderLanguageSwitcher('aside');
  refresh();
});

const projectFilter = document.querySelector('#project-filter');
const typeFilter = document.querySelector('#type-filter');
const domainFilter = document.querySelector('#domain-filter');
const searchInput = document.querySelector('#search-input');
const clipList = document.querySelector('#clip-list');
const statusEl = document.querySelector('#status');

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
  return projects.find((project) => project.id === projectId)?.name || 'Unknown project';
}

function typeLabel(typeId) {
  return GrowthVaultConstants.MATERIAL_TYPES.find((type) => type.id === typeId)?.label || typeId;
}

function fillFilters() {
  projectFilter.innerHTML = '<option value="">All projects</option>' + projects.map((project) => (
    `<option value="${project.id}">${escapeHtml(project.name)}</option>`
  )).join('');

  typeFilter.innerHTML = '<option value="">All types</option>' + GrowthVaultConstants.MATERIAL_TYPES.map((type) => (
    `<option value="${type.id}">${escapeHtml(type.label)}</option>`
  )).join('');

  const domains = [...new Set(clips.map((clip) => clip.domain).filter(Boolean))].sort();
  domainFilter.innerHTML = '<option value="">All domains</option>' + domains.map((domain) => (
    `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`
  )).join('');
}

function filteredClips() {
  const query = searchInput.value.trim().toLowerCase();
  return clips.filter((clip) => {
    if (projectFilter.value && clip.projectId !== projectFilter.value) return false;
    if (typeFilter.value && clip.type !== typeFilter.value) return false;
    if (domainFilter.value && clip.domain !== domainFilter.value) return false;
    if (query) {
      const haystack = [clip.text, clip.note, clip.title, clip.url, clip.domain].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function render() {
  const visible = filteredClips();
  clipList.innerHTML = visible.map((clip) => `
    <article class="clip" data-id="${clip.id}">
      <div class="clip-meta">${escapeHtml(projectName(clip.projectId))} / ${escapeHtml(typeLabel(clip.type))} / ${escapeHtml(clip.domain)}</div>
      <textarea data-field="text">${escapeHtml(clip.text)}</textarea>
      <textarea data-field="note" placeholder="Note">${escapeHtml(clip.note)}</textarea>
      <div class="clip-meta">${escapeHtml(clip.title)} ${clip.url ? `- ${escapeHtml(clip.url)}` : ''}</div>
      <div class="clip-actions">
        <button data-action="save">Save changes</button>
        <button class="secondary" data-action="copy">Copy</button>
        <button class="secondary" data-action="delete">Delete</button>
      </div>
    </article>
  `).join('');
  statusEl.textContent = `${visible.length} clip${visible.length === 1 ? '' : 's'}`;
}

async function refresh() {
  projects = await sendMessage({ type: 'LIST_PROJECTS' });
  clips = await sendMessage({ type: 'LIST_CLIPS', filters: {} });
  fillFilters();
  render();
}

clipList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
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
        note: card.querySelector('[data-field="note"]').value
      }
    });
    statusEl.textContent = 'Saved changes.';
    await refresh();
  }

  if (action === 'copy') {
    await navigator.clipboard.writeText(`${clip.text}\n${clip.url || ''}`.trim());
    statusEl.textContent = 'Copied.';
  }

  if (action === 'delete') {
    if (confirm('Delete this clip?')) {
      await sendMessage({ type: 'DELETE_CLIP', clipId });
      await refresh();
    }
  }
});

[projectFilter, typeFilter, domainFilter, searchInput].forEach((element) => {
  element.addEventListener('input', render);
});

refresh();

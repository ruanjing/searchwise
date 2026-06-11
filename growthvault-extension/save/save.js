const projectSelect = document.querySelector('#project-select');
const typeSelect = document.querySelector('#type-select');
const clipText = document.querySelector('#clip-text');
const clipNote = document.querySelector('#clip-note');
const statusEl = document.querySelector('#status');
const sourceLabel = document.querySelector('#source-label');
const newProjectName = document.querySelector('#new-project-name');

let draft = null;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message).then((response) => {
    if (!response || !response.ok) throw new Error(response?.error || 'GrowthVault request failed.');
    return response.result;
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fillTypes() {
  typeSelect.innerHTML = GrowthVaultConstants.MATERIAL_TYPES
    .map((type) => `<option value="${type.id}">${escapeHtml(type.label)}</option>`)
    .join('');
  typeSelect.value = 'idea';
}

async function loadProjects(selectedId) {
  const projects = await sendMessage({ type: 'LIST_PROJECTS' });
  projectSelect.innerHTML = projects
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
    .join('');
  if (selectedId) projectSelect.value = selectedId;
}

async function init() {
  fillTypes();
  await loadProjects();

  const params = new URLSearchParams(location.search);
  const draftId = params.get('draftId');
  if (draftId) {
    draft = await sendMessage({ type: 'CONSUME_PENDING_DRAFT', draftId });
  }

  if (!draft) {
    setStatus('No pending clip found. You can paste text manually.');
    draft = { text: '', title: '', url: '', domain: '' };
  }

  clipText.value = draft.text || '';
  sourceLabel.textContent = draft.url ? `${draft.title || draft.domain} - ${draft.url}` : 'Review this clip before saving it.';
}

document.querySelector('#create-project-btn').addEventListener('click', async () => {
  try {
    const project = await sendMessage({ type: 'CREATE_PROJECT', name: newProjectName.value });
    newProjectName.value = '';
    await loadProjects(project.id);
    setStatus(`Created project: ${project.name}`);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector('#save-btn').addEventListener('click', async () => {
  try {
    await sendMessage({
      type: 'CREATE_CLIP',
      clip: {
        projectId: projectSelect.value,
        type: typeSelect.value,
        text: clipText.value,
        note: clipNote.value,
        title: draft.title,
        url: draft.url,
        domain: draft.domain
      }
    });
    setStatus('Saved.');
  } catch (error) {
    setStatus(error.message);
  }
});

init();

const projectSelect = document.querySelector('#project-select');
const typeSelect = document.querySelector('#type-select');
const newProjectName = document.querySelector('#new-project-name');
const noteEl = document.querySelector('#clip-note');
const statusEl = document.querySelector('#status');
const pageTitleEl = document.querySelector('#page-title');

let activeTab = null;

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

async function loadActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0] || null;
  pageTitleEl.textContent = activeTab?.title || activeTab?.url || 'This page cannot be read.';
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

document.querySelector('#save-page-btn').addEventListener('click', async () => {
  try {
    if (!activeTab?.url || activeTab.url.startsWith('chrome://')) {
      setStatus('This page cannot be saved. Copy text manually into the library.');
      return;
    }

    const isDuplicate = await sendMessage({
      type: 'HAS_DUPLICATE_URL',
      projectId: projectSelect.value,
      url: activeTab.url
    });

    await sendMessage({
      type: 'CREATE_CLIP',
      clip: {
        projectId: projectSelect.value,
        type: typeSelect.value,
        text: activeTab.title || activeTab.url,
        note: noteEl.value,
        title: activeTab.title,
        url: activeTab.url
      }
    });

    setStatus(isDuplicate ? 'Saved. This URL was already in the project.' : 'Saved current page.');
  } catch (error) {
    setStatus(error.message);
  }
});

async function init() {
  fillTypes();
  await loadProjects();
  await loadActiveTab();
}

init();

const projectSelect = document.querySelector('#project-select');
const templateSelect = document.querySelector('#template-select');
const output = document.querySelector('#output');
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

function fillControls() {
  projectSelect.innerHTML = projects.map((project) => (
    `<option value="${project.id}">${escapeHtml(project.name)}</option>`
  )).join('');

  templateSelect.innerHTML = GrowthVaultTemplates.TEMPLATES.map((template) => (
    `<option value="${template.id}">${escapeHtml(template.name)}</option>`
  )).join('');
}

async function renderOutput() {
  const project = projects.find((item) => item.id === projectSelect.value);
  if (!project) {
    output.value = 'Create a project and save clips before exporting.';
    statusEl.textContent = 'No project selected.';
    return;
  }

  const projectClips = clips.filter((clip) => clip.projectId === project.id);
  output.value = GrowthVaultTemplates.renderTemplate(templateSelect.value, {
    projectName: project.name,
    clips: projectClips
  });
  statusEl.textContent = `${projectClips.length} clip${projectClips.length === 1 ? '' : 's'} included.`;
}

document.querySelector('#copy-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  statusEl.textContent = 'Markdown copied.';
});

[projectSelect, templateSelect].forEach((element) => {
  element.addEventListener('change', renderOutput);
});

async function init() {
  projects = await sendMessage({ type: 'LIST_PROJECTS' });
  clips = await sendMessage({ type: 'LIST_CLIPS', filters: {} });
  fillControls();
  await renderOutput();
}

init();

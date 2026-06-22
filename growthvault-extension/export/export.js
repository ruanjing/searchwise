const projectSelect = document.querySelector('#project-select');
const templateSelect = document.querySelector('#template-select');
const output = document.querySelector('#output');
const statusEl = document.querySelector('#status');

let projects = [];
let clips = [];
let customTemplates = [];

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

  const builtInOptions = GrowthVaultTemplates.TEMPLATES.map((template) => (
    `<option value="${template.id}">${escapeHtml(template.name)}</option>`
  ));

  const customOptions = customTemplates.map((template) => (
    `<option value="${template.id}">${escapeHtml(template.name)} (Custom)</option>`
  ));

  templateSelect.innerHTML = [...builtInOptions, ...customOptions].join('');
}

async function renderOutput() {
  const project = projects.find((item) => item.id === projectSelect.value);
  if (!project) {
    output.value = GrowthVaultI18n.getMessage('noProjectPlaceholder') || 'Create a project and save clips before exporting.';
    statusEl.textContent = GrowthVaultI18n.getMessage('noProjectSelected') || 'No project selected.';
    return;
  }

  const projectClips = clips.filter((clip) => clip.projectId === project.id);
  output.value = GrowthVaultTemplates.renderTemplate(templateSelect.value, {
    projectName: project.name,
    clips: projectClips,
    customTemplates: customTemplates
  });
  
  const isEn = GrowthVaultI18n.getActiveLanguage().startsWith('en');
  statusEl.textContent = isEn
    ? `${projectClips.length} clip${projectClips.length === 1 ? '' : 's'} included.`
    : `包含 ${projectClips.length} 条素材。`;
}

document.querySelector('#copy-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  statusEl.textContent = GrowthVaultI18n.getMessage('markdownCopied') || 'Markdown copied.';
});

[projectSelect, templateSelect].forEach((element) => {
  element.addEventListener('change', renderOutput);
});

async function init() {
  projects = await sendMessage({ type: 'LIST_PROJECTS' });
  clips = await sendMessage({ type: 'LIST_CLIPS', filters: {} });
  try {
    const res = await chrome.storage.local.get({ growthvault_custom_templates: [] });
    customTemplates = res.growthvault_custom_templates || [];
  } catch (e) {
    console.warn('Failed to load custom templates:', e);
  }
  fillControls();
  await renderOutput();
}

GrowthVaultI18n.initPromise.then(() => {
  init();
});

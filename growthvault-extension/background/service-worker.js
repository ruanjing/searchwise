importScripts('../shared/constants.js', '../shared/storage.js');

const CONTEXT_MENU_ID = 'growthvault-save-selection';

function getMessage(name, fallback) {
  return chrome.i18n.getMessage(name) || fallback;
}

async function listProjectsWithInbox() {
  await GrowthVaultStorage.ensureInboxProject();
  return GrowthVaultStorage.listProjects();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: getMessage('contextMenuSaveSelection', 'Save to GrowthVault'),
    contexts: ['selection']
  });
  GrowthVaultStorage.ensureInboxProject();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const draft = await GrowthVaultStorage.createPendingDraft({
    text: info.selectionText || '',
    title: tab?.title || '',
    url: info.pageUrl || tab?.url || '',
    domain: ''
  });

  const saveUrl = chrome.runtime.getURL(`save/save.html?draftId=${encodeURIComponent(draft.id)}`);
  chrome.tabs.create({ url: saveUrl });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    CREATE_PROJECT: async () => GrowthVaultStorage.createProject(message.name),
    RENAME_PROJECT: async () => GrowthVaultStorage.renameProject(message.projectId, message.name),
    LIST_PROJECTS: async () => listProjectsWithInbox(),
    DELETE_PROJECT: async () => GrowthVaultStorage.deleteProject(message.projectId),
    CREATE_CLIP: async () => GrowthVaultStorage.createClip(message.clip),
    UPDATE_CLIP: async () => GrowthVaultStorage.updateClip(message.clipId, message.patch),
    DELETE_CLIP: async () => GrowthVaultStorage.deleteClip(message.clipId),
    LIST_CLIPS: async () => GrowthVaultStorage.listClips(message.filters || {}),
    CONSUME_PENDING_DRAFT: async () => GrowthVaultStorage.consumePendingDraft(message.draftId),
    HAS_DUPLICATE_URL: async () => GrowthVaultStorage.hasDuplicateUrl(message.projectId, message.url)
  };

  const handler = handlers[message.type];
  if (!handler) return false;

  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

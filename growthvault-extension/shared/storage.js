const GrowthVaultStorage = (() => {
  const {
    STORAGE_KEYS,
    MATERIAL_TYPES,
    DEFAULT_PROJECT_NAME,
    MAX_CLIP_TEXT_LENGTH
  } = GrowthVaultConstants;

  const VALID_TYPES = new Set(MATERIAL_TYPES.map((type) => type.id));
  const DEFAULT_TYPE = 'idea';
  const PENDING_DRAFT_LIMIT = 20;

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    const id = crypto && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${id}`;
  }

  async function getValue(key, fallback) {
    const result = await chrome.storage.local.get({ [key]: fallback });
    return Array.isArray(result[key]) ? result[key] : fallback;
  }

  async function setValue(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async function getProjects() {
    return getValue(STORAGE_KEYS.PROJECTS, []);
  }

  async function saveProjects(projects) {
    await setValue(STORAGE_KEYS.PROJECTS, projects);
  }

  async function getClips() {
    return getValue(STORAGE_KEYS.CLIPS, []);
  }

  async function saveClips(clips) {
    await setValue(STORAGE_KEYS.CLIPS, clips);
  }

  async function getPendingDrafts() {
    return getValue(STORAGE_KEYS.PENDING_DRAFTS, []);
  }

  async function savePendingDrafts(drafts) {
    await setValue(STORAGE_KEYS.PENDING_DRAFTS, drafts.slice(0, PENDING_DRAFT_LIMIT));
  }

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeType(type) {
    return VALID_TYPES.has(type) ? type : DEFAULT_TYPE;
  }

  function normalizeDomain(domain, url) {
    const provided = normalizeText(domain);
    if (provided) return provided.toLowerCase().replace(/^www\./, '');

    const providedUrl = normalizeText(url);
    if (!providedUrl) return '';

    try {
      return new URL(providedUrl).hostname.toLowerCase().replace(/^www\./, '');
    } catch (_error) {
      return '';
    }
  }

  function compareNewestFirst(left, right) {
    return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
  }

  async function listProjects() {
    return (await getProjects()).slice().sort(compareNewestFirst);
  }

  async function ensureInboxProject() {
    let projects = await getProjects();
    const inboxProjects = projects.filter((project) => project.name === DEFAULT_PROJECT_NAME);
    
    if (inboxProjects.length > 0) {
      if (inboxProjects.length > 1) {
        const primaryInbox = inboxProjects[0];
        const primaryInboxId = primaryInbox.id;
        const duplicateInboxIds = inboxProjects.slice(1).map(p => p.id);
        
        // Deduplicate projects list
        projects = projects.filter(p => p.name !== DEFAULT_PROJECT_NAME || p.id === primaryInboxId);
        await saveProjects(projects);
        
        // Re-assign clips to primary inbox
        const clips = await getClips();
        let clipsChanged = false;
        const nextClips = clips.map(clip => {
          if (duplicateInboxIds.includes(clip.projectId)) {
            clipsChanged = true;
            return { ...clip, projectId: primaryInboxId };
          }
          return clip;
        });
        if (clipsChanged) {
          await saveClips(nextClips);
        }
      }
      return inboxProjects[0];
    }

    const timestamp = now();
    const inbox = {
      id: createId('project'),
      name: DEFAULT_PROJECT_NAME,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await saveProjects([inbox, ...projects]);
    return inbox;
  }

  async function createProject(name) {
    const trimmedName = normalizeText(name);
    if (!trimmedName) {
      throw new Error('Project name cannot be empty.');
    }

    const projects = await getProjects();
    if (projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error('Project name already exists.');
    }

    const timestamp = now();
    const project = {
      id: createId('project'),
      name: trimmedName,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await saveProjects([project, ...projects]);
    return project;
  }

  async function deleteProject(projectId) {
    const projects = await getProjects();
    const clips = await getClips();

    await saveProjects(projects.filter((project) => project.id !== projectId));
    await saveClips(clips.filter((clip) => clip.projectId !== projectId));
  }

  async function createClip(input) {
    const text = typeof input.text === 'string' ? input.text : '';
    if (text.length > MAX_CLIP_TEXT_LENGTH) {
      throw new Error(`Clip text exceeds ${MAX_CLIP_TEXT_LENGTH} characters`);
    }

    const clips = await getClips();
    const timestamp = now();
    const clip = {
      id: createId('clip'),
      projectId: input.projectId,
      type: normalizeType(input.type),
      text,
      note: typeof input.note === 'string' ? input.note : '',
      title: typeof input.title === 'string' ? input.title : '',
      url: typeof input.url === 'string' ? input.url : '',
      domain: normalizeDomain(input.domain, input.url),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await saveClips([clip, ...clips]);
    return clip;
  }

  async function updateClip(clipId, updates) {
    const clips = await getClips();
    let updatedClip = null;

    const nextClips = clips.map((clip) => {
      if (clip.id !== clipId) return clip;

      const next = {
        ...clip,
        ...updates,
        type: updates.type === undefined ? clip.type : normalizeType(updates.type),
        updatedAt: now()
      };

      if (updates.text !== undefined) {
        const text = typeof updates.text === 'string' ? updates.text : '';
        if (text.length > MAX_CLIP_TEXT_LENGTH) {
          throw new Error(`Clip text exceeds ${MAX_CLIP_TEXT_LENGTH} characters`);
        }
        next.text = text;
      }

      if (updates.domain !== undefined || updates.url !== undefined) {
        next.domain = normalizeDomain(next.domain, next.url);
      }

      updatedClip = next;
      return next;
    });

    await saveClips(nextClips);
    return updatedClip;
  }

  async function deleteClip(clipId) {
    const clips = await getClips();
    await saveClips(clips.filter((clip) => clip.id !== clipId));
  }

  async function listClips(filters = {}) {
    const query = normalizeText(filters.query).toLowerCase();
    const clips = await getClips();

    return clips
      .filter((clip) => !filters.projectId || clip.projectId === filters.projectId)
      .filter((clip) => !filters.type || clip.type === filters.type)
      .filter((clip) => {
        if (!query) return true;
        return [clip.text, clip.note, clip.title, clip.url, clip.domain]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort(compareNewestFirst);
  }

  async function hasDuplicateUrl(projectId, url) {
    const normalizedUrl = normalizeText(url);
    if (!normalizedUrl) return false;

    const clips = await getClips();
    return clips.some((clip) => clip.projectId === projectId && clip.url === normalizedUrl);
  }

  async function createPendingDraft(draft) {
    const drafts = await getPendingDrafts();
    const timestamp = now();
    const pendingDraft = {
      id: createId('draft'),
      ...draft,
      type: normalizeType(draft && draft.type),
      domain: normalizeDomain(draft && draft.domain, draft && draft.url),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await savePendingDrafts([pendingDraft, ...drafts]);
    return pendingDraft;
  }

  async function consumePendingDraft(draftId) {
    const drafts = await getPendingDrafts();
    const draft = drafts.find((item) => item.id === draftId);
    await savePendingDrafts(drafts.filter((item) => item.id !== draftId));
    return draft || null;
  }

  return {
    listProjects,
    ensureInboxProject,
    createProject,
    deleteProject,
    createClip,
    updateClip,
    deleteClip,
    listClips,
    hasDuplicateUrl,
    createPendingDraft,
    consumePendingDraft
  };
})();

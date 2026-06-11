# GrowthVault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-first GrowthVault Chrome extension MVP: save growth clips, organize them by project/type, and export Markdown from built-in templates.

**Architecture:** Create a new `growthvault-extension` Manifest V3 extension using vanilla HTML/CSS/JavaScript, following the existing repository's `draftwise-extension` and `searchwise-extension` patterns. Keep data in `chrome.storage.local`, use a background service worker for context menu saves, a popup for current-page saves, a save page for right-click review, a library page for management, and an export page for Markdown generation.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, CSS, `chrome.storage.local`, `chrome.contextMenus`, `chrome.activeTab`, Node smoke tests.

---

## File Structure

Create these files:

- `growthvault-extension/manifest.json`: MV3 manifest, permissions, background worker, action popup, options page, icons, locale.
- `growthvault-extension/README.md`: local install and verification instructions.
- `growthvault-extension/_locales/en/messages.json`: English store/runtime strings.
- `growthvault-extension/_locales/zh_CN/messages.json`: Simplified Chinese strings.
- `growthvault-extension/background/service-worker.js`: context menu registration, selected-text draft creation, message routing, storage writes.
- `growthvault-extension/shared/constants.js`: material types, template IDs, storage keys, limits.
- `growthvault-extension/shared/storage.js`: project/clip CRUD, ID/date helpers, validation, duplicate URL hints.
- `growthvault-extension/shared/templates.js`: built-in template definitions and Markdown generation.
- `growthvault-extension/popup/popup.html`: quick save current page UI.
- `growthvault-extension/popup/popup.css`: popup styling.
- `growthvault-extension/popup/popup.js`: popup state, current tab save, project/type controls.
- `growthvault-extension/save/save.html`: right-click selected-text review UI.
- `growthvault-extension/save/save.css`: save page styling.
- `growthvault-extension/save/save.js`: pending draft loading, project/type/note editing, final save.
- `growthvault-extension/library/library.html`: library management page.
- `growthvault-extension/library/library.css`: library styling.
- `growthvault-extension/library/library.js`: filters, search, edit, delete, copy, links to export.
- `growthvault-extension/export/export.html`: template export page.
- `growthvault-extension/export/export.css`: export page styling.
- `growthvault-extension/export/export.js`: project/template selection, Markdown preview, copy.
- `growthvault-extension/tests/manifest-smoke.test.mjs`: manifest and locale assertions.
- `growthvault-extension/tests/storage-smoke.test.mjs`: storage module behavior with a fake Chrome storage.
- `growthvault-extension/tests/templates-smoke.test.mjs`: Markdown template assertions.

Copy icons from `draftwise-extension/assets/icons/` into `growthvault-extension/assets/icons/` as a temporary low-cost placeholder. Replace brand icons before public launch.

Implementation note: Chrome context menu clicks cannot open the extension action popup directly. The right-click selected-text flow should create a pending draft in storage and open `save/save.html?draftId=<id>` in a normal tab.

---

### Task 1: Scaffold Manifest, Locales, README, And Manifest Smoke Test

**Files:**
- Create: `growthvault-extension/manifest.json`
- Create: `growthvault-extension/README.md`
- Create: `growthvault-extension/_locales/en/messages.json`
- Create: `growthvault-extension/_locales/zh_CN/messages.json`
- Create: `growthvault-extension/tests/manifest-smoke.test.mjs`
- Copy: `draftwise-extension/assets/icons/icon16.png` to `growthvault-extension/assets/icons/icon16.png`
- Copy: `draftwise-extension/assets/icons/icon32.png` to `growthvault-extension/assets/icons/icon32.png`
- Copy: `draftwise-extension/assets/icons/icon48.png` to `growthvault-extension/assets/icons/icon48.png`
- Copy: `draftwise-extension/assets/icons/icon128.png` to `growthvault-extension/assets/icons/icon128.png`

- [ ] **Step 1: Copy placeholder icons**

Run:

```powershell
New-Item -ItemType Directory -Path growthvault-extension\assets\icons -Force
Copy-Item draftwise-extension\assets\icons\icon16.png growthvault-extension\assets\icons\icon16.png
Copy-Item draftwise-extension\assets\icons\icon32.png growthvault-extension\assets\icons\icon32.png
Copy-Item draftwise-extension\assets\icons\icon48.png growthvault-extension\assets\icons\icon48.png
Copy-Item draftwise-extension\assets\icons\icon128.png growthvault-extension\assets\icons\icon128.png
```

Expected: the four copied icon files exist under `growthvault-extension/assets/icons/`.

- [ ] **Step 2: Write the failing manifest smoke test**

Create `growthvault-extension/tests/manifest-smoke.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, '_locales/en/messages.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, '_locales/zh_CN/messages.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, '__MSG_appName__');
assert.equal(manifest.version, '0.1.0');
assert.equal(manifest.default_locale, 'en');
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'contextMenus', 'storage']);
assert.ok(!manifest.host_permissions);
assert.equal(manifest.background.service_worker, 'background/service-worker.js');
assert.equal(manifest.action.default_popup, 'popup/popup.html');
assert.equal(manifest.options_page, 'library/library.html');
assert.equal(manifest.icons['128'], 'assets/icons/icon128.png');
assert.equal(manifest.action.default_icon['128'], 'assets/icons/icon128.png');
assert.ok(en.appName.message.includes('GrowthVault'));
assert.ok(en.appDescription.message.includes('growth'));
assert.ok(zh.appName.message.includes('GrowthVault'));
assert.ok(zh.appDescription.message.includes('\u7d20\u6750'));

console.log('GrowthVault manifest smoke tests passed');
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
node growthvault-extension\tests\manifest-smoke.test.mjs
```

Expected: FAIL with `ENOENT` for `manifest.json` or locale files.

- [ ] **Step 4: Create manifest and locales**

Create `growthvault-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "__MSG_appName__",
  "version": "0.1.0",
  "description": "__MSG_appDescription__",
  "default_locale": "en",
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_title": "GrowthVault",
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "32": "assets/icons/icon32.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "icons": {
    "16": "assets/icons/icon16.png",
    "32": "assets/icons/icon32.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },
  "options_page": "library/library.html"
}
```

Create `growthvault-extension/_locales/en/messages.json`:

```json
{
  "appName": {
    "message": "GrowthVault"
  },
  "appDescription": {
    "message": "Save growth ideas from any web page and turn them into launch posts, competitor notes, landing page copy, and pain point lists."
  },
  "contextMenuSaveSelection": {
    "message": "Save to GrowthVault"
  }
}
```

Create `growthvault-extension/_locales/zh_CN/messages.json`:

```json
{
  "appName": {
    "message": "GrowthVault"
  },
  "appDescription": {
    "message": "保存网页上的增长素材，并整理成发布文案、竞品笔记、落地页卖点和用户痛点列表。"
  },
  "contextMenuSaveSelection": {
    "message": "保存到 GrowthVault"
  }
}
```

Create `growthvault-extension/README.md`:

```markdown
# GrowthVault

GrowthVault is a local-first Chrome extension for operators, marketers, and indie makers. It saves growth material from web pages, organizes clips by project and type, and exports Markdown from built-in templates.

## MVP

- Save selected text from the right-click menu.
- Save the current page from the popup.
- Organize clips by project and material type.
- Search, filter, edit, delete, and copy clips in the library.
- Export project clips as Markdown using built-in templates.

## Local Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select `F:\demo0422\growthvault-extension`.

## Verify

```powershell
node --check growthvault-extension\background\service-worker.js
node --check growthvault-extension\shared\constants.js
node --check growthvault-extension\shared\storage.js
node --check growthvault-extension\shared\templates.js
node --check growthvault-extension\popup\popup.js
node --check growthvault-extension\save\save.js
node --check growthvault-extension\library\library.js
node --check growthvault-extension\export\export.js
node growthvault-extension\tests\manifest-smoke.test.mjs
node growthvault-extension\tests\storage-smoke.test.mjs
node growthvault-extension\tests\templates-smoke.test.mjs
Get-Content growthvault-extension\manifest.json | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\en\messages.json | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\zh_CN\messages.json | ConvertFrom-Json | Out-Null
```
```

- [ ] **Step 5: Run the manifest smoke test**

Run:

```powershell
node growthvault-extension\tests\manifest-smoke.test.mjs
```

Expected: PASS and prints `GrowthVault manifest smoke tests passed`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- growthvault-extension
git commit -m "feat: scaffold growthvault extension"
```

Expected: commit succeeds.

---

### Task 2: Add Constants And Storage Module

**Files:**
- Create: `growthvault-extension/shared/constants.js`
- Create: `growthvault-extension/shared/storage.js`
- Create: `growthvault-extension/tests/storage-smoke.test.mjs`

- [ ] **Step 1: Write the failing storage smoke test**

Create `growthvault-extension/tests/storage-smoke.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const constantsCode = fs.readFileSync(path.join(root, 'shared/constants.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(root, 'shared/storage.js'), 'utf8');

const data = {};
const chrome = {
  storage: {
    local: {
      async get(keys) {
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, data[key]]));
        }
        if (typeof keys === 'string') return { [keys]: data[keys] };
        return { ...keys, ...data };
      },
      async set(next) {
        Object.assign(data, next);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
      }
    }
  }
};

const context = { chrome, URL, crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` } };
vm.createContext(context);
vm.runInContext(`${constantsCode}\n${storageCode}\nthis.GV = GrowthVaultStorage; this.GVC = GrowthVaultConstants;`, context);

const { MATERIAL_TYPES, STORAGE_KEYS } = context.GVC;
assert.equal(MATERIAL_TYPES.length, 8);
assert.equal(STORAGE_KEYS.PROJECTS, 'growthvault_projects');

const inbox = await context.GV.ensureInboxProject();
assert.equal(inbox.name, 'Inbox');

const project = await context.GV.createProject('SearchWise');
assert.equal(project.name, 'SearchWise');

const clip = await context.GV.createClip({
  projectId: project.id,
  type: 'pain_point',
  text: 'Users dislike noisy search results.',
  note: 'Good launch angle',
  title: 'Example page',
  url: 'https://example.com/path',
  domain: 'example.com'
});

assert.equal(clip.domain, 'example.com');
assert.equal(clip.type, 'pain_point');

const duplicate = await context.GV.hasDuplicateUrl(project.id, 'https://example.com/path');
assert.equal(duplicate, true);

const clips = await context.GV.listClips({ projectId: project.id, type: 'pain_point', query: 'noisy' });
assert.equal(clips.length, 1);

await context.GV.updateClip(clip.id, { note: 'Updated note' });
const updated = (await context.GV.listClips({ query: 'updated' }))[0];
assert.equal(updated.note, 'Updated note');

await context.GV.deleteProject(project.id);
assert.equal((await context.GV.listClips({ projectId: project.id })).length, 0);

console.log('GrowthVault storage smoke tests passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node growthvault-extension\tests\storage-smoke.test.mjs
```

Expected: FAIL with `ENOENT` for `shared/constants.js` or `shared/storage.js`.

- [ ] **Step 3: Create constants module**

Create `growthvault-extension/shared/constants.js`:

```javascript
const GrowthVaultConstants = (() => {
  const STORAGE_KEYS = {
    PROJECTS: 'growthvault_projects',
    CLIPS: 'growthvault_clips',
    PENDING_DRAFTS: 'growthvault_pending_drafts'
  };

  const MATERIAL_TYPES = [
    { id: 'competitor', label: 'Competitor' },
    { id: 'value_proposition', label: 'Value Proposition' },
    { id: 'pain_point', label: 'Pain Point' },
    { id: 'user_comment', label: 'User Comment' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'title', label: 'Title' },
    { id: 'channel_example', label: 'Channel Example' },
    { id: 'idea', label: 'Idea' }
  ];

  const DEFAULT_PROJECT_NAME = 'Inbox';
  const MAX_CLIP_TEXT_LENGTH = 10000;

  return {
    STORAGE_KEYS,
    MATERIAL_TYPES,
    DEFAULT_PROJECT_NAME,
    MAX_CLIP_TEXT_LENGTH
  };
})();
```

- [ ] **Step 4: Create storage module**

Create `growthvault-extension/shared/storage.js`:

```javascript
const GrowthVaultStorage = (() => {
  const { STORAGE_KEYS, DEFAULT_PROJECT_NAME, MAX_CLIP_TEXT_LENGTH, MATERIAL_TYPES } = GrowthVaultConstants;
  const validTypes = new Set(MATERIAL_TYPES.map((type) => type.id));

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeDomain(url, fallbackDomain) {
    if (fallbackDomain) return String(fallbackDomain).replace(/^www\./, '').toLowerCase();
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  async function getArray(key) {
    const data = await chrome.storage.local.get({ [key]: [] });
    return Array.isArray(data[key]) ? data[key] : [];
  }

  async function setArray(key, items) {
    await chrome.storage.local.set({ [key]: items });
  }

  async function listProjects() {
    const projects = await getArray(STORAGE_KEYS.PROJECTS);
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  async function ensureInboxProject() {
    const projects = await getArray(STORAGE_KEYS.PROJECTS);
    const existing = projects.find((project) => project.name === DEFAULT_PROJECT_NAME);
    if (existing) return existing;

    const timestamp = nowIso();
    const inbox = {
      id: createId('project'),
      name: DEFAULT_PROJECT_NAME,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await setArray(STORAGE_KEYS.PROJECTS, [...projects, inbox]);
    return inbox;
  }

  async function createProject(name) {
    const cleanName = normalizeText(name);
    if (!cleanName) throw new Error('Project name is required.');

    const projects = await getArray(STORAGE_KEYS.PROJECTS);
    const existing = projects.find((project) => project.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const timestamp = nowIso();
    const project = {
      id: createId('project'),
      name: cleanName,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await setArray(STORAGE_KEYS.PROJECTS, [...projects, project]);
    return project;
  }

  async function deleteProject(projectId) {
    const projects = await getArray(STORAGE_KEYS.PROJECTS);
    const clips = await getArray(STORAGE_KEYS.CLIPS);
    await setArray(STORAGE_KEYS.PROJECTS, projects.filter((project) => project.id !== projectId));
    await setArray(STORAGE_KEYS.CLIPS, clips.filter((clip) => clip.projectId !== projectId));
  }

  async function createClip(input) {
    const text = normalizeText(input.text);
    if (text.length > MAX_CLIP_TEXT_LENGTH) {
      throw new Error(`Clip text must be ${MAX_CLIP_TEXT_LENGTH} characters or fewer.`);
    }

    const projectId = input.projectId || (await ensureInboxProject()).id;
    const type = validTypes.has(input.type) ? input.type : 'idea';
    const timestamp = nowIso();
    const domain = normalizeDomain(input.url, input.domain);
    const title = normalizeText(input.title) || domain || 'Untitled page';
    const clip = {
      id: createId('clip'),
      projectId,
      type,
      text,
      note: normalizeText(input.note),
      title,
      url: normalizeText(input.url),
      domain,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const clips = await getArray(STORAGE_KEYS.CLIPS);
    await setArray(STORAGE_KEYS.CLIPS, [clip, ...clips]);
    return clip;
  }

  async function updateClip(clipId, patch) {
    const clips = await getArray(STORAGE_KEYS.CLIPS);
    const timestamp = nowIso();
    const nextClips = clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      return {
        ...clip,
        ...patch,
        text: patch.text !== undefined ? normalizeText(patch.text).slice(0, MAX_CLIP_TEXT_LENGTH) : clip.text,
        note: patch.note !== undefined ? normalizeText(patch.note) : clip.note,
        updatedAt: timestamp
      };
    });
    await setArray(STORAGE_KEYS.CLIPS, nextClips);
    return nextClips.find((clip) => clip.id === clipId) || null;
  }

  async function deleteClip(clipId) {
    const clips = await getArray(STORAGE_KEYS.CLIPS);
    await setArray(STORAGE_KEYS.CLIPS, clips.filter((clip) => clip.id !== clipId));
  }

  async function listClips(filters = {}) {
    const query = normalizeText(filters.query).toLowerCase();
    const clips = await getArray(STORAGE_KEYS.CLIPS);
    return clips.filter((clip) => {
      if (filters.projectId && clip.projectId !== filters.projectId) return false;
      if (filters.type && clip.type !== filters.type) return false;
      if (filters.domain && clip.domain !== filters.domain) return false;
      if (query) {
        const haystack = [clip.text, clip.note, clip.title, clip.url, clip.domain].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  async function hasDuplicateUrl(projectId, url) {
    const normalizedUrl = normalizeText(url);
    if (!projectId || !normalizedUrl) return false;
    const clips = await getArray(STORAGE_KEYS.CLIPS);
    return clips.some((clip) => clip.projectId === projectId && clip.url === normalizedUrl);
  }

  async function createPendingDraft(input) {
    const timestamp = nowIso();
    const draft = {
      id: createId('draft'),
      text: normalizeText(input.text).slice(0, MAX_CLIP_TEXT_LENGTH),
      title: normalizeText(input.title),
      url: normalizeText(input.url),
      domain: normalizeDomain(input.url, input.domain),
      createdAt: timestamp
    };
    const drafts = await getArray(STORAGE_KEYS.PENDING_DRAFTS);
    await setArray(STORAGE_KEYS.PENDING_DRAFTS, [draft, ...drafts].slice(0, 20));
    return draft;
  }

  async function consumePendingDraft(draftId) {
    const drafts = await getArray(STORAGE_KEYS.PENDING_DRAFTS);
    const draft = drafts.find((item) => item.id === draftId) || null;
    await setArray(STORAGE_KEYS.PENDING_DRAFTS, drafts.filter((item) => item.id !== draftId));
    return draft;
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
```

- [ ] **Step 5: Run the storage smoke test**

Run:

```powershell
node growthvault-extension\tests\storage-smoke.test.mjs
```

Expected: PASS and prints `GrowthVault storage smoke tests passed`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- growthvault-extension/shared growthvault-extension/tests/storage-smoke.test.mjs
git commit -m "feat: add growthvault local storage"
```

Expected: commit succeeds.

---

### Task 3: Add Built-In Template Module

**Files:**
- Create: `growthvault-extension/shared/templates.js`
- Create: `growthvault-extension/tests/templates-smoke.test.mjs`

- [ ] **Step 1: Write the failing template smoke test**

Create `growthvault-extension/tests/templates-smoke.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const constantsCode = fs.readFileSync(path.join(root, 'shared/constants.js'), 'utf8');
const templatesCode = fs.readFileSync(path.join(root, 'shared/templates.js'), 'utf8');
const context = {};

vm.createContext(context);
vm.runInContext(`${constantsCode}\n${templatesCode}\nthis.GVT = GrowthVaultTemplates;`, context);

assert.equal(context.GVT.TEMPLATES.length, 4);

const clips = [
  { type: 'competitor', text: 'Competitor promises setup in 5 minutes.', note: '', title: 'Competitor home', url: 'https://example.com', domain: 'example.com' },
  { type: 'pain_point', text: 'Users complain that launch prep is scattered.', note: 'Reddit thread', title: 'Reddit', url: 'https://reddit.com/r/startups', domain: 'reddit.com' },
  { type: 'value_proposition', text: 'Turn saved material into launch copy.', note: '', title: 'Landing page', url: 'https://growth.test', domain: 'growth.test' }
];

const output = context.GVT.renderTemplate('launch_post', {
  projectName: 'GrowthVault',
  clips
});

assert.ok(output.includes('# Launch Post Draft: GrowthVault'));
assert.ok(output.includes('Users complain'));
assert.ok(output.includes('Source: https://reddit.com/r/startups'));

const competitorOutput = context.GVT.renderTemplate('competitor_analysis', {
  projectName: 'GrowthVault',
  clips
});
assert.ok(competitorOutput.includes('## Competitor Signals'));
assert.ok(competitorOutput.includes('Competitor promises setup'));

console.log('GrowthVault template smoke tests passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node growthvault-extension\tests\templates-smoke.test.mjs
```

Expected: FAIL with `ENOENT` for `shared/templates.js`.

- [ ] **Step 3: Create template module**

Create `growthvault-extension/shared/templates.js`:

```javascript
const GrowthVaultTemplates = (() => {
  const TEMPLATES = [
    { id: 'competitor_analysis', name: 'Competitor analysis summary' },
    { id: 'launch_post', name: 'Launch post draft' },
    { id: 'landing_page_value_props', name: 'Landing page value proposition list' },
    { id: 'pain_point_list', name: 'User pain point list' }
  ];

  function clipLine(clip) {
    const note = clip.note ? ` (${clip.note})` : '';
    const source = clip.url ? `\n  Source: ${clip.url}` : '';
    return `- ${clip.text || clip.title}${note}${source}`;
  }

  function clipsOf(clips, types) {
    const wanted = new Set(types);
    return clips.filter((clip) => wanted.has(clip.type));
  }

  function section(title, clips) {
    if (!clips.length) return `## ${title}\n\n- No saved material yet.\n`;
    return `## ${title}\n\n${clips.map(clipLine).join('\n')}\n`;
  }

  function renderCompetitorAnalysis(projectName, clips) {
    return [
      `# Competitor Analysis: ${projectName}`,
      section('Competitor Signals', clipsOf(clips, ['competitor', 'pricing', 'channel_example'])),
      section('Value Propositions', clipsOf(clips, ['value_proposition', 'title'])),
      section('User Pain Points', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Ideas To Test', clipsOf(clips, ['idea']))
    ].join('\n');
  }

  function renderLaunchPost(projectName, clips) {
    return [
      `# Launch Post Draft: ${projectName}`,
      section('Hook Ideas', clipsOf(clips, ['title', 'pain_point', 'user_comment'])),
      section('Product Promise', clipsOf(clips, ['value_proposition', 'idea'])),
      section('Proof And Context', clipsOf(clips, ['competitor', 'channel_example', 'pricing'])),
      '## Draft Notes\n\n- Combine the strongest pain point with one clear product promise.\n- Keep one source link nearby for credibility.\n'
    ].join('\n');
  }

  function renderLandingPage(projectName, clips) {
    return [
      `# Landing Page Value Props: ${projectName}`,
      section('Primary Value Props', clipsOf(clips, ['value_proposition'])),
      section('Pain Points To Address', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Competitive Angles', clipsOf(clips, ['competitor', 'pricing'])),
      section('Headline Ideas', clipsOf(clips, ['title', 'idea']))
    ].join('\n');
  }

  function renderPainPoints(projectName, clips) {
    return [
      `# User Pain Points: ${projectName}`,
      section('Direct Pain Points', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Supporting Context', clipsOf(clips, ['competitor', 'channel_example', 'pricing', 'idea']))
    ].join('\n');
  }

  function renderTemplate(templateId, { projectName, clips }) {
    const safeName = projectName || 'Untitled Project';
    const safeClips = Array.isArray(clips) ? clips : [];
    if (templateId === 'competitor_analysis') return renderCompetitorAnalysis(safeName, safeClips);
    if (templateId === 'launch_post') return renderLaunchPost(safeName, safeClips);
    if (templateId === 'landing_page_value_props') return renderLandingPage(safeName, safeClips);
    if (templateId === 'pain_point_list') return renderPainPoints(safeName, safeClips);
    throw new Error(`Unknown template: ${templateId}`);
  }

  return {
    TEMPLATES,
    renderTemplate
  };
})();
```

- [ ] **Step 4: Run the template smoke test**

Run:

```powershell
node growthvault-extension\tests\templates-smoke.test.mjs
```

Expected: PASS and prints `GrowthVault template smoke tests passed`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- growthvault-extension/shared/templates.js growthvault-extension/tests/templates-smoke.test.mjs
git commit -m "feat: add growthvault export templates"
```

Expected: commit succeeds.

---

### Task 4: Add Background Context Menu And Right-Click Save Page

**Files:**
- Create: `growthvault-extension/background/service-worker.js`
- Create: `growthvault-extension/save/save.html`
- Create: `growthvault-extension/save/save.css`
- Create: `growthvault-extension/save/save.js`
- Modify: `growthvault-extension/tests/manifest-smoke.test.mjs`

- [ ] **Step 1: Extend manifest smoke test for save page route**

Modify `growthvault-extension/tests/manifest-smoke.test.mjs` by adding this assertion after the `options_page` assertion:

```javascript
assert.equal(manifest.background.service_worker, 'background/service-worker.js');
```

Run:

```powershell
node growthvault-extension\tests\manifest-smoke.test.mjs
```

Expected: PASS if Task 1 manifest already includes the background worker.

- [ ] **Step 2: Create background service worker**

Create `growthvault-extension/background/service-worker.js`:

```javascript
importScripts('../shared/constants.js', '../shared/storage.js');

const CONTEXT_MENU_ID = 'growthvault-save-selection';

function getMessage(name, fallback) {
  return chrome.i18n.getMessage(name) || fallback;
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
    LIST_PROJECTS: async () => GrowthVaultStorage.listProjects(),
    CREATE_CLIP: async () => GrowthVaultStorage.createClip(message.clip),
    CONSUME_PENDING_DRAFT: async () => GrowthVaultStorage.consumePendingDraft(message.draftId)
  };

  const handler = handlers[message.type];
  if (!handler) return false;

  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
```

- [ ] **Step 3: Create save page HTML**

Create `growthvault-extension/save/save.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Save to GrowthVault</title>
  <link rel="stylesheet" href="save.css">
</head>
<body>
  <main class="gv-save">
    <header>
      <h1>Save to GrowthVault</h1>
      <p id="source-label">Review this clip before saving it.</p>
    </header>

    <label>
      Project
      <select id="project-select"></select>
    </label>

    <div class="inline-create">
      <input id="new-project-name" type="text" placeholder="New project name">
      <button id="create-project-btn" type="button">Create</button>
    </div>

    <label>
      Type
      <select id="type-select"></select>
    </label>

    <label>
      Clip
      <textarea id="clip-text" maxlength="10000"></textarea>
    </label>

    <label>
      Note
      <textarea id="clip-note" maxlength="1000" placeholder="Optional note"></textarea>
    </label>

    <p id="status" role="status"></p>
    <div class="actions">
      <button id="save-btn" type="button">Save clip</button>
      <a href="../library/library.html">Open library</a>
    </div>
  </main>

  <script src="../shared/constants.js"></script>
  <script src="save.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create save page CSS**

Create `growthvault-extension/save/save.css`:

```css
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f6f7f9;
  color: #17202a;
}

.gv-save {
  width: min(760px, calc(100vw - 32px));
  margin: 32px auto;
  display: grid;
  gap: 16px;
}

h1 {
  margin: 0 0 6px;
  font-size: 26px;
}

p {
  margin: 0;
  color: #5b6673;
}

label {
  display: grid;
  gap: 8px;
  font-weight: 700;
}

select,
input,
textarea {
  border: 1px solid #c8d0da;
  border-radius: 6px;
  padding: 10px 12px;
  font: inherit;
  background: #fff;
}

textarea {
  min-height: 150px;
  resize: vertical;
}

.inline-create {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

button {
  border: 0;
  border-radius: 6px;
  background: #1d6f5f;
  color: #fff;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}

a {
  color: #1d6f5f;
}

#status {
  min-height: 20px;
  font-weight: 700;
}
```

- [ ] **Step 5: Create save page script**

Create `growthvault-extension/save/save.js`:

```javascript
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

function fillTypes() {
  typeSelect.innerHTML = GrowthVaultConstants.MATERIAL_TYPES
    .map((type) => `<option value="${type.id}">${type.label}</option>`)
    .join('');
  typeSelect.value = 'idea';
}

async function loadProjects(selectedId) {
  const projects = await sendMessage({ type: 'LIST_PROJECTS' });
  projectSelect.innerHTML = projects
    .map((project) => `<option value="${project.id}">${project.name}</option>`)
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
```

- [ ] **Step 6: Run syntax checks**

Run:

```powershell
node --check growthvault-extension\background\service-worker.js
node --check growthvault-extension\save\save.js
node growthvault-extension\tests\manifest-smoke.test.mjs
node growthvault-extension\tests\storage-smoke.test.mjs
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add -- growthvault-extension/background growthvault-extension/save growthvault-extension/tests/manifest-smoke.test.mjs
git commit -m "feat: add growthvault selected text save flow"
```

Expected: commit succeeds.

---

### Task 5: Add Popup Current-Page Save Flow

**Files:**
- Create: `growthvault-extension/popup/popup.html`
- Create: `growthvault-extension/popup/popup.css`
- Create: `growthvault-extension/popup/popup.js`
- Modify: `growthvault-extension/background/service-worker.js`

- [ ] **Step 1: Add background handler for duplicate URL checks**

Modify the handler map in `growthvault-extension/background/service-worker.js`:

```javascript
const handlers = {
  CREATE_PROJECT: async () => GrowthVaultStorage.createProject(message.name),
  LIST_PROJECTS: async () => GrowthVaultStorage.listProjects(),
  CREATE_CLIP: async () => GrowthVaultStorage.createClip(message.clip),
  CONSUME_PENDING_DRAFT: async () => GrowthVaultStorage.consumePendingDraft(message.draftId),
  HAS_DUPLICATE_URL: async () => GrowthVaultStorage.hasDuplicateUrl(message.projectId, message.url)
};
```

- [ ] **Step 2: Create popup HTML**

Create `growthvault-extension/popup/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrowthVault</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <main class="gv-popup">
    <header>
      <strong>GrowthVault</strong>
      <a href="../library/library.html" target="_blank">Library</a>
    </header>

    <p id="page-title">Loading page...</p>

    <label>
      Project
      <select id="project-select"></select>
    </label>

    <div class="inline-create">
      <input id="new-project-name" type="text" placeholder="New project">
      <button id="create-project-btn" type="button">Create</button>
    </div>

    <label>
      Type
      <select id="type-select"></select>
    </label>

    <label>
      Note
      <textarea id="clip-note" placeholder="Optional note"></textarea>
    </label>

    <p id="status" role="status"></p>
    <button id="save-page-btn" type="button">Save current page</button>
  </main>

  <script src="../shared/constants.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create popup CSS**

Create `growthvault-extension/popup/popup.css`:

```css
body {
  width: 360px;
  margin: 0;
  font-family: Arial, sans-serif;
  color: #17202a;
}

.gv-popup {
  display: grid;
  gap: 12px;
  padding: 14px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

label {
  display: grid;
  gap: 6px;
  font-weight: 700;
}

select,
input,
textarea {
  border: 1px solid #c8d0da;
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
}

textarea {
  min-height: 70px;
  resize: vertical;
}

.inline-create {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

button {
  border: 0;
  border-radius: 6px;
  background: #1d6f5f;
  color: #fff;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;
}

a {
  color: #1d6f5f;
}

#page-title,
#status {
  margin: 0;
  color: #5b6673;
}
```

- [ ] **Step 4: Create popup script**

Create `growthvault-extension/popup/popup.js`:

```javascript
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

function fillTypes() {
  typeSelect.innerHTML = GrowthVaultConstants.MATERIAL_TYPES
    .map((type) => `<option value="${type.id}">${type.label}</option>`)
    .join('');
  typeSelect.value = 'idea';
}

async function loadProjects(selectedId) {
  const projects = await sendMessage({ type: 'LIST_PROJECTS' });
  projectSelect.innerHTML = projects
    .map((project) => `<option value="${project.id}">${project.name}</option>`)
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
```

- [ ] **Step 5: Run syntax checks**

Run:

```powershell
node --check growthvault-extension\popup\popup.js
node --check growthvault-extension\background\service-worker.js
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- growthvault-extension/popup growthvault-extension/background/service-worker.js
git commit -m "feat: add growthvault popup save flow"
```

Expected: commit succeeds.

---

### Task 6: Add Library Management Page

**Files:**
- Create: `growthvault-extension/library/library.html`
- Create: `growthvault-extension/library/library.css`
- Create: `growthvault-extension/library/library.js`
- Modify: `growthvault-extension/background/service-worker.js`

- [ ] **Step 1: Add background handlers for library operations**

Modify the handler map in `growthvault-extension/background/service-worker.js`:

```javascript
const handlers = {
  CREATE_PROJECT: async () => GrowthVaultStorage.createProject(message.name),
  LIST_PROJECTS: async () => GrowthVaultStorage.listProjects(),
  DELETE_PROJECT: async () => GrowthVaultStorage.deleteProject(message.projectId),
  CREATE_CLIP: async () => GrowthVaultStorage.createClip(message.clip),
  UPDATE_CLIP: async () => GrowthVaultStorage.updateClip(message.clipId, message.patch),
  DELETE_CLIP: async () => GrowthVaultStorage.deleteClip(message.clipId),
  LIST_CLIPS: async () => GrowthVaultStorage.listClips(message.filters || {}),
  CONSUME_PENDING_DRAFT: async () => GrowthVaultStorage.consumePendingDraft(message.draftId),
  HAS_DUPLICATE_URL: async () => GrowthVaultStorage.hasDuplicateUrl(message.projectId, message.url)
};
```

- [ ] **Step 2: Create library HTML**

Create `growthvault-extension/library/library.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrowthVault Library</title>
  <link rel="stylesheet" href="library.css">
</head>
<body>
  <main class="gv-app">
    <aside>
      <h1>GrowthVault</h1>
      <a href="../export/export.html">Export</a>
    </aside>

    <section class="content">
      <header>
        <div>
          <h2>Library</h2>
          <p>Search, filter, edit, copy, and delete saved clips.</p>
        </div>
      </header>

      <div class="filters">
        <select id="project-filter"></select>
        <select id="type-filter"></select>
        <select id="domain-filter"></select>
        <input id="search-input" type="search" placeholder="Search clips">
      </div>

      <div id="clip-list" class="clip-list"></div>
      <p id="status" role="status"></p>
    </section>
  </main>

  <script src="../shared/constants.js"></script>
  <script src="library.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create library CSS**

Create `growthvault-extension/library/library.css`:

```css
body {
  margin: 0;
  font-family: Arial, sans-serif;
  color: #17202a;
  background: #f6f7f9;
}

.gv-app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px 1fr;
}

aside {
  background: #163b35;
  color: #fff;
  padding: 24px;
}

aside a {
  color: #c7f3e6;
}

.content {
  padding: 28px;
  display: grid;
  gap: 18px;
  align-content: start;
}

h1,
h2,
p {
  margin: 0;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 10px;
}

select,
input,
textarea {
  border: 1px solid #c8d0da;
  border-radius: 6px;
  padding: 9px 10px;
  font: inherit;
  background: #fff;
}

.clip-list {
  display: grid;
  gap: 10px;
}

.clip {
  background: #fff;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.clip-meta {
  color: #5b6673;
  font-size: 13px;
}

.clip-actions {
  display: flex;
  gap: 8px;
}

button {
  border: 0;
  border-radius: 6px;
  background: #1d6f5f;
  color: #fff;
  padding: 8px 10px;
  font-weight: 700;
  cursor: pointer;
}

button.secondary {
  background: #e5ece9;
  color: #163b35;
}
```

- [ ] **Step 4: Create library script**

Create `growthvault-extension/library/library.js`:

```javascript
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
    `<option value="${type.id}">${type.label}</option>`
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
```

- [ ] **Step 5: Run syntax checks**

Run:

```powershell
node --check growthvault-extension\library\library.js
node --check growthvault-extension\background\service-worker.js
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- growthvault-extension/library growthvault-extension/background/service-worker.js
git commit -m "feat: add growthvault library management"
```

Expected: commit succeeds.

---

### Task 7: Add Markdown Export Page

**Files:**
- Create: `growthvault-extension/export/export.html`
- Create: `growthvault-extension/export/export.css`
- Create: `growthvault-extension/export/export.js`
- Modify: `growthvault-extension/export/export.html` to load shared templates

- [ ] **Step 1: Create export HTML**

Create `growthvault-extension/export/export.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrowthVault Export</title>
  <link rel="stylesheet" href="export.css">
</head>
<body>
  <main class="gv-export">
    <header>
      <div>
        <h1>Export</h1>
        <p>Generate Markdown from saved project clips.</p>
      </div>
      <a href="../library/library.html">Back to library</a>
    </header>

    <div class="controls">
      <select id="project-select"></select>
      <select id="template-select"></select>
      <button id="copy-btn" type="button">Copy Markdown</button>
    </div>

    <textarea id="output" readonly></textarea>
    <p id="status" role="status"></p>
  </main>

  <script src="../shared/constants.js"></script>
  <script src="../shared/templates.js"></script>
  <script src="export.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create export CSS**

Create `growthvault-extension/export/export.css`:

```css
body {
  margin: 0;
  font-family: Arial, sans-serif;
  color: #17202a;
  background: #f6f7f9;
}

.gv-export {
  width: min(1100px, calc(100vw - 40px));
  margin: 28px auto;
  display: grid;
  gap: 16px;
}

header,
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

h1,
p {
  margin: 0;
}

select,
textarea {
  border: 1px solid #c8d0da;
  border-radius: 6px;
  padding: 10px 12px;
  font: inherit;
  background: #fff;
}

textarea {
  width: 100%;
  min-height: 620px;
  box-sizing: border-box;
  resize: vertical;
}

button {
  border: 0;
  border-radius: 6px;
  background: #1d6f5f;
  color: #fff;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}

a {
  color: #1d6f5f;
}
```

- [ ] **Step 3: Create export script**

Create `growthvault-extension/export/export.js`:

```javascript
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

function fillControls() {
  projectSelect.innerHTML = projects.map((project) => (
    `<option value="${project.id}">${project.name}</option>`
  )).join('');

  templateSelect.innerHTML = GrowthVaultTemplates.TEMPLATES.map((template) => (
    `<option value="${template.id}">${template.name}</option>`
  )).join('');
}

async function renderOutput() {
  const project = projects.find((item) => item.id === projectSelect.value);
  if (!project) {
    output.value = 'Create a project and save clips before exporting.';
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
```

- [ ] **Step 4: Run syntax and template checks**

Run:

```powershell
node --check growthvault-extension\export\export.js
node growthvault-extension\tests\templates-smoke.test.mjs
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- growthvault-extension/export
git commit -m "feat: add growthvault markdown export"
```

Expected: commit succeeds.

---

### Task 8: Final Verification And Manual QA

**Files:**
- Modify: `growthvault-extension/README.md` only if verification commands drifted during implementation.

- [ ] **Step 1: Run full syntax checks**

Run:

```powershell
node --check growthvault-extension\background\service-worker.js
node --check growthvault-extension\shared\constants.js
node --check growthvault-extension\shared\storage.js
node --check growthvault-extension\shared\templates.js
node --check growthvault-extension\popup\popup.js
node --check growthvault-extension\save\save.js
node --check growthvault-extension\library\library.js
node --check growthvault-extension\export\export.js
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Run all smoke tests**

Run:

```powershell
node growthvault-extension\tests\manifest-smoke.test.mjs
node growthvault-extension\tests\storage-smoke.test.mjs
node growthvault-extension\tests\templates-smoke.test.mjs
```

Expected:

```text
GrowthVault manifest smoke tests passed
GrowthVault storage smoke tests passed
GrowthVault template smoke tests passed
```

- [ ] **Step 3: Validate JSON files**

Run:

```powershell
Get-Content growthvault-extension\manifest.json | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\en\messages.json | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\zh_CN\messages.json | ConvertFrom-Json | Out-Null
```

Expected: no output and exit code 0.

- [ ] **Step 4: Manual browser QA**

Load unpacked extension from `F:\demo0422\growthvault-extension`, then verify:

```text
1. Open a normal web page.
2. Select text.
3. Right-click and choose "Save to GrowthVault".
4. Confirm save page opens with selected text and page URL.
5. Create a project named "Manual QA".
6. Save the clip as "Pain Point".
7. Click the extension icon on another page.
8. Save the current page to "Manual QA".
9. Open the library.
10. Filter by project "Manual QA".
11. Filter by type "Pain Point".
12. Search for a word in the selected clip.
13. Edit the note and save changes.
14. Copy the clip.
15. Delete one clip and confirm it disappears.
16. Open export.
17. Choose "Manual QA" and "Launch post draft".
18. Copy generated Markdown.
```

Expected: each action works without login, remote API calls, or broad host permissions.

- [ ] **Step 5: Commit final adjustments**

If README or small QA fixes changed, run:

```powershell
git add -- growthvault-extension
git commit -m "chore: verify growthvault mvp"
```

Expected: commit succeeds if there are changes. If no files changed, skip this commit.

---

## Self-Review Notes

Spec coverage:

- Save selected text: Task 4.
- Save current page: Task 5.
- Project management: Tasks 2, 4, 5, 6.
- Fixed material types: Task 2.
- Library filters/edit/delete/copy: Task 6.
- Template export: Tasks 3 and 7.
- Local-first storage: Task 2.
- Minimal permissions: Task 1 and Task 8.
- Error handling: storage validation in Task 2, restricted page handling in Task 5, duplicate hint in Task 5, delete confirmation in Task 6.

No planned task adds AI, login, cloud sync, payment, auto-posting, platform automation, bulk scraping, or custom templates.

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

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

const missingTitleOutput = context.GVT.renderTemplate('landing_page_value_props', {
  projectName: 'GrowthVault',
  clips: [{ type: 'value_proposition', url: 'https://fallback.test' }]
});
assert.ok(missingTitleOutput.includes('Untitled saved material'));
assert.ok(!missingTitleOutput.includes('undefined'));

const defaultOutput = context.GVT.renderTemplate('pain_point_list');
assert.ok(defaultOutput.includes('# User Pain Points: Untitled Project'));

const nullOptionsOutput = context.GVT.renderTemplate('pain_point_list', null);
assert.ok(nullOptionsOutput.includes('# User Pain Points: Untitled Project'));

console.log('GrowthVault template smoke tests passed');

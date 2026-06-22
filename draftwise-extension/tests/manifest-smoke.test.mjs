import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, '_locales/en/messages.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, '_locales/zh_CN/messages.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '0.2.0');
assert.equal(manifest.default_locale, 'en');
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage']);
assert.ok(!manifest.host_permissions);
assert.ok(!manifest.content_scripts);
assert.equal(manifest.action.default_popup, 'popup/popup.html');
assert.equal(manifest.icons['128'], 'assets/icons/icon128.png');
assert.equal(manifest.action.default_icon['128'], 'assets/icons/icon128.png');
assert.ok(en.appName.message.includes('DraftWise'));
assert.ok(zh.appName.message.includes('DraftWise'));
assert.ok(zh.appDescription.message.includes('\u672c\u5730'));

console.log('DraftWise manifest smoke tests passed');

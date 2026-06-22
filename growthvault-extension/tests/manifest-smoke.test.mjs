import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, '_locales/en/messages.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, '_locales/zh_CN/messages.json'), 'utf8'));

function assertManifestFileExists(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} should exist`);
}

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, '__MSG_appName__');
assert.equal(manifest.version, '0.2.0');
assert.equal(manifest.default_locale, 'en');
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'contextMenus', 'storage']);
assert.ok(!manifest.host_permissions);
assert.equal(manifest.background.service_worker, 'background/service-worker.js');
assert.equal(manifest.action.default_popup, 'popup/popup.html');
assert.equal(manifest.options_page, 'library/library.html');
assert.equal(manifest.icons['128'], 'assets/icons/icon128.png');
assert.equal(manifest.action.default_icon['128'], 'assets/icons/icon128.png');
assertManifestFileExists(manifest.background.service_worker);
assertManifestFileExists(manifest.action.default_popup);
assertManifestFileExists(manifest.options_page);
for (const iconPath of Object.values(manifest.icons)) {
  assertManifestFileExists(iconPath);
}
assert.ok(en.appName.message.includes('GrowthVault'));
assert.ok(en.appDescription.message.includes('growth'));
assert.ok(zh.appName.message.includes('GrowthVault'));
assert.ok(zh.appDescription.message.includes('\u7d20\u6750'));

console.log('GrowthVault manifest smoke tests passed');

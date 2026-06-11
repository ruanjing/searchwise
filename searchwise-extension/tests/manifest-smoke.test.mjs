import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^\uFEFF/, ''));
}

const manifest = readJson('manifest.json');
const popupHtml = fs.readFileSync(path.join(root, 'popup/popup.html'), 'utf8');
const optionsHtml = fs.readFileSync(path.join(root, 'options/options.html'), 'utf8');
const en = readJson('_locales/en/messages.json');
const zh = readJson('_locales/zh_CN/messages.json');
const scripts = manifest.content_scripts;

function hasMatch(fragment) {
  return scripts.some(script => script.matches.some(match => match.includes(fragment)));
}

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.5.7');
assert.ok(hasMatch('google.com/search'));
assert.ok(hasMatch('google.com.hk/search'));
assert.ok(hasMatch('bing.com/search'));
assert.ok(hasMatch('cn.bing.com/search'));
assert.ok(hasMatch('baidu.com'));
assert.ok(hasMatch('duckduckgo.com'));
assert.ok(hasMatch('sogou.com'));
assert.ok(hasMatch('so.com'));
assert.ok(hasMatch('yandex.com'));
assert.ok(hasMatch('yandex.ru'));
assert.ok(!manifest.host_permissions.some(permission => permission.includes('localhost')));
assert.ok(!manifest.host_permissions.some(permission => permission.includes('127.0.0.1')));
assert.ok(popupHtml.includes('try-search-btn'));
assert.ok(optionsHtml.includes('try-search-onboarding'));
assert.equal(en.trySearchWise.message, 'Try on Bing');
assert.ok(zh.trySearchWise.message.includes('Bing'));

console.log('manifest smoke tests passed');

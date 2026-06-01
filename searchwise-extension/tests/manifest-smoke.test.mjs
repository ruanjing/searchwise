import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts;

function hasMatch(fragment) {
  return scripts.some(script => script.matches.some(match => match.includes(fragment)));
}

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.5.0');
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

console.log('manifest smoke tests passed');

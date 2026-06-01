import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const code = fs.readFileSync(path.join(root, 'content/shared/constants.js'), 'utf8');
const context = {};

vm.createContext(context);
vm.runInContext(`${code}\nthis.__SW = SW;`, context);

const { DEFAULT_RULES, DEFAULT_BLACKLIST } = context.__SW;
const domains = DEFAULT_RULES.map(rule => rule.domain);
const categories = new Set(DEFAULT_RULES.map(rule => rule.category));

assert.equal(new Set(domains).size, domains.length);
assert.deepEqual(DEFAULT_BLACKLIST, domains);
assert.ok(categories.has('cn_mirror'));
assert.ok(categories.has('low_signal_tutorial'));
assert.ok(DEFAULT_BLACKLIST.includes('javatpoint.com'));
assert.ok(DEFAULT_BLACKLIST.includes('guru99.com'));
assert.ok(DEFAULT_BLACKLIST.includes('brainly.com'));

console.log('rules smoke tests passed');

// SPDX-License-Identifier: GPL-2.0-or-later
// Validate the actual upload, not just the build directory. No npm dependencies.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const uuid = 'scratchpad@exclude-barrier.github.io';
const schema = 'org.gnome.shell.extensions.scratchpad';
const archive = `build/${uuid}.shell-extension.zip`;
const files = [
    'LICENSE', 'compat.js', 'extension.js', 'geometry.js', 'metadata.json',
    'prefs.js', `schemas/${schema}.gschema.xml`,
].sort();
execFileSync('unzip', ['-tqq', archive], { stdio: 'inherit' });
const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
    .trim().split('\n').sort();
assert.deepEqual(entries, files, 'Unexpected or missing upload files');
const extract = name => execFileSync('unzip', ['-p', archive, name]);
const metadata = JSON.parse(extract('metadata.json').toString());
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.equal(metadata.uuid, uuid);
assert.equal(metadata['settings-schema'], schema);
assert.equal(metadata['version-name'], pkg.version, 'Metadata/package version mismatch');
assert.equal(lock.version, pkg.version, 'Lockfile version mismatch');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root version mismatch');
assert.match(metadata['version-name'], /^(?![. ]+$)[a-zA-Z0-9 .]{1,16}$/);
assert.ok(!Object.hasOwn(metadata, 'version'), 'EGO assigns the numeric version');
assert.ok(Array.isArray(metadata['shell-version']) && metadata['shell-version'].length > 0);
assert.ok(metadata['shell-version'].every(version => /^\d+$/.test(version)));
assert.equal(new Set(metadata['shell-version']).size, metadata['shell-version'].length);
assert.equal(metadata.url, 'https://github.com/exclude-barrier/scratchpad');
assert.deepEqual(metadata['session-modes'], ['user', 'unlock-dialog']);
for (const name of files) {
    const source = name === 'LICENSE' ? name : `build/${uuid}/${name}`;
    assert.ok(extract(name).equals(readFileSync(source)), `Archive differs from build: ${name}`);
}
const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`);
console.log(`Validated ${archive}: ${files.length} files, version ${pkg.version}`);
console.log(`SHA-256: ${digest}`);

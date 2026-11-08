// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const uuid = 'scratchpad@exclude-barrier.github.io';
const schema = 'org.gnome.shell.extensions.scratchpad';
const files = ['LICENSE', 'compat.js', 'extension.js', 'geometry.js', 'metadata.json',
    'prefs.js', `schemas/${schema}.gschema.xml`];

function fixture(callback) {
    const root = mkdtempSync(join(tmpdir(), 'scratchpad-package-'));
    try {
        const build = join(root, 'build', uuid);
        mkdirSync(join(build, 'schemas'), { recursive: true });
        mkdirSync(join(root, 'scripts'));
        copyFileSync('scripts/check-package.mjs', join(root, 'scripts/check-package.mjs'));
        copyFileSync('package.json', join(root, 'package.json'));
        copyFileSync('package-lock.json', join(root, 'package-lock.json'));
        copyFileSync('LICENSE', join(root, 'LICENSE'));
        for (const name of files) {
            if (name === 'LICENSE')
                continue;
            if (name === 'metadata.json')
                copyFileSync(`extension/${uuid}/metadata.json`, join(build, name));
            else if (name.startsWith('schemas/'))
                copyFileSync(`extension/${uuid}/${name}`, join(build, name));
            else
                writeFileSync(join(build, name), '// synthetic package-test fixture\n');
        }
        copyFileSync('LICENSE', join(build, 'LICENSE'));
        const archive = join(root, 'build', `${uuid}.shell-extension.zip`);
        const pack = (names = files) => {
            rmSync(archive, { force: true });
            execFileSync('zip', ['-Xq', archive, ...names], { cwd: build });
        };
        const check = () => spawnSync(process.execPath, [resolve(root, 'scripts/check-package.mjs')],
            { encoding: 'utf8' });
        pack();
        callback({ root, build, archive, pack, check });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test('package: accepts allowlisted archive and writes matching SHA-256', () => fixture(({ archive, check }) => {
    const result = check();
    assert.equal(result.status, 0, result.stderr);
    const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
    assert.equal(readFileSync(`${archive}.sha256`, 'utf8'), `${digest}  ${uuid}.shell-extension.zip\n`);
}));

test('package: rejects an extra file', () => fixture(({ build, pack, check }) => {
    writeFileSync(join(build, 'secret.env'), 'must not ship');
    pack([...files, 'secret.env']);
    assert.notEqual(check().status, 0);
}));

test('package: rejects a missing schema', () => fixture(({ pack, check }) => {
    pack(files.filter(name => !name.startsWith('schemas/')));
    assert.notEqual(check().status, 0);
}));

test('package: rejects mismatched package version', () => fixture(({ root, check }) => {
    const path = join(root, 'package.json');
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    pkg.version = '9.9.9';
    writeFileSync(path, JSON.stringify(pkg));
    assert.notEqual(check().status, 0);
}));

test('package: rejects source/build content changed after packing', () => fixture(({ build, check }) => {
    writeFileSync(join(build, 'extension.js'), '// changed after packing\n');
    assert.notEqual(check().status, 0);
}));

test('package: rejects numeric EGO submission version in source metadata', () => fixture(({ build, pack, check }) => {
    const path = join(build, 'metadata.json');
    const metadata = JSON.parse(readFileSync(path, 'utf8'));
    metadata.version = 999;
    writeFileSync(path, JSON.stringify(metadata));
    pack();
    assert.notEqual(check().status, 0);
}));

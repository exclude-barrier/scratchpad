// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MIN_TILE_WIDTH, overlayRect, tileColumns, validMonitor } from '../src/geometry.js';

const area = { x: 0, y: 32, width: 1920, height: 1048 };

test('overlayRect: full size keeps the outer gap on every side', () => {
    const r = overlayRect(area, { gapOuter: 10, widthPercent: 100, heightPercent: 100 });
    assert.deepEqual(r, { x: 10, y: 42, width: 1900, height: 1028 });
});

test('overlayRect: half height is anchored to the bottom', () => {
    const r = overlayRect(area, { gapOuter: 10, widthPercent: 100, heightPercent: 50 });
    assert.equal(r.height, 514);
    assert.equal(r.y + r.height, area.y + area.height - 10);
});

test('overlayRect: gaps larger than the area never give zero or negative size', () => {
    const r = overlayRect({ x: 0, y: 0, width: 50, height: 50 },
        { gapOuter: 100, widthPercent: 100, heightPercent: 100 });
    assert.ok(r.width >= 1 && r.height >= 1);
});

test('tileColumns: columns are 2 * gapInner apart and fill the width', () => {
    const cols = tileColumns({ x: 10, y: 42, width: 1900, height: 1028 }, 2, 5);
    assert.equal(cols.length, 2);
    assert.equal(cols[1].x - (cols[0].x + cols[0].width), 10);
    assert.ok(cols[1].x + cols[1].width <= 10 + 1900);
});

test('tileColumns: many windows keep the minimum width', () => {
    const cols = tileColumns({ x: 0, y: 0, width: 800, height: 600 }, 20, 50);
    assert.equal(cols.length, 20);
    for (const c of cols)
        assert.equal(c.width, MIN_TILE_WIDTH);
});

test('tileColumns: no windows, no columns', () => {
    assert.deepEqual(tileColumns({ x: 0, y: 0, width: 800, height: 600 }, 0, 5), []);
});

test('validMonitor: stale or negative index falls back', () => {
    assert.equal(validMonitor(1, 2, 0), 1);
    assert.equal(validMonitor(2, 1, 0), 0);
    assert.equal(validMonitor(-1, 2, 1), 1);
    assert.equal(validMonitor(5, 1, 7), 0);
});

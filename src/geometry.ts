// SPDX-License-Identifier: GPL-2.0-or-later
// Pure geometry helpers. No gi:// imports, so `npm test` can run them under
// Node without GNOME Shell.

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface OverlayOptions {
    gapOuter: number;
    widthPercent: number;
    heightPercent: number;
}

// Narrowest a tiled window gets. With many windows the columns overflow the
// overlay to the right instead of shrinking to zero or negative widths.
export const MIN_TILE_WIDTH = 200;

// Bottom-anchored overlay rectangle inside a work area.
export function overlayRect(area: Rect, opts: OverlayOptions): Rect {
    const gap = Math.max(0, opts.gapOuter);
    const availW = Math.max(1, area.width - 2 * gap);
    const availH = Math.max(1, area.height - 2 * gap);
    const width = Math.max(1, Math.round(availW * opts.widthPercent / 100));
    const height = Math.max(1, Math.round(availH * opts.heightPercent / 100));
    return {
        x: area.x + gap + Math.round((availW - width) / 2),
        y: area.y + area.height - gap - height,
        width,
        height,
    };
}

// Side-by-side columns inside rect. gapInner is half the gap between two
// columns, so neighbours are 2 * gapInner apart.
export function tileColumns(rect: Rect, count: number, gapInner: number): Rect[] {
    if (count <= 0)
        return [];
    const gap = 2 * Math.max(0, gapInner);
    const width = Math.max(
        MIN_TILE_WIDTH,
        Math.floor((rect.width - (count - 1) * gap) / count));
    return Array.from({ length: count }, (_, i) => ({
        x: rect.x + i * (width + gap),
        y: rect.y,
        width,
        height: rect.height,
    }));
}

// Index of a monitor that exists, falling back when a stored index is stale
// (monitor unplugged) or a window reports -1.
export function validMonitor(index: number, count: number, fallback: number): number {
    if (Number.isInteger(index) && index >= 0 && index < count)
        return index;
    if (Number.isInteger(fallback) && fallback >= 0 && fallback < count)
        return fallback;
    return 0;
}

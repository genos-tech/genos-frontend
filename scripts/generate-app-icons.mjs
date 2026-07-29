/**
 * Generates every app icon from `public/genos-logo.png`.
 *
 *   node scripts/generate-app-icons.mjs
 *
 * Run this whenever the brand mark changes — the outputs are committed,
 * so this exists to make them reproducible rather than mysterious.
 *
 * Why the icons aren't just the logo file
 * --------------------------------------
 * `genos-logo.png` is transparent and not square. Both break app icons:
 * iOS/iPadOS and Android 8+ fill transparency with a background colour of
 * their choosing (Apple's is black, which swallows a dark purple mark),
 * and a non-square source gets letterboxed or squashed. So each icon is
 * composited onto an opaque white square here.
 *
 * Why the two families
 * --------------------
 *   *.png            purpose "any" — near full-bleed (SCALE_ANY). The OS
 *                    adds its own inset when it draws a dock/home-screen
 *                    icon, so padding here compounds with theirs and the
 *                    mark ends up looking small. That was a real bug.
 *   *-maskable.png   purpose "maskable" — the launcher crops these to its
 *                    own shape, and only the centre 80%-diameter circle
 *                    is guaranteed to survive. SCALE_MASKABLE fills that
 *                    safe zone and no more.
 *
 * No sharp / PIL / ImageMagick is available on the build machines, and
 * `sips` can resize but cannot flatten an alpha channel — hence the small
 * hand-rolled PNG decode/encode below.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

function decode(file) {
    const buf = readFileSync(file);
    let pos = 8,
        w = 0,
        h = 0,
        depth = 0,
        color = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString("ascii", pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === "IHDR") {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            depth = data[8];
            color = data[9];
        }
        if (type === "IDAT") idat.push(data);
        if (type === "IEND") break;
        pos += 12 + len;
    }
    if (depth !== 8 || color !== 6) throw new Error(`${file}: need 8-bit RGBA`);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = 4,
        stride = w * bpp;
    const out = Buffer.alloc(h * stride);
    let rp = 0;
    const paeth = (a, b, c) => {
        const p = a + b - c,
            pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < h; y++) {
        const f = raw[rp++];
        for (let x = 0; x < stride; x++) {
            const cur = raw[rp + x];
            const a = x >= bpp ? out[y * stride + x - bpp] : 0;
            const b = y > 0 ? out[(y - 1) * stride + x] : 0;
            const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
            let v;
            if (f === 0) v = cur;
            else if (f === 1) v = cur + a;
            else if (f === 2) v = cur + b;
            else if (f === 3) v = cur + ((a + b) >> 1);
            else v = cur + paeth(a, b, c);
            out[y * stride + x] = v & 0xff;
        }
        rp += stride;
    }
    return { w, h, data: out };
}

function encode(w, h, rgba, outFile) {
    const stride = w * 4;
    const rawWithFilters = Buffer.alloc(h * (stride + 1));
    for (let y = 0; y < h; y++) {
        rawWithFilters[y * (stride + 1)] = 0;
        rgba.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    writeFileSync(
        outFile,
        Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk("IHDR", ihdr),
            chunk("IDAT", zlib.deflateSync(rawWithFilters, { level: 9 })),
            chunk("IEND", Buffer.alloc(0)),
        ])
    );
}

/** Square canvas, source centered at `scale` of the canvas, composited on bg. */
function squareOnBackground(src, size, scale, bg) {
    const dst = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        dst[i * 4] = bg[0];
        dst[i * 4 + 1] = bg[1];
        dst[i * 4 + 2] = bg[2];
        dst[i * 4 + 3] = bg[3] ?? 255;
    }
    // Fit the source inside `size * scale`, preserving aspect ratio.
    const target = size * scale;
    const ratio = Math.min(target / src.w, target / src.h);
    const dw = Math.round(src.w * ratio),
        dh = Math.round(src.h * ratio);
    const ox = Math.round((size - dw) / 2),
        oy = Math.round((size - dh) / 2);
    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            // Box-average the source pixels mapping to this destination
            // pixel — plain nearest-neighbour visibly aliases a logo.
            const sx0 = Math.floor((x / dw) * src.w),
                sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) / dw) * src.w));
            const sy0 = Math.floor((y / dh) * src.h),
                sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) / dh) * src.h));
            let r = 0,
                g = 0,
                b = 0,
                a = 0,
                n = 0;
            for (let sy = sy0; sy < sy1 && sy < src.h; sy++) {
                for (let sx = sx0; sx < sx1 && sx < src.w; sx++) {
                    const si = (sy * src.w + sx) * 4;
                    const sa = src.data[si + 3] / 255;
                    r += src.data[si] * sa;
                    g += src.data[si + 1] * sa;
                    b += src.data[si + 2] * sa;
                    a += sa;
                    n++;
                }
            }
            if (!n) continue;
            const alpha = a / n;
            if (alpha <= 0) continue;
            const sr = r / n / alpha,
                sg = g / n / alpha,
                sb = b / n / alpha;
            const di = ((y + oy) * size + (x + ox)) * 4;
            dst[di] = Math.round(sr * alpha + dst[di] * (1 - alpha));
            dst[di + 1] = Math.round(sg * alpha + dst[di + 1] * (1 - alpha));
            dst[di + 2] = Math.round(sb * alpha + dst[di + 2] * (1 - alpha));
            dst[di + 3] = 255;
        }
    }
    return dst;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/genos-logo.png");

// Near full-bleed: the OS insets dock / home-screen icons itself, so
// margin added here shows up on top of theirs.
const SCALE_ANY = 0.99;
// The maskable safe zone is the centre 80%-diameter circle; anything
// outside it can be cropped by the launcher's mask.
const SCALE_MASKABLE = 0.8;
// Matches the manifest's `background_color`.
const BG = [255, 255, 255, 255];

const TARGETS = [
    { out: "public/apple-touch-icon.png", size: 180, scale: SCALE_ANY },
    { out: "public/icons/icon-192.png", size: 192, scale: SCALE_ANY },
    { out: "public/icons/icon-512.png", size: 512, scale: SCALE_ANY },
    { out: "public/icons/icon-192-maskable.png", size: 192, scale: SCALE_MASKABLE },
    { out: "public/icons/icon-512-maskable.png", size: 512, scale: SCALE_MASKABLE },
];

const src = decode(SOURCE);
if (src.w < 512 || src.h < 512) {
    console.warn(
        `[icons] source is ${src.w}x${src.h}; the 512px icons are upscaled and will look soft. ` +
            `Export the mark at 1024x1024 and re-run for a crisp result.`
    );
}
for (const { out, size, scale } of TARGETS) {
    encode(size, size, squareOnBackground(src, size, scale, BG), join(root, out));
    console.log(`[icons] ${out} ${size}x${size} scale=${scale}`);
}

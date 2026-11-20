/**
 * Generates the share card (`public/genos-share.png`, 1200x630) that link
 * previews and social cards show for every marketing page.
 *
 *   node scripts/generate-share-image.mjs      (or: npm run seo:share-image)
 *
 * The card is the brand lockup (`public/genos-logo-with-name.png`: the mark and
 * the word "Genos") centred on white, and nothing else: no tagline and no claim.
 * The headline wording is not decided yet, and an image cannot be corrected
 * after a platform has cached it, so the card says only who this is. Replace the
 * lockup file and re-run this when the brand changes; the output is committed.
 *
 * Same constraint as generate-app-icons.mjs: no sharp / ImageMagick on the build
 * machines, so the PNG is decoded and encoded by hand. The lockup is 621px wide
 * and is shown at 780px, so it is scaled UP with bilinear sampling (the icon
 * script's box average is for shrinking and would look blocky here).
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/genos-logo-with-name.png");
const OUT = join(root, "public/genos-share.png");
const W = 1200;
const H = 630;
const LOGO_WIDTH = 780;
const BG = [255, 255, 255];

const src = decode(SOURCE);
const dw = LOGO_WIDTH;
const dh = Math.round((src.h * dw) / src.w);
const ox = Math.round((W - dw) / 2);
const oy = Math.round((H - dh) / 2);

const dst = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
    dst[i * 4] = BG[0];
    dst[i * 4 + 1] = BG[1];
    dst[i * 4 + 2] = BG[2];
    dst[i * 4 + 3] = 255;
}

// Premultiplied bilinear sample of the source at (fx, fy) in source pixels.
const sample = (fx, fy) => {
    const x0 = Math.max(0, Math.min(src.w - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(src.h - 1, Math.floor(fy)));
    const x1 = Math.min(src.w - 1, x0 + 1);
    const y1 = Math.min(src.h - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, fx - x0));
    const ty = Math.max(0, Math.min(1, fy - y0));
    const out = [0, 0, 0, 0];
    for (const [x, y, w] of [
        [x0, y0, (1 - tx) * (1 - ty)],
        [x1, y0, tx * (1 - ty)],
        [x0, y1, (1 - tx) * ty],
        [x1, y1, tx * ty],
    ]) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3] / 255;
        out[0] += src.data[i] * a * w;
        out[1] += src.data[i + 1] * a * w;
        out[2] += src.data[i + 2] * a * w;
        out[3] += a * w;
    }
    return out;
};

for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
        const [pr, pg, pb, a] = sample(
            ((x + 0.5) * src.w) / dw - 0.5,
            ((y + 0.5) * src.h) / dh - 0.5
        );
        const di = ((y + oy) * W + (x + ox)) * 4;
        // premultiplied source over opaque background
        dst[di] = Math.round(pr + dst[di] * (1 - a));
        dst[di + 1] = Math.round(pg + dst[di + 1] * (1 - a));
        dst[di + 2] = Math.round(pb + dst[di + 2] * (1 - a));
    }
}

encode(W, H, dst, OUT);
console.log(`[share-image] public/genos-share.png ${W}x${H} (lockup ${dw}x${dh})`);

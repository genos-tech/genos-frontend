/**
 * Renders the push-notification icons for the connected-app marks.
 *
 *   node scripts/make-ai-app-push-icons.mjs
 *
 * Outputs (committed; this script makes them reproducible, not mysterious):
 *
 *   public/ai-apps/claude-192.png        192x192 full-colour round mark
 *   public/ai-apps/chatgpt-192.png       192x192 full-colour round mark
 *   public/ai-apps/claude-badge-96.png   96x96 white-on-transparent silhouette
 *   public/ai-apps/chatgpt-badge-96.png  96x96 white-on-transparent silhouette
 *
 * The api puts these URLs in the Web Push payload as `icon` / `badge` when a
 * change was made through a connected app (the service worker passes them to
 * `showNotification` untouched). An OS notification icon cannot be an SVG on
 * most platforms, hence the PNGs.
 *
 * Source of truth: `src/assets/ai-apps/{claude,chatgpt}.svg`. The Claude mark
 * is the Simple Icons drawing on Anthropic's orange plate; the ChatGPT mark is
 * a community trace of the OpenAI blossom, NOT the official file. If the
 * official SVGs replace those, re-run this script and commit the PNGs.
 *
 * Why the badge is a separate silhouette: Android draws `badge` in the status
 * bar as an alpha mask (every opaque pixel becomes the same tint), so a
 * coloured plate would show up as a solid disc. The badge is therefore the
 * bare glyph path in white, no plate.
 *
 * Renderer: headless Chrome/Chromium (no npm dependency; nothing here touches
 * the app bundle). Set CHROME_PATH to override the binary lookup.
 */
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "ai-apps");

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
];
const findChrome = () => {
    const found = CHROME_CANDIDATES.find((p) => p && existsSync(p));
    if (!found) throw new Error("Set CHROME_PATH to a Chrome/Chromium binary.");
    return found;
};

/** Glyph path data of a mark SVG: the one white `<path>` drawn over the plate. */
const glyphPathOf = (svg, name) => {
    const match = svg.match(/<path\b[^>]*\sd="([^"]+)"/);
    if (!match) throw new Error(`${name}: no <path d="..."> found`);
    return match[1];
};

// Silhouette: the 24-unit glyph scaled up so it fills the badge (a little
// margin, status bars clip hard at the edge), still centred.
const BADGE_SCALE = 0.86;

const apps = ["claude", "chatgpt"];
const chrome = findChrome();
const work = mkdtempSync(join(tmpdir(), "ai-app-icons-"));
mkdirSync(outDir, { recursive: true });

/** Screenshot `markup` at size x size with a transparent page background. */
const render = (markup, size, outFile) => {
    const html = join(work, `${size}-${Math.random().toString(36).slice(2)}.html`);
    writeFileSync(
        html,
        `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}` +
            `svg{display:block;width:${size}px;height:${size}px}</style>${markup}`
    );
    execFileSync(
        chrome,
        [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--default-background-color=00000000",
            `--window-size=${size},${size}`,
            `--screenshot=${outFile}`,
            `file://${html}`,
        ],
        { stdio: "ignore" }
    );
    return statSync(outFile).size;
};

try {
    for (const app of apps) {
        const svg = readFileSync(join(root, "src", "assets", "ai-apps", `${app}.svg`), "utf8");
        const full = join(outDir, `${app}-192.png`);
        const badge = join(outDir, `${app}-badge-96.png`);
        const fullSize = render(svg, 192, full);
        const glyph = glyphPathOf(svg, app);
        const badgeSvg =
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
            `<path fill="#fff" transform="translate(12 12) scale(${BADGE_SCALE}) translate(-12 -12)" d="${glyph}"/></svg>`;
        const badgeSize = render(badgeSvg, 96, badge);
        console.log(`${full} ${fullSize} B`);
        console.log(`${badge} ${badgeSize} B`);
    }
} finally {
    rmSync(work, { recursive: true, force: true });
}

/**
 * MIP-1196: on a phone, ONE element that overflows the page (a wide code block,
 * a table, a long URL) made the browser widen the layout viewport (390 -> 523
 * measured), and every fixed overlay (the connection banner, toasts, the FAB)
 * was centred on the wider box and ended up partly off the screen.
 * `minimum-scale=1` keeps the layout viewport at the device width (the page can
 * still be zoomed in); the page then scrolls sideways instead of rescaling.
 * jsdom has no layout, so this pins the contract at the source.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("phone viewport hardening", () => {
    it("index.html pins the layout viewport to the device width", () => {
        const html = readFileSync(resolve(root, "index.html"), "utf8");
        const meta = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html)?.[1] ?? "";
        expect(meta).toContain("width=device-width");
        expect(meta).toMatch(/minimum-scale=1(\.0)?\b/);
        // Zooming IN stays available (accessibility): no maximum-scale / user-scalable=no.
        expect(meta).not.toMatch(/maximum-scale|user-scalable/);
    });
});

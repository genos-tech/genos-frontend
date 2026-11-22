// @vitest-environment node
/**
 * MIP-1584: the "Delete permanently" dialog laid out in a REAL browser at desktop and phone width
 * (jsdom lays nothing out). It must sit inside the screen without sideways scroll, keep Confirm
 * disabled until the phrase is typed, keep both buttons reachable by a touch, and show the server's
 * refusal inside the dialog. Needs a Chrome (`CHROME_BIN` or the usual paths): skips locally
 * without one and fails in CI, like `DependenciesPhoneMIP1580`. `PROBE_OUT=/dir` keeps screenshots.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
    findChrome,
    launchChrome,
    startHarnessServer,
    type Browser,
    type Page,
} from "./browser/realBrowser";

const chrome = findChrome();
if (!chrome && process.env.CI) {
    throw new Error("ForceDeleteDialogMIP1584 needs a Chrome in CI (set CHROME_BIN).");
}

type Measured = {
    vw: number;
    scrollW: number;
    dialog: { x: number; right: number; top: number; bottom: number; w: number } | null;
    confirmDisabled: boolean;
    confirm: { reachable: boolean; centre: [number, number] };
    cancel: { reachable: boolean };
    text: string;
};

const MEASURE = `(() => {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const d = document.querySelector('[role="alertdialog"]');
    const r = d && d.getBoundingClientRect();
    const btn = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    const info = (b) => {
        const br = b.getBoundingClientRect();
        const cx = br.x + br.width / 2, cy = br.y + br.height / 2;
        const hit = document.elementFromPoint(Math.min(Math.max(cx, 0), vw - 1), Math.min(Math.max(cy, 0), vh - 1));
        return { reachable: !!hit && (hit === b || b.contains(hit)), centre: [cx, cy] };
    };
    const confirm = btn('Delete permanently'), cancel = btn('Cancel');
    return {
        vw, scrollW: document.documentElement.scrollWidth,
        dialog: r && { x: r.x, right: r.right, top: r.top, bottom: r.bottom, w: r.width },
        confirmDisabled: confirm.disabled || confirm.getAttribute('aria-disabled') === 'true',
        confirm: info(confirm), cancel: info(cancel),
        text: d.innerText,
    };
})()`;

describe.skipIf(!chrome)("Delete permanently dialog, laid out in a real browser", () => {
    let browser: Browser;
    let origin: string;
    let closeServer: () => Promise<void>;
    const out = process.env.PROBE_OUT;

    const load = async (opts: { width: number; touch: boolean; query?: string }) => {
        const page = await browser.open(
            `${origin}/src/__tests__/browser/forceDelete.html?${opts.query ?? ""}`,
            { width: opts.width, height: opts.width > 600 ? 900 : 844, touch: opts.touch }
        );
        for (let attempt = 1; ; attempt++) {
            try {
                await page.eval(`new Promise((resolve, reject) => {
                    const t0 = Date.now();
                    const tick = () => {
                        if (document.querySelector('[role="alertdialog"]')) resolve(true);
                        else if (Date.now() - t0 > 120000) reject(new Error('harness did not render'));
                        else setTimeout(tick, 100);
                    };
                    tick();
                })`);
                break;
            } catch (e) {
                if (attempt >= 4 || !/context|destroyed|navigat/i.test(String(e))) throw e;
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        await page.eval(
            "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))"
        );
        return page;
    };

    const save = async (name: string, page: Page, data?: unknown) => {
        if (!out) return;
        mkdirSync(out, { recursive: true });
        if (data) writeFileSync(join(out, `probe-${name}.json`), JSON.stringify(data, null, 1));
        writeFileSync(join(out, `${name}.png`), await page.screenshot());
    };

    const type = async (page: Page, text: string) => {
        await page.eval(`(() => {
            const input = document.querySelector('[role="alertdialog"] input');
            input.focus();
        })()`);
        await page.send("Input.insertText", { text });
        await new Promise((r) => setTimeout(r, 200));
    };

    beforeAll(async () => {
        const started = await startHarnessServer();
        origin = started.origin;
        closeServer = () => started.server.close();
        browser = await launchChrome(chrome!);
    }, 180_000);

    afterAll(async () => {
        const bounded = (p: Promise<unknown> | undefined) =>
            Promise.race([p, new Promise((r) => setTimeout(r, 20_000))]).catch(() => undefined);
        await bounded(browser?.close());
        await bounded(closeServer?.());
    }, 60_000);

    for (const [width, touch] of [
        [1440, false],
        [390, true],
    ] as const) {
        it(`at ${width}px: inside the screen, Confirm waits for the phrase, both buttons reachable`, async () => {
            const page = await load({ width, touch });
            const before = await page.eval<Measured>(MEASURE);
            await save(`force-delete-${width}`, page, before);
            expect(before.vw).toBe(width);
            expect(before.scrollW).toBe(width);
            expect(before.dialog).not.toBeNull();
            expect(before.dialog!.x).toBeGreaterThanOrEqual(0);
            expect(before.dialog!.right).toBeLessThanOrEqual(width);
            expect(before.dialog!.top).toBeGreaterThanOrEqual(0);
            expect(before.confirmDisabled).toBe(true);
            expect(before.cancel.reachable).toBe(true);
            expect(before.text).toMatch(/cannot be undone|This cannot be undone/i);

            await type(page, "DELETE");
            const after = await page.eval<Measured>(MEASURE);
            expect(after.confirmDisabled).toBe(false);
            // A disabled button takes no pointer, so reachability is asked once it is enabled.
            expect(after.confirm.reachable).toBe(true);
            const [cx, cy] = after.confirm.centre;
            if (touch) await page.tap(cx, cy);
            else {
                for (const type of ["mousePressed", "mouseReleased"])
                    await page.send("Input.dispatchMouseEvent", {
                        type,
                        x: cx,
                        y: cy,
                        button: "left",
                        clickCount: 1,
                    });
            }
            await new Promise((r) => setTimeout(r, 500));
            expect(await page.eval<number>("window.__deleted")).toBe(1);
            page.close();
        }, 180_000);
    }

    it("at 390px a refusal from the server is shown inside the dialog", async () => {
        const page = await load({ width: 390, touch: true, query: "fail=1&mode=dark" });
        await type(page, "DELETE");
        const m = await page.eval<Measured>(MEASURE);
        const [cx, cy] = m.confirm.centre;
        await page.tap(cx, cy);
        await new Promise((r) => setTimeout(r, 600));
        const shown = await page.eval<Measured>(MEASURE);
        await save("force-delete-390-refused-dark", page, shown);
        expect(shown.text).toMatch(/Only its creator or the project owner/);
        expect(shown.scrollW).toBe(390);
        page.close();
    }, 180_000);
});

// @vitest-environment node
/**
 * MIP-1580: THE GUARD for the Manage dependencies picker on a phone, in a REAL browser. Project
 * and Task sat side by side, and the Task field (its dropdown is as wide as its input) came out
 * 48px wide at 390px and 26px at 360px: it could be tapped, but its options were invisible. jsdom
 * lays nothing out and reads no `@media`, so a unit test cannot see that; this one loads the real
 * `ModalManageDependencies` (harness page, no backend) in headless Chrome with touch emulated,
 * opens the Task dropdown with a real touch, and asks `elementFromPoint` what a finger reaches.
 *
 * Needs a Chrome (`CHROME_BIN`, or the usual install paths). Without one it skips locally and FAILS
 * in CI, where a skipped guard would be the same as no guard.
 *
 * `PROBE_OUT=/some/dir` writes the measurements (probe-*.json) and screenshots there.
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
    throw new Error("DependenciesPhoneMIP1580 needs a Chrome in CI (set CHROME_BIN).");
}

type Opened = {
    vw: number;
    scrollW: number;
    field: { x: number; w: number; centreX: number; centreY: number };
    projectRight: number;
    listbox: { x: number; w: number; right: number; top: number; bottom: number } | null;
    /** Options fully inside the listbox's visible window. */
    options: { w: number; right: number; reachable: boolean; centre: [number, number] }[];
    titleLines: number[];
};

const FIELD = `(() => {
    const roots = [...document.querySelectorAll('.MuiAutocomplete-root')];
    const project = roots[0].getBoundingClientRect();
    const r = roots[1].getBoundingClientRect();
    return { x: r.x, w: r.width, centreX: r.x + r.width / 2, centreY: r.y + r.height / 2,
             projectRight: project.right };
})()`;

const OPENED = `(() => {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const lb = document.querySelector('[role="listbox"]');
    const lr = lb && lb.getBoundingClientRect();
    const options = [...document.querySelectorAll('[role="option"]')].filter((o) => {
        const r = o.getBoundingClientRect();
        return lr && r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1;
    }).map((o) => {
        const r = o.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const hit = document.elementFromPoint(Math.min(Math.max(cx, 0), vw - 1), Math.min(Math.max(cy, 0), vh - 1));
        return { w: r.width, right: r.right, reachable: !!hit && hit.closest('[role="option"]') === o, centre: [cx, cy] };
    });
    const roots = [...document.querySelectorAll('.MuiAutocomplete-root')];
    const f = roots[1].getBoundingClientRect();
    const p = roots[0].getBoundingClientRect();
    return {
        vw, scrollW: document.documentElement.scrollWidth,
        field: { x: f.x, w: f.width, centreX: f.x + f.width / 2, centreY: f.y + f.height / 2 },
        projectRight: p.right,
        listbox: lr && { x: lr.x, w: lr.width, right: lr.right, top: lr.top, bottom: lr.bottom },
        options,
        titleLines: [...document.querySelectorAll('[role="option"] [data-testid="task-title"]')]
            .map((t) => Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight))),
    };
})()`;

describe.skipIf(!chrome)("manage dependencies picker, laid out in a real browser", () => {
    let browser: Browser;
    let origin: string;
    let closeServer: () => Promise<void>;
    const out = process.env.PROBE_OUT;

    const load = async (opts: { mode: "light" | "dark"; width: number; touch: boolean }) => {
        const page = await browser.open(
            `${origin}/src/__tests__/browser/dependenciesPhone.html?mode=${opts.mode}`,
            { width: opts.width, height: opts.width > 600 ? 800 : 844, touch: opts.touch }
        );
        // Vite's dependency optimizer can reload a cold page once: retry when the context goes.
        for (let attempt = 1; ; attempt++) {
            try {
                await page.eval(`new Promise((resolve, reject) => {
                    const t0 = Date.now();
                    const tick = () => {
                        if (document.querySelectorAll('.MuiAutocomplete-root').length >= 2) resolve(true);
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

    /** Tap (or click) the middle of the Task field, then measure what opened. */
    const openTask = async (page: Page, touch: boolean) => {
        const f = await page.eval<{ centreX: number; centreY: number }>(FIELD);
        if (touch) await page.tap(f.centreX, f.centreY);
        else {
            await page.send("Input.dispatchMouseEvent", {
                type: "mousePressed",
                x: f.centreX,
                y: f.centreY,
                button: "left",
                clickCount: 1,
            });
            await page.send("Input.dispatchMouseEvent", {
                type: "mouseReleased",
                x: f.centreX,
                y: f.centreY,
                button: "left",
                clickCount: 1,
            });
        }
        await new Promise((r) => setTimeout(r, 500));
        return page.eval<Opened>(OPENED);
    };

    const save = async (name: string, page: Page, data?: unknown) => {
        if (!out) return;
        mkdirSync(out, { recursive: true });
        if (data) writeFileSync(join(out, `probe-${name}.json`), JSON.stringify(data, null, 1));
        writeFileSync(join(out, `${name}.png`), await page.screenshot());
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

    for (const width of [390, 360]) {
        for (const mode of ["light", "dark"] as const) {
            it(`at ${width}px with touch (${mode}): the Task options are visible, inside the screen, and tappable`, async () => {
                const page = await load({ mode, width, touch: true });
                const r = await openTask(page, true);
                await save(`phone-${width}-${mode}`, page, r);

                expect(r.vw).toBe(width);
                // No sideways scroll, and the field is a real target, not a sliver.
                expect(r.scrollW).toBe(width);
                expect(r.field.w).toBeGreaterThan(200);
                // The fields stack: Task starts below Project, not to its right.
                expect(r.field.x).toBeLessThan(r.projectRight);

                expect(r.listbox, "the dropdown opened").not.toBeNull();
                expect(r.listbox!.x).toBeGreaterThanOrEqual(0);
                expect(r.listbox!.right).toBeLessThanOrEqual(width);
                expect(r.listbox!.w).toBeGreaterThan(200);
                expect(r.options.length).toBeGreaterThanOrEqual(3);
                for (const o of r.options) {
                    expect(o.right).toBeLessThanOrEqual(width);
                    expect(o.w).toBeGreaterThan(200);
                    expect(o.reachable, "a finger on the option reaches it").toBe(true);
                }
                // A long title wraps (up to two lines) instead of being cut to a few letters.
                expect(Math.max(...r.titleLines)).toBeGreaterThanOrEqual(2);

                // A real tap on the first option adds that dependency.
                const first = r.options[0].centre;
                await page.tap(first[0], first[1]);
                await new Promise((res) => setTimeout(res, 400));
                expect(await page.eval<string[]>("window.__added")).toEqual(["1>100"]);
                page.close();
            }, 180_000);
        }
    }

    it("at 1280px (desktop): Project and Task stay side by side", async () => {
        const page = await load({ mode: "light", width: 1280, touch: false });
        const r = await openTask(page, false);
        await save("desktop-1280", page, r);
        page.close();
        // Task is to the right of Project, in one row, with room for its titles.
        expect(r.field.x).toBeGreaterThanOrEqual(r.projectRight);
        expect(r.field.w).toBeGreaterThan(300);
        expect(r.options.length).toBeGreaterThanOrEqual(3);
        for (const o of r.options) expect(o.reachable).toBe(true);
        // One line per title, as before.
        expect(Math.max(...r.titleLines)).toBe(1);
    }, 180_000);
});

// @vitest-environment node
/**
 * MIP-2599: no Settings panel scrolls sideways. The global `input[type="checkbox"] { scale(1.4) }`
 * also scaled the invisible input of a labelled Joy checkbox, which spans the whole row, and the
 * "From / To" times did not fit a phone. Laid out in a REAL browser (jsdom lays nothing out). Needs
 * a Chrome (`CHROME_BIN` or the usual paths): skips locally without one and fails in CI, like
 * `ForceDeleteDialogMIP1584`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findChrome, launchChrome, startHarnessServer, type Browser } from "./browser/realBrowser";

const chrome = findChrome();
if (!chrome && process.env.CI) {
    throw new Error("SettingsSidewaysScrollMIP2599 needs a Chrome in CI (set CHROME_BIN).");
}

type Measured = {
    panels: { id: string; over: number; pastEdge: number }[];
    checkboxes: number;
    bareTransform: string;
};

const MEASURE = `(() => {
    const panels = [...document.querySelectorAll('[data-panel]')].map((p) => {
        const right = p.getBoundingClientRect().right;
        const past = [...p.querySelectorAll('*')].map((e) => e.getBoundingClientRect())
            .filter((r) => r.width > 0).map((r) => r.right - right);
        return { id: p.dataset.panel, over: p.scrollWidth - p.clientWidth, pastEdge: Math.max(0, ...past) };
    });
    return {
        panels,
        checkboxes: document.querySelectorAll('[data-panel="chat"] input[type="checkbox"]').length,
        bareTransform: getComputedStyle(document.querySelector('[data-testid="bare"] input')).transform,
    };
})()`;

describe.skipIf(!chrome)("Settings panels, laid out in a real browser", () => {
    let browser: Browser;
    let origin: string;
    let closeServer: () => Promise<void>;

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
        it(`at ${width}px: nothing is wider than its panel`, async () => {
            const page = await browser.open(
                `${origin}/src/__tests__/browser/settingsOverflow.html`,
                { width, height: 900, touch }
            );
            for (let attempt = 1; ; attempt++) {
                try {
                    await page.eval(`new Promise((resolve, reject) => {
                        const t0 = Date.now();
                        const tick = () => {
                            if (document.querySelector('[data-testid="pause-schedule-times"]')) resolve(true);
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
            const m = await page.eval<Measured>(MEASURE);
            expect(m.checkboxes).toBeGreaterThan(0);
            for (const panel of m.panels) {
                expect(panel, panel.id).toMatchObject({ over: 0 });
                expect(panel.pastEdge, panel.id).toBeLessThanOrEqual(0.5);
            }
            // A checkbox with no label keeps the larger click area the global rule gives it.
            expect(m.bareTransform).toBe("matrix(1.4, 0, 0, 1.4, 0, 0)");
        }, 180_000);
    }
});

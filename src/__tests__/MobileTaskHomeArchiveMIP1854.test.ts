// @vitest-environment node
/**
 * MIP-1854: the phone task home for an archived project, laid out in a REAL browser. jsdom lays
 * nothing out, so this loads the real `MobileTaskHome` (harness page, no backend) in headless
 * Chrome at 390px, touch emulated, in English and Japanese, light and dark, and checks what a
 * person sees: the archive banner, the owner's Archive/Unarchive menu item, no Create button, the
 * read-only list, and no horizontal scroll.
 *
 * Needs a Chrome (`CHROME_BIN`, or the usual install paths). Without one it skips locally and FAILS
 * in CI, where a skipped guard would be the same as no guard.
 *
 * `PROBE_OUT=/some/dir` writes the screenshots there.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findChrome, launchChrome, startHarnessServer, type Browser } from "./browser/realBrowser";

const chrome = findChrome();
if (!chrome && process.env.CI) {
    throw new Error("MobileTaskHomeArchiveMIP1854 needs a Chrome in CI (set CHROME_BIN).");
}

type Measure = {
    banner: string | null;
    bannerButtons: string[];
    createPresent: boolean;
    listInert: boolean;
    menuItems: string[];
    scrollWidth: number;
    innerWidth: number;
    bannerTop: number | null;
    headerBottom: number | null;
};

const MEASURE = `(() => {
    const banner = document.querySelector('[role="status"]');
    const header = document.querySelector('[data-testid="ArrowBackIosNewRoundedIcon"]')?.closest('.MuiStack-root');
    const listBox = [...document.querySelectorAll('[inert]')].find((el) => el.textContent?.includes('Draft the launch checklist'));
    return {
        banner: banner ? banner.textContent : null,
        bannerButtons: banner ? [...banner.querySelectorAll('button')].map((b) => b.textContent) : [],
        createPresent: !!document.querySelector('[data-testid="AddIcon"]'),
        listInert: !!listBox,
        menuItems: [...document.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        bannerTop: banner ? Math.round(banner.getBoundingClientRect().top) : null,
        headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : null,
    };
})()`;

const OPEN_MENU = `new Promise((resolve) => {
    const more = document.querySelector('[data-testid="MoreVertRoundedIcon"]')?.closest('button');
    more?.click();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(!!more)));
})`;

const SETTLE = "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))";

/** The Joy menu fades in over ~200 ms; wait it out before reading or capturing it. */
const MENU_SETTLE = "new Promise((r) => setTimeout(r, 400))";

const OUT = process.env.PROBE_OUT ?? join(tmpdir(), "mip1854-probe");

describe.skipIf(!chrome)(
    "the phone task home for an archived project, laid out in a real browser",
    () => {
        let browser: Browser;
        let origin: string;
        let closeServer: () => Promise<void>;

        beforeAll(async () => {
            const started = await startHarnessServer();
            origin = started.origin;
            closeServer = () => started.server.close();
            browser = await launchChrome(chrome!);
            mkdirSync(OUT, { recursive: true });
        }, 180000);

        afterAll(async () => {
            await browser?.close();
            await closeServer?.();
        }, 60000);

        const load = async (query: string) => {
            const page = await browser.open(
                `${origin}/src/__tests__/browser/mobileTaskHomeArchive.html${query}`,
                { width: 390, height: 844, touch: true }
            );
            for (let attempt = 1; ; attempt++) {
                try {
                    await page.eval(`new Promise((resolve, reject) => {
                    const t0 = Date.now();
                    const tick = () => {
                        if (document.querySelector('[data-testid="ArrowBackIosNewRoundedIcon"]') && document.body.textContent.includes('Draft the launch checklist')) resolve(true);
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
            await page.eval(SETTLE);
            return page;
        };

        const cases = [
            { lang: "en", mode: "light" },
            { lang: "en", mode: "dark" },
            { lang: "ja", mode: "light" },
            { lang: "ja", mode: "dark" },
        ] as const;

        for (const c of cases) {
            const tag = `${c.lang}-${c.mode}`;

            it(`archived, owner, ${tag}: banner with Unarchive, no Create, read-only list, Unarchive in the menu`, async () => {
                const page = await load(`?lang=${c.lang}&mode=${c.mode}&archived=1&owner=1`);
                const m = (await page.eval<Measure>(MEASURE)) as Measure;
                await page.eval(SETTLE);
                await page.eval(OPEN_MENU);
                await page.eval(MENU_SETTLE);
                const withMenu = (await page.eval<Measure>(MEASURE)) as Measure;
                writeFileSync(join(OUT, `archived-owner-${tag}.png`), await page.screenshot());
                writeFileSync(
                    join(OUT, `archived-owner-${tag}.json`),
                    JSON.stringify({ m, withMenu }, null, 2)
                );
                page.close();

                expect(m.banner).toBeTruthy();
                expect(m.bannerButtons.length).toBe(1);
                expect(m.createPresent).toBe(false);
                expect(m.listInert).toBe(false);
                expect(m.scrollWidth).toBeLessThanOrEqual(m.innerWidth);
                expect(m.bannerTop).toBeGreaterThanOrEqual(m.headerBottom ?? 0);
                expect(withMenu.menuItems.some((i) => i?.length)).toBe(true);
                expect(
                    withMenu.menuItems.filter((i) => i && /archive|アーカイブ/i.test(i)).length
                ).toBe(1);
            }, 180000);

            it(`archived, not the owner, ${tag}: banner has no button and the menu has no archive item`, async () => {
                const page = await load(`?lang=${c.lang}&mode=${c.mode}&archived=1&owner=0`);
                const m = (await page.eval<Measure>(MEASURE)) as Measure;
                await page.eval(OPEN_MENU);
                await page.eval(MENU_SETTLE);
                const withMenu = (await page.eval<Measure>(MEASURE)) as Measure;
                writeFileSync(join(OUT, `archived-member-${tag}.png`), await page.screenshot());
                page.close();

                expect(m.banner).toBeTruthy();
                expect(m.bannerButtons.length).toBe(0);
                expect(m.createPresent).toBe(false);
                expect(m.listInert).toBe(false);
                expect(
                    withMenu.menuItems.filter((i) => i && /archive|アーカイブ/i.test(i)).length
                ).toBe(0);
            }, 180000);

            it(`live, owner, ${tag}: no banner, Create present, list is live, Archive in the menu`, async () => {
                const page = await load(`?lang=${c.lang}&mode=${c.mode}&archived=0&owner=1`);
                const m = (await page.eval<Measure>(MEASURE)) as Measure;
                await page.eval(OPEN_MENU);
                await page.eval(MENU_SETTLE);
                const withMenu = (await page.eval<Measure>(MEASURE)) as Measure;
                writeFileSync(join(OUT, `live-owner-${tag}.png`), await page.screenshot());
                page.close();

                expect(m.banner).toBeNull();
                expect(m.createPresent).toBe(true);
                expect(m.listInert).toBe(false);
                expect(m.scrollWidth).toBeLessThanOrEqual(m.innerWidth);
                expect(
                    withMenu.menuItems.filter((i) => i && /archive|アーカイブ/i.test(i)).length
                ).toBe(1);
            }, 180000);
        }
    }
);

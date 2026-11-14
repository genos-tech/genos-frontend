// @vitest-environment node
/**
 * MIP-1515: THE GUARD for the chat list row's 44px touch targets (pin, "...", avatar) and the
 * search box's "Open" arrow, in a REAL browser. MIP-1455 (#948) made them 44px with a hit-area
 * helper whose anchor (`position: relative`) `NavItem` overrides (`position: static` on its row
 * actions), so on a phone a tap anywhere on a chat row hit "..." and no chat could be opened (#952
 * reverted it). jsdom lays nothing out and reads no `@media`, so a unit test could not see that;
 * this one loads the real `ChatListItem` and `ChatSearch` (harness page, no backend) in headless
 * Chrome at 390px with touch emulated, and asks `elementFromPoint` and real touch taps what a
 * finger reaches.
 *
 * Needs a Chrome (`CHROME_BIN`, or the usual install paths). Without one it skips locally and FAILS
 * in CI, where a skipped guard would be the same as no guard.
 *
 * `PROBE_OUT=/some/dir` writes the measurements (probe-*.json) and screenshots there.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PROBE } from "./browser/chatListTouchProbe";
import {
    findChrome,
    launchChrome,
    startHarnessServer,
    type Browser,
    type Page,
} from "./browser/realBrowser";

const chrome = findChrome();
if (!chrome && process.env.CI) {
    throw new Error("TouchTargetsChatListMIP1515 needs a Chrome in CI (set CHROME_BIN).");
}

type Box = { x: number; y: number; w: number; h: number };
type Control = {
    rect: Box;
    hit: Box | null;
    centre: string;
    centreOwned: boolean;
    missAbove: boolean;
    missRight: boolean;
    pseudo: string;
    contain: string;
};
type Row = {
    row: Box;
    rowCentre: string;
    rowGeoCentre: string;
    rowCentreXY: [number, number];
    stray: number;
    counts: Record<string, number>;
    pin: Control;
    more: Control;
    avatar: Control;
};
type Result = {
    pointerCoarse: boolean;
    hoverNone: boolean;
    scrollW: number;
    rows: Row[];
    search: Control;
};

const waitForRows = (page: Page) =>
    page.eval(`new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
            if (document.querySelectorAll('[data-testid="chat-list"] .NavItem-actions').length === 4
                && document.querySelector('.MuiAutocomplete-popupIndicator')) resolve(true);
            else if (Date.now() - t0 > 60000) reject(new Error('harness did not render'));
            else setTimeout(tick, 100);
        };
        tick();
    })`);

const FINGER = 44;
// The probe reads a 1px grid, so a box can come out one pixel larger than the layout.
const SLACK = 2;
const near = (v: number, want: number) => Math.abs(v - want) <= SLACK;
const inside = (inner: Box, outer: Box) =>
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.w <= outer.x + outer.w + 1 &&
    inner.y + inner.h <= outer.y + outer.h + 1;
const overlap = (a: Box, b: Box) =>
    a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;

describe.skipIf(!chrome)("chat list touch targets, laid out in a real browser", () => {
    let browser: Browser;
    let origin: string;
    let closeServer: () => Promise<void>;
    const out = process.env.PROBE_OUT;

    const url = (mode: "light" | "dark") =>
        `${origin}/src/__tests__/browser/chatListTouch.html?mode=${mode}`;

    /** Open the harness and wait for the rows and the search arrow to be on screen. */
    const load = async (opts: { mode: "light" | "dark"; width: number; touch: boolean }) => {
        const page = await browser.open(url(opts.mode), {
            width: opts.width,
            height: 844,
            touch: opts.touch,
        });
        // Vite's dependency optimizer can reload a cold page once: retry when the context goes.
        for (let attempt = 1; ; attempt++) {
            try {
                await waitForRows(page);
                break;
            } catch (e) {
                if (attempt >= 4 || !/context|destroyed|navigat/i.test(String(e))) throw e;
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        // Fonts and the avatars' first paint move nothing, but let the layout settle.
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

    beforeAll(async () => {
        const started = await startHarnessServer();
        origin = started.origin;
        closeServer = () => started.server.close();
        browser = await launchChrome(chrome!);
    }, 180_000);

    // Closing Chrome and the dev server is clean-up, not the thing under test: a CI runner can
    // take longer than the default 10s hook timeout, and a stuck close must not fail the file.
    afterAll(async () => {
        const bounded = (p: Promise<unknown> | undefined) =>
            Promise.race([p, new Promise((r) => setTimeout(r, 20_000))]).catch(() => undefined);
        await bounded(browser?.close());
        await bounded(closeServer?.());
    }, 60_000);

    for (const mode of ["light", "dark"] as const) {
        it(`at 390px with touch (${mode}): a tap reaches the row, and each control is its own 44px target`, async () => {
            const page = await load({ mode, width: 390, touch: true });
            const r = await page.eval<Result>(PROBE);
            await save(`touch-${mode}`, page, r);
            page.close();

            // The emulation really is a phone: otherwise every number below means nothing.
            expect(r.pointerCoarse).toBe(true);
            expect(r.hoverNone).toBe(true);
            expect(r.scrollW).toBe(390);
            expect(r.rows).toHaveLength(4);

            for (const row of r.rows) {
                // THE MIP-1455 BUG: the middle of the row must open the chat, and nothing
                // on the left 60% of the row may be an action button.
                expect(row.rowGeoCentre, "geometric centre of the row").toBe("row");
                expect(row.rowCentre).toBe("row");
                expect(row.stray).toBe(0);

                // Pin and "...": exactly as wide as the button, 44 tall. The avatar: 44 x 44.
                for (const key of ["pin", "more"] as const) {
                    const c = row[key];
                    expect(c.centreOwned, `${key} centre`).toBe(true);
                    expect(c.hit, `${key} hit`).not.toBeNull();
                    expect(near(c.hit!.w, c.rect.w), `${key} width ${c.hit!.w}`).toBe(true);
                    expect(near(c.hit!.h, FINGER), `${key} height ${c.hit!.h}`).toBe(true);
                    expect(c.missAbove, `${key} 20px above its region`).toBe(false);
                    expect(inside(c.hit!, row.row), `${key} stays in the row`).toBe(true);
                }
                expect(row.avatar.centreOwned, "avatar centre").toBe(true);
                expect(near(row.avatar.hit!.w, FINGER), `avatar width ${row.avatar.hit!.w}`).toBe(
                    true
                );
                expect(near(row.avatar.hit!.h, FINGER), `avatar height ${row.avatar.hit!.h}`).toBe(
                    true
                );
                expect(row.avatar.missAbove, "avatar 20px above its region").toBe(false);
                expect(row.avatar.missRight, "avatar 20px right of its region").toBe(false);
                expect(inside(row.avatar.hit!, row.row), "avatar stays in the row").toBe(true);

                // The three targets never cover each other.
                expect(overlap(row.pin.hit!, row.more.hit!), "pin / more").toBe(false);
                expect(overlap(row.avatar.hit!, row.pin.hit!), "avatar / pin").toBe(false);
                expect(overlap(row.avatar.hit!, row.more.hit!), "avatar / more").toBe(false);
            }

            // The search box's "Open" arrow: 24px, grown to a 44px target.
            expect(r.search.centreOwned, "open arrow centre").toBe(true);
            expect(near(r.search.hit!.w, FINGER), `arrow width ${r.search.hit!.w}`).toBe(true);
            expect(near(r.search.hit!.h, FINGER), `arrow height ${r.search.hit!.h}`).toBe(true);
            expect(r.search.missAbove, "arrow 20px above its region").toBe(false);
        }, 180_000);
    }

    it("real touch taps: the row opens, the controls take their own taps, outside the region is the row", async () => {
        const probe = async () => {
            const page = await load({ mode: "light", width: 390, touch: true });
            const r = await page.eval<Result>(PROBE);
            return { page, r };
        };
        const tapTarget = async (x: number, y: number) => {
            const { page } = await probe();
            await page.tap(x, y);
            await new Promise((res) => setTimeout(res, 300));
            const taps = await page.eval<string[]>("window.__taps");
            page.close();
            return taps;
        };
        const { page: first, r } = await probe();
        first.close();
        const row = r.rows[0];
        const mid = (b: Box) => [b.x + b.w / 2, b.y + b.h / 2] as const;
        const taps: Record<string, string[]> = {
            "row centre": await tapTarget(...row.rowCentreXY),
            "pin centre": await tapTarget(...mid(row.pin.rect)),
            // 4px ABOVE the 32px pin: only the 44px region reaches it.
            "pin, 4px above its box": await tapTarget(mid(row.pin.rect)[0], row.pin.rect.y - 4),
            "... centre": await tapTarget(...mid(row.more.rect)),
            "... 4px below its box": await tapTarget(
                mid(row.more.rect)[0],
                row.more.rect.y + row.more.rect.h + 4
            ),
            "avatar centre": await tapTarget(...mid(row.avatar.rect)),
            "avatar, 4px left of its box": await tapTarget(
                row.avatar.rect.x - 4,
                mid(row.avatar.rect)[1]
            ),
            // 20px left of the pin's region: not a button.
            "20px left of the pin region": await tapTarget(
                row.pin.hit!.x - 20,
                mid(row.pin.rect)[1]
            ),
        };
        if (out) {
            mkdirSync(out, { recursive: true });
            writeFileSync(join(out, "probe-taps.json"), JSON.stringify(taps, null, 1));
        }
        expect(taps["row centre"]).toEqual(["row"]);
        expect(taps["pin centre"]).toEqual(["action:Pin Chat"]);
        expect(taps["pin, 4px above its box"]).toEqual(["action:Pin Chat"]);
        expect(taps["... centre"]).toEqual(["action:More options"]);
        expect(taps["... 4px below its box"]).toEqual(["action:More options"]);
        expect(taps["avatar centre"]).toEqual(["avatar"]);
        expect(taps["avatar, 4px left of its box"]).toEqual(["avatar"]);
        expect(taps["20px left of the pin region"]).toEqual(["row"]);
    }, 240_000);

    it("what a tap OPENS is not squeezed by the containment: the '...' menu and the avatar's profile", async () => {
        const { page: probePage, r } = await (async () => {
            const page = await load({ mode: "light", width: 390, touch: true });
            return { page, r: await page.eval<Result>(PROBE) };
        })();
        probePage.close();
        const row = r.rows[0];
        const overlay = `(() => {
            const el = document.querySelector('[role="menu"], [role="dialog"]');
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { role: el.getAttribute('role'), x: b.left, y: b.top, w: b.width, h: b.height,
                     vw: innerWidth, vh: innerHeight };
        })()`;
        type Overlay = {
            role: string;
            x: number;
            y: number;
            w: number;
            h: number;
            vw: number;
            vh: number;
        };
        const opened = async (x: number, y: number) => {
            const page = await load({ mode: "light", width: 390, touch: true });
            await page.tap(x, y);
            await new Promise((res) => setTimeout(res, 800));
            const o = await page.eval<Overlay | null>(overlay);
            await save(`opened-${Math.round(x)}-${Math.round(y)}`, page, o);
            page.close();
            return o;
        };
        const menu = await opened(
            row.more.rect.x + row.more.rect.w / 2,
            row.more.rect.y + row.more.rect.h / 2
        );
        expect(menu, "the '...' menu opened").not.toBeNull();
        expect(menu!.role).toBe("menu");
        // A menu that is the size of the control (or off screen) would mean it was positioned
        // against the contained button instead of the viewport.
        expect(menu!.w).toBeGreaterThan(100);
        expect(menu!.x).toBeGreaterThanOrEqual(0);
        expect(menu!.x + menu!.w).toBeLessThanOrEqual(menu!.vw + 1);
        expect(menu!.y).toBeGreaterThanOrEqual(0);
        expect(menu!.y + menu!.h).toBeLessThanOrEqual(menu!.vh + 1);

        const profile = await opened(
            row.avatar.rect.x + row.avatar.rect.w / 2,
            row.avatar.rect.y + row.avatar.rect.h / 2
        );
        // The profile dialog is a modal portalled to `body`: a `position: fixed` descendant of a
        // contained control would be laid out against the control, so it would be tiny or off screen.
        expect(profile, "the avatar's profile dialog opened").not.toBeNull();
        expect(profile!.role).toBe("dialog");
        expect(profile!.w).toBeGreaterThan(200);
        expect(profile!.x).toBeGreaterThanOrEqual(0);
        expect(profile!.x + profile!.w).toBeLessThanOrEqual(profile!.vw + 1);
        expect(profile!.y).toBeGreaterThanOrEqual(0);
        expect(profile!.y + profile!.h).toBeLessThanOrEqual(profile!.vh + 1);
    }, 240_000);

    it("with a mouse (1440px, no touch) nothing changes: no hit-area pseudo-element, no containment", async () => {
        const page = await load({ mode: "light", width: 1440, touch: false });
        const r = await page.eval<Result>(PROBE);
        await save("desktop", page, r);
        page.close();
        expect(r.pointerCoarse).toBe(false);
        for (const row of r.rows) {
            expect(row.rowCentre).toBe("row");
            for (const c of [row.pin, row.more, row.avatar]) {
                expect(c.pseudo).toBe("none");
                expect(c.contain).toBe("none");
            }
        }
        // A pinned chat keeps its pin showing: its box is the button's 32 x 32.
        const pinned = r.rows[1].pin;
        expect(near(pinned.hit!.w, 32) && near(pinned.hit!.h, 32)).toBe(true);
    }, 180_000);
});

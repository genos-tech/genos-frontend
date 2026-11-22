/**
 * Real-browser layout check of the signed-in app at phone widths (MIP-1876).
 *
 * For each main screen (home, chats, tasks, notes, inbox, plans) at each width it checks:
 *   1. no horizontal page scroll (documentElement.scrollWidth <= viewport width);
 *   2. no visible control is clipped by the right edge of the window, unless it sits in
 *      its own horizontally scrollable container (which keeps it reachable).
 * A screen that shows no interactive control at all fails too: a blank screen passes (1).
 *
 * MANUAL, not in CI: it needs a signed-in session on a stack with the demo workspace
 * (CI has no backend). jsdom lays nothing out, so a vitest test cannot do this.
 *
 *   npm i --no-save puppeteer-core            # uses the system Chrome, no download
 *   (cd ../genos-platform/docker && docker compose up -d)   # api 8890, sockets 8889
 *   npx vite --port 3100 --host 127.0.0.1     # with the VITE_* variables of the compose frontend
 *   docker exec genos-api python manage.py create_reviewer_account --email you@example.test --apply --yes
 *   LAYOUT_EMAIL=you@example.test LAYOUT_PASSWORD=... node scripts/layout-check.mjs
 *
 * Optional: LAYOUT_BASE (default http://127.0.0.1:3100), LAYOUT_CHROME (default /usr/bin/google-chrome),
 * LAYOUT_TEAM (default "Genos Review"), LAYOUT_WIDTHS (default "320,390"), LAYOUT_SHOTS=<dir> to save a screenshot per screen and width.
 * Exit code 1 when any check fails. Run it on a LOCAL stack, never on production.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.LAYOUT_BASE ?? "http://127.0.0.1:3100";
const EMAIL = process.env.LAYOUT_EMAIL;
const PASSWORD = process.env.LAYOUT_PASSWORD;
const TEAM = process.env.LAYOUT_TEAM ?? "Genos Review";
const SHOTS = process.env.LAYOUT_SHOTS;
const WIDTHS = (process.env.LAYOUT_WIDTHS ?? "320,390").split(",").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!EMAIL || !PASSWORD) {
    console.error("Set LAYOUT_EMAIL and LAYOUT_PASSWORD (a local demo/reviewer account).");
    process.exit(2);
}

/** [name, how to reach it]: a nav button by accessible-name prefix, or a route. */
const SCREENS = [
    ["home", { url: "/workspace/genos" }],
    ["chats", { nav: "Chats" }],
    ["tasks", { nav: "Tasks" }],
    ["notes", { nav: "Notes" }],
    ["inbox", { nav: "Inbox" }],
    ["plans", { url: "/workspace/plans" }],
];

/** Runs in the page: overflow + clipped controls. */
const measure = () => {
    const vw = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    // A control inside an ancestor that scrolls horizontally stays reachable by scrolling it.
    const inOwnScroller = (el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if ((ox === "auto" || ox === "scroll") && a.scrollWidth > a.clientWidth) return true;
        }
        return false;
    };
    const controls = [
        ...document.querySelectorAll(
            'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [tabindex="0"]'
        ),
    ].filter(visible);
    const clipped = controls
        .filter((el) => el.getBoundingClientRect().right > vw + 1 && !inOwnScroller(el))
        .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" right=${Math.round(r.right)}`;
        });
    return { vw, scrollWidth, controls: controls.length, clipped };
};

const browser = await puppeteer.launch({
    executablePath: process.env.LAYOUT_CHROME ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
});
let failures = 0;
const report = (line) => console.log(line);
try {
    for (const width of WIDTHS) {
        const context = await browser.createBrowserContext(); // fresh storage: no session carried over
        const page = await context.newPage();
        await page.setViewport({
            width,
            height: 800,
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 1,
        });
        await page.goto(`${BASE}/signin`, { waitUntil: "networkidle2" });
        await page.type('input[name="email"]', EMAIL);
        await page.type('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () =>
                location.pathname.startsWith("/jointeam") ||
                location.pathname.startsWith("/workspace"),
            {
                timeout: 30000,
            }
        );
        if (page.url().includes("/jointeam")) {
            await page.waitForFunction(
                (t) =>
                    [...document.querySelectorAll("*")].some(
                        (e) => e.children.length === 0 && e.textContent.trim() === t
                    ),
                { timeout: 30000 },
                TEAM
            );
            await page.evaluate((t) => {
                [...document.querySelectorAll("*")]
                    .find((e) => e.children.length === 0 && e.textContent.trim() === t)
                    .click();
            }, TEAM);
        }
        await page.waitForFunction(() => location.pathname.startsWith("/workspace"), {
            timeout: 30000,
        });
        await sleep(5000);
        for (const [name, how] of SCREENS) {
            if (how.url) {
                // In-app navigation: a full page load drops the in-memory session.
                await page.evaluate((u) => {
                    history.pushState({}, "", u);
                    window.dispatchEvent(new PopStateEvent("popstate"));
                }, how.url);
            } else {
                await page.evaluate((label) => {
                    const el = [...document.querySelectorAll("button, a")].find((e) =>
                        (e.getAttribute("aria-label") || e.textContent || "")
                            .trim()
                            .startsWith(label)
                    );
                    if (!el) throw new Error(`nav "${label}" not found`);
                    el.click();
                }, how.nav);
            }
            await sleep(3500);
            const m = await page.evaluate(measure);
            const problems = [];
            if (m.scrollWidth > m.vw)
                problems.push(`page scrolls sideways (${m.scrollWidth} > ${m.vw})`);
            if (m.clipped.length) problems.push(`clipped: ${m.clipped.slice(0, 5).join("; ")}`);
            if (m.controls === 0) problems.push("no control rendered");
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
            if (problems.length) failures++;
            report(
                `${problems.length ? "FAIL" : "ok  "} ${String(width).padStart(3)} px ${name.padEnd(6)} controls=${m.controls} ${problems.join(" | ")}`
            );
        }
        await context.close();
    }
} finally {
    await browser.close();
}
process.exit(failures ? 1 : 0);

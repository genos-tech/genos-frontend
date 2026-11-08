#!/usr/bin/env node
/**
 * Retake the product screenshots the marketing pages use (MIP-1232).
 *
 *   node scripts/lp-screenshots.mjs [--base http://localhost:3000] [--lang ja,en] [--only tasks,note]
 *
 * It signs into a FRESH demo workspace through the app's own "Try the demo" button
 * (the api seeds an isolated, throwaway team: see genos-api `demo_seeder` /
 * `demo_v2`), stages each scene, and writes `public/lp/shots/<lang>/<name>.webp`
 * (1x) and `<name>@2x.webp`. Real or test accounts are never used, so no real
 * names, emails or messages can end up on the public site.
 *
 * Needs a running stack whose api seeds the demo (local only: it POSTs a demo
 * sign-in, which writes rows; never aim it at production), plus:
 *   npm i --no-save playwright-core      (not a project dependency)
 *   CHROME_PATH=/path/to/chrome-or-chromium  (or a Playwright browser cache)
 *   cwebp on PATH                         (brew install webp)
 * The Spotlight scenes (`ask`, `approval`) make one live AI call each on the
 * local api (a few cents); `--only` skips them.
 *
 * What each picture shows (and its size) is `src/lp/kit/shots.json`, shared with the pages.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("base", "http://localhost:3000");
const LANGS = opt("lang", "ja,en").split(",");
const ONLY = opt("only", "") ? new Set(opt("only", "").split(",")) : null;
const OUT = new URL("../public/lp/shots/", import.meta.url).pathname;

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const findChrome = () => {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const cache = join(homedir(), "Library/Caches/ms-playwright");
    if (existsSync(cache)) {
        for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium-"))) {
            const p = join(
                cache,
                dir,
                "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
            );
            if (existsSync(p)) return p;
        }
    }
    throw new Error("Set CHROME_PATH to a Chrome/Chromium binary.");
};

const { chromium } = await import("playwright-core").catch(() => {
    throw new Error("Run `npm i --no-save playwright-core` first.");
});

/** UI strings the scenes click, per language (the app's own labels). */
const UI = {
    en: {
        demo: /demo/i,
        chat: "Chats",
        tasks: "Tasks",
        notes: "Notes",
        inbox: "Inbox",
        todo: "To-Do",
        board: "Board",
        table: "Table",
        project: "Website Redesign",
        note: /Design system inventory/,
        general: /^general/,
        task: /Migrate marketing pages/,
        ask: "What's blocking the homepage rebuild?",
        write: "Add a to-do for tomorrow: review the hero illustration variants with Carol",
        report: "What to do today",
        showTasks: "Show tasks",
        priorities: "This week's priorities",
    },
    ja: {
        demo: /デモ/,
        chat: "チャット",
        tasks: "タスク",
        notes: "ノート",
        inbox: "受信箱",
        todo: "To-Do",
        board: "ボード",
        table: "テーブル",
        project: "Web サイトリニューアル",
        note: /Design system|design system|デザインシステム/,
        general: /^全体/,
        task: /マーケティングページ.*移行/,
        ask: "ホームページの作り直しを止めているものは何ですか？",
        write: "明日のTo-Doに追加：Carolとヒーロー画像のバリエーションをレビューする",
        report: "今日やること",
        showTasks: "タスクの表示",
        priorities: "今週の優先事項",
    },
};

const HIDE = `
  #genos-banner-region, [data-testid="permission-banner"], #genos-toast-region { display: none !important; }
  :root { --app-banner-h: 0px !important; }
`;

const settle = (page, ms = 2500) => page.waitForTimeout(ms);
const API = opt("api", "http://localhost:8890/api/v2");

async function signInToDemo(browser, lang, viewport, dark = false) {
    const ctx = await browser.newContext({
        viewport,
        deviceScaleFactor: 2,
        locale: lang === "ja" ? "ja-JP" : "en-US",
        timezoneId: "Asia/Tokyo",
        colorScheme: dark ? "dark" : "light",
    });
    const page = await ctx.newPage();
    let session = null;
    page.on("response", async (res) => {
        if (res.url().endsWith("/user/demo/") && res.ok())
            session = await res.json().catch(() => null);
    });
    await page.goto(`${BASE}/signin?lang=${lang}`, { waitUntil: "load" });
    await page.getByRole("button", { name: UI[lang].demo }).first().click();
    await page.waitForURL((u) => !/signin/.test(String(u)), { timeout: 180000 });
    await page.addStyleTag({ content: HIDE });
    await settle(page, 6000);
    return { ctx, page, session };
}

// The desktop rail: its labels also appear elsewhere on screen, so click where the items are
// (fixed at 1440x900).
const RAIL = { genos: 125, inbox: 197, chat: 268, tasks: 340, notes: 411, todo: 573 };
const rail = async (page, lang, key) => {
    await page.keyboard.press("Escape");
    await page.mouse.click(33, RAIL[key]);
    await settle(page, 3500);
};

/** The product's own non-AI "What to do today" report, so the Inbox is not empty. */
async function seedReport(session) {
    if (!session) return;
    const headers = {
        Authorization: `Bearer ${session.access}`,
        "Content-Type": "application/json",
    };
    const made = await fetch(`${API}/schedules/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            team_id: session.team_id,
            name: "Morning plan",
            job: "what_to_do_today",
            params: {},
            frequency: "daily",
            timeOfDay: "09:00",
        }),
    }).then((r) => r.json());
    await fetch(`${API}/schedules/${made.schedule.id}/run/?team_id=${session.team_id}`, {
        method: "POST",
        headers,
    });
}

/** The task table, staged once per session (the chevron clicks toggle, so they must not repeat). */
let tasksStaged = false;
const ensureTasks = async (page, lang) => {
    await page.keyboard.press("Escape");
    if (!tasksStaged) {
        await SCENES.tasks(page, lang);
    }
};

/**
 * What makes an answer unfit for a public picture: a citation that failed to resolve (the leftovers
 * print as "[,]", or "()" / "（）" in Japanese), the model giving up on part of the question, or the
 * demo account's synthetic address showing in a tool step.
 */
const WEAK_ANSWER =
    /\[\s*,?\s*\]|[（(]\s*[）)]|could not|couldn't|見つかりません|取得できません|demo\+[0-9a-f]+@/i;

/** Ask Genos one question and wait for the finished answer; retry when the model gave a weak one. */
const askGenos = async (page, lang, question, { expect, attempts = 3 }) => {
    const input = () =>
        page
            .getByPlaceholder(
                /Search chats, tasks, notes|チャット、タスク、ノートを検索|follow-up|フォローアップ/
            )
            .first();
    for (let i = 0; i < attempts; i += 1) {
        if (i > 0) {
            await page
                .getByText(/^(New chat|新しいチャット)$/)
                .first()
                .click();
            await settle(page, 1500);
        }
        await input().click();
        await input().fill(question);
        await input().press("Enter");
        await page
            .waitForFunction((re) => new RegExp(re).test(document.body.innerText), expect, {
                timeout: 120000,
            })
            .catch(() => {});
        await settle(page, 2000);
        const text = await page.evaluate(() => document.body.innerText);
        // A citation that failed to resolve renders as "[,]"; "could not" means the model gave up on part of it.
        if (!WEAK_ANSWER.test(text)) return;
    }
    throw new Error(
        `No clean answer to "${question}" after ${attempts} attempts; retake it, or pick another question.`
    );
};

/** Scenes: each stages the page and returns; the runner takes the picture. */
const SCENES = {
    tasks: async (page, lang) => {
        tasksStaged = true;
        await rail(page, lang, "tasks");
        await page.getByText(UI[lang].project, { exact: true }).first().click();
        await settle(page, 3500);
        // Open the milestone, then its first parent, so the table shows the tree
        // (statuses, tags, effort, sub-tasks) instead of two collapsed lines. The
        // chevrons have no accessible name on `main`, so they are clicked where they are.
        await page.mouse.click(370, 183);
        await settle(page, 1500);
        await page.mouse.click(370, 223);
        await settle(page, 1500);
        await page.mouse.move(900, 760);
        await settle(page, 800);
    },
    task: async (page, lang) => {
        await ensureTasks(page, lang);
        await page.getByText(UI[lang].table, { exact: true }).first().click();
        await settle(page, 2500);
        // The title is click-to-edit; the open icon beside the id opens the task.
        await page.mouse.click(462, 224);
        await settle(page, 4500);
    },
    board: async (page, lang) => {
        await ensureTasks(page, lang);
        await page.getByText(UI[lang].board, { exact: true }).first().click();
        await settle(page, 3500);
        await page.getByText(UI[lang].showTasks, { exact: true }).first().click();
        await settle(page, 2500);
    },
    note: async (page, lang) => {
        await rail(page, lang, "notes");
        await page.getByText(UI[lang].priorities, { exact: true }).first().click();
        await settle(page, 4500);
    },
    chat: async (page, lang) => {
        await rail(page, lang, "chat");
        await page.mouse.click(142, 77);
        await settle(page, 2000);
        await page.getByText(UI[lang].general).first().click();
        await settle(page, 4000);
        await page.keyboard.press("Escape");
        await settle(page, 800);
    },
    "tasks-dark": async (page, lang) => SCENES.tasks(page, lang),
    // Phone: no rail, so go by URL; the table becomes a list.
    "phone-tasks": async (page) => {
        await page.goto(`${BASE}/workspace/tasks`, { waitUntil: "load" });
        await page.addStyleTag({ content: HIDE });
        await settle(page, 6000);
    },
    "phone-chat": async (page, lang) => {
        await page.goto(`${BASE}/workspace/chat/gm`, { waitUntil: "load" });
        await page.addStyleTag({ content: HIDE });
        await settle(page, 5000);
        await page.getByText(UI[lang].general).first().click();
        await settle(page, 4500);
    },
    ask: async (page, lang) => {
        // A taller window, so the whole answer (steps, text and source chips) fits one picture.
        await page.setViewportSize({ width: 1440, height: 1100 });
        await rail(page, lang, "genos");
        await settle(page, 15000); // the post-signin reindex has to land before Genos can find anything
        await askGenos(page, lang, UI[lang].ask, { expect: "Answered in|で回答" });
        // Scroll the thread so the picture starts at the question, not halfway through the tool steps.
        await page.evaluate(() => {
            const nodes = [...document.querySelectorAll("*")].filter(
                (e) => e.scrollHeight > e.clientHeight + 40
            );
            for (const n of nodes) n.scrollTop = 0;
        });
        await settle(page, 800);
    },
    approval: async (page, lang) => {
        await rail(page, lang, "genos");
        await page
            .getByText(/^(New chat|新しいチャット|Back to search|検索に戻る)$/)
            .first()
            .click()
            .catch(() => {});
        await settle(page, 1500);
        await askGenos(page, lang, UI[lang].write, { expect: "Approve|承認する", attempts: 2 });
    },
    todo: async (page, lang) => {
        await rail(page, lang, "todo");
        await settle(page, 2500);
    },
    inbox: async (page, lang, session) => {
        await seedReport(session);
        await rail(page, lang, "inbox");
        await page.reload({ waitUntil: "load" });
        await page.addStyleTag({ content: HIDE });
        await settle(page, 6000);
    },
};

const workdir = mkdtempSync(join(tmpdir(), "lp-shots-"));
const toWebp = (png, name, lang, size, scale) => {
    const dir = join(OUT, lang);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${name}${scale === 2 ? "@2x" : ""}.webp`);
    const w = size.width * scale;
    const h = size.height * scale;
    execFileSync("cwebp", [
        "-quiet",
        "-q",
        "82",
        "-resize",
        String(w),
        String(h),
        png,
        "-o",
        file,
    ]);
    return file;
};

// `shots.json` is what the pages render with and says which part of the window each shot shows.
const SHOTS = JSON.parse(
    readFileSync(new URL("../src/lp/kit/shots.json", import.meta.url), "utf8")
);

/** What to take, in which browser: desktop light, desktop dark, phone. */
const PLAN = [
    {
        viewport: DESKTOP,
        dark: false,
        scenes: ["tasks", "board", "task", "note", "chat", "todo", "inbox", "ask", "approval"],
    },
    { viewport: DESKTOP, dark: true, scenes: ["tasks-dark"] },
    { viewport: PHONE, dark: false, scenes: ["phone-tasks", "phone-chat"] },
];

const browser = await chromium.launch({ executablePath: findChrome() });
try {
    for (const lang of LANGS) {
        for (const run of PLAN) {
            const wanted = run.scenes.filter((name) => !ONLY || ONLY.has(name));
            if (!wanted.length) continue;
            tasksStaged = false;
            const { ctx, page, session } = await signInToDemo(
                browser,
                lang,
                run.viewport,
                run.dark
            );
            for (const name of wanted) {
                const shot = SHOTS[name];
                if (!shot) throw new Error(`${name} is not in src/lp/kit/shots.json`);
                await SCENES[name](page, lang, session);
                await page.mouse.move(run.viewport.width - 20, run.viewport.height - 5); // no hover tooltips in the picture
                await settle(page, 700);
                const png = join(workdir, `${lang}-${name}.png`);
                // Cut at the browser (2x), so the picture is exact and never re-encoded twice.
                await page.screenshot({
                    path: png,
                    clip: { x: shot.x, y: shot.y, width: shot.width, height: shot.height },
                });
                toWebp(png, name, lang, shot, 2);
                toWebp(png, name, lang, shot, 1);
                await page.setViewportSize(run.viewport);
                console.log(`${lang}/${name}`);
            }
            await ctx.close();
        }
    }
} finally {
    await browser.close();
    rmSync(workdir, { recursive: true, force: true });
}

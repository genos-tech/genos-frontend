#!/usr/bin/env node
/**
 * The pictures of the /docs visual guides and the blog (MIP-2415, MIP-2416).
 *
 *   node scripts/lp-guide-screenshots.mjs [--base http://localhost:3000]
 *        [--api http://localhost:8890/api/v2] [--lang en,ja] [--only chat,task] [--out DIR]
 *
 * Like `lp-screenshots.mjs`, it signs into a FRESH demo workspace through "Try the demo" (never
 * a real or test account), so no real person's data can reach the public site. It adds a few
 * schedules and skills to that throwaway team through the app's own api, stages each scene and
 * writes `public/lp/guide/<lang>/<name>.webp` (1x) and `<name>@2x.webp`.
 *
 * It also measures where each numbered pin points (the element the caption talks about) and
 * writes the sizes and pin positions to `src/lp/kit/guideShots.json`. A pin whose element is not
 * on screen fails the run, so a retake can never leave a label pointing at nothing.
 *
 * Needs what lp-screenshots.mjs needs (a LOCAL stack with api, collab and sockets; never
 * production), the server switches REPORT_AI_DASHBOARDS, GENOS_SKILLS and HTML_NOTES on,
 * `npm i --no-save playwright-core`, CHROME_PATH and `cwebp`. No scene calls an AI model.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("base", "http://localhost:3000");
const API = opt("api", "http://localhost:8890/api/v2");
const LANGS = opt("lang", "en,ja").split(",");
const ONLY = opt("only", "") ? new Set(opt("only", "").split(",")) : null;
const OUT = opt("out", new URL("../public/lp/guide/", import.meta.url).pathname);
const MANIFEST = opt(
    "manifest",
    new URL("../src/lp/kit/guideShots.json", import.meta.url).pathname
);
const WINDOW = { width: 1440, height: 900 };

if (!process.env.CHROME_PATH) throw new Error("Set CHROME_PATH to a Chrome/Chromium binary.");
const { chromium } = await import("playwright-core").catch(() => {
    throw new Error("Run `npm i --no-save playwright-core` first.");
});

const UI = {
    en: {
        demo: /demo/i,
        ask: /Search chats, tasks, notes/,
        chatRoom: /^general · /,
        threadStart: /Separate topic before we wrap/,
        replies: /^6 replies$/,
        project: "Website Redesign",
        table: "Table",
        board: "Board",
        showTasks: "Show tasks",
        bigTask: /Investigate slow homepage load/,
        childTask: /Build Hero/,
        myNotes: "My Notes",
        note: "This week's priorities",
        dashboard: "Project status",
        dashboardReport: /^Project dashboard: /,
        morning: "Morning plan",
        skills: [
            ["weekly-update", "Weekly update", "Write this week's update from tasks and notes"],
            ["meeting-to-tasks", "Meeting notes to tasks", "Turn meeting notes into tasks"],
            ["risk-check", "Sprint risk check", "Find what could slip this sprint"],
        ],
    },
    ja: {
        demo: /デモ/,
        ask: /チャット、タスク、ノートを検索/,
        chatRoom: /^全体/,
        threadStart: /モバイル/,
        replies: /^6 ?(replies|件の返信)$/,
        project: "Web サイトリニューアル",
        table: "テーブル",
        board: "ボード",
        showTasks: "タスクの表示",
        bigTask: /ホームページ読み込み遅延/,
        childTask: /Hero|ヒーロー/,
        myNotes: "マイノート",
        note: "今週の優先事項",
        dashboard: "プロジェクトの状況",
        dashboardReport: /^(Project dashboard|プロジェクトのダッシュボード)[:：] /,
        morning: "朝の予定",
        skills: [
            ["weekly-update", "週次まとめ", "タスクとノートから今週のまとめを書く"],
            ["meeting-to-tasks", "議事録をタスクに", "会議のメモからタスクを作る"],
            ["risk-check", "スプリントのリスク確認", "遅れそうなものを見つける"],
        ],
    },
};

/** Desktop rail items sit at fixed places at 1440x900 (see lp-screenshots.mjs). */
const RAIL = { genos: 125, inbox: 197, chat: 268, tasks: 340, notes: 411, todo: 573 };
/** Order of the Settings dialog's tabs. */
const TAB = { general: 0, genos: 3, notifications: 6, shortcuts: 9, security: 10, developer: 13 };

const HIDE = `[role="tooltip"], #genos-toast-region, #genos-banner-region, [data-testid="permission-banner"] { display: none !important; }
:root { --app-banner-h: 0px !important; }`;

const wait = (page, ms = 2500) => page.waitForTimeout(ms);
const seen = (page, text, exact = false) =>
    page.getByText(text, { exact }).filter({ visible: true }).first();

const go = async (page, path, ms = 5000) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "load" });
    await page.addStyleTag({ content: HIDE });
    await wait(page, ms);
};

const boxOf = async (locator, what) => {
    await locator.waitFor({ state: "visible", timeout: 15000 }).catch(() => {
        throw new Error(`Pin target not on screen: ${what}`);
    });
    return locator.boundingBox();
};
/** A point on an element: by default its top-left corner, nudged inside. */
const at = async (locator, what, fx = 0, fy = 0.5) => {
    const b = await boxOf(locator, what);
    return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};
const rect = (x, y, width, height) => ({ x, y, width, height });
const around = (box, pad) =>
    rect(
        Math.max(0, box.x - pad),
        Math.max(0, box.y - pad),
        Math.min(WINDOW.width - Math.max(0, box.x - pad), box.width + pad * 2),
        Math.min(WINDOW.height - Math.max(0, box.y - pad), box.height + pad * 2)
    );

async function signIn(browser, lang) {
    const ctx = await browser.newContext({
        viewport: WINDOW,
        deviceScaleFactor: 2,
        locale: lang === "ja" ? "ja-JP" : "en-US",
        timezoneId: "Asia/Tokyo",
        colorScheme: "light",
    });
    await ctx.addInitScript(() => {
        Object.defineProperty(Notification, "permission", { get: () => "granted" });
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
    await wait(page, 15000); // the demo workspace is seeded in the background
    if (!session) throw new Error("The demo sign-in returned no session.");
    return { ctx, page, session };
}

/** Schedules, a dashboard and skills for the throwaway team, through the app's own api. */
async function seed(session, lang) {
    const call = async (method, path, body) => {
        const res = await fetch(`${API}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${session.access}`,
                "Content-Type": "application/json",
                "Accept-Language": lang,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
        return data;
    };
    const team = session.team_id;
    for (const [slug, title, description] of UI[lang].skills) {
        await call("POST", "/skills/", {
            team_id: team,
            slug,
            title,
            description,
            bodyMarkdown: "1. Read the open tasks.\n2. Write five short lines.",
            access: "read",
        });
    }
    const projects = await call("GET", `/project/projects/?team_id=${team}`).catch(() => null);
    const list = Array.isArray(projects) ? projects : (projects?.projects ?? projects?.data ?? []);
    const project = list.find((p) => (p.project_name ?? p.projectName) === UI[lang].project);
    const dashboard = project
        ? { kind: "project", project_id: project.project_id ?? project.projectId, period: "month" }
        : { kind: "mine", period: "month" };
    const jobs = [
        [UI[lang].morning, "what_to_do_today", {}],
        [UI[lang].dashboard, "ai_dashboard", dashboard],
    ];
    for (const [name, job, params] of jobs) {
        const made = await call("POST", "/schedules/", {
            team_id: team,
            name,
            job,
            params,
            frequency: "daily",
            timeOfDay: "09:00",
        });
        await call("POST", `/schedules/${made.schedule.id}/run/?team_id=${team}`);
    }
}

const openProjectTable = async (page, lang, { expand = true } = {}) => {
    await go(page, "/workspace/tasks");
    const row = page.getByRole("button").filter({ hasText: UI[lang].project }).first();
    const title = page.getByText(UI[lang].project, { exact: true }).filter({ visible: true });
    if ((await title.count()) < 2) {
        await row.click({ position: { x: 24, y: 8 } });
        await wait(page, 3500);
    }
    await seen(page, UI[lang].table, true).click();
    await wait(page, 2000);
    for (let i = 0; expand && i < 2; i += 1) {
        const closed = page.locator('.task-table-row[aria-expanded="false"]').first();
        if (!(await closed.count())) break;
        await closed
            .locator("button")
            .filter({ has: page.locator('svg[data-testid="KeyboardArrowRightRoundedIcon"]') })
            .click();
        await wait(page, 1500);
    }
};

/** The blog's own scenes (MIP-2416): English only, as the blog is. */
const BLOG_ONLY = new Set(["blog-rules", "blog-status-board", "blog-pins"]);

/** The demo session's api, for what a blog scene needs staged first. */
const apiFor = (session) => async (method, path, body) => {
    const res = await fetch(`${path.startsWith("/api/") ? new URL(API).origin : API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${session.access}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
    return data;
};

const projectNamed = async (session, name) => {
    const list = await apiFor(session)("GET", `/project/projects/?team_id=${session.team_id}`);
    return list.find((p) => p.projectName === name).projectId;
};

/** The open project's "..." menu (the page header's), then "Statuses and automation". */
const openStatusesDialog = async (page, lang) => {
    await openProjectTable(page, lang, { expand: false });
    await page.mouse.click(1399, 32);
    await page.getByRole("menuitem", { name: "Statuses and automation" }).click();
    await wait(page, 3000);
    return page.getByRole("dialog").filter({ visible: true }).last();
};

/** Where the table pane starts: just left of the project's name in its header. */
const paneStart = async (page, lang) => {
    const title = page
        .getByText(UI[lang].project, { exact: true })
        .filter({ visible: true })
        .last();
    const all = await page.getByText(UI[lang].project, { exact: true }).all();
    let x = (await boxOf(title, "project header")).x;
    for (const found of all) {
        const b = await found.boundingBox();
        if (b && b.y < 60) x = b.x;
    }
    return Math.max(0, Math.round(x - 66));
};

const openTask = async (page, title) => {
    await page
        .locator(".task-table-row")
        .filter({ hasText: title })
        .first()
        .locator("button")
        .filter({ has: page.locator('svg[data-testid="OpenInNewIcon"]') })
        .click();
    await wait(page, 4500);
};

const openThread = async (page, lang) => {
    await go(page, "/workspace/chat/gm");
    await seen(page, UI[lang].chatRoom).click();
    await wait(page, 4000);
    await seen(page, UI[lang].replies).click();
    await wait(page, 4000);
};

const openSettings = async (page, lang, tab) => {
    await go(page, "/workspace/genos", 3000);
    await page.mouse.click(33, 713);
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ timeout: 15000 });
    await dialog.getByRole("tab").nth(TAB[tab]).click();
    await wait(page, 3000);
    return dialog;
};

/** A Settings tab: the dialog itself, with pins on text inside it. */
const settingsShot = (tab, height) => async (page, lang) => {
    const dialog = await openSettings(page, lang, tab);
    const b = await dialog.boundingBox();
    const clip = rect(b.x, b.y, b.width, Math.min(height ?? b.height, b.height));
    const nav = await at(dialog.getByRole("tab").nth(TAB[tab]), `${tab} tab`, 0.9);
    return { clip, pins: [nav] };
};

const SCENES = {
    "blog-rules": async (page, lang, session) => {
        const call = apiFor(session);
        const project = await projectNamed(session, UI[lang].project);
        const design = await projectNamed(session, "Design system");
        await call("POST", `/projects/${project}/automation-rules/`, {
            name: "Design work goes to the design team",
            trigger_type: "tag_added",
            trigger_value: { tag: "Design" },
            destination_project_id: design,
            set_status: "Open",
            enabled: false,
        });
        const dialog = await openStatusesDialog(page, lang);
        await dialog.getByRole("tab", { name: "Automation" }).click();
        await wait(page, 2000);
        await dialog.getByRole("button", { name: /^More actions for/ }).click();
        await page.getByRole("menuitem", { name: "Preview matches" }).click();
        await wait(page, 3500);
        const b = await page.getByRole("dialog").filter({ visible: true }).last().boundingBox();
        return { clip: rect(b.x, b.y, b.width, b.height), pins: [] };
    },
    "blog-status-board": async (page, lang, session) => {
        const call = apiFor(session);
        const project = await projectNamed(session, UI[lang].project);
        const base = `/projects/${project}/statuses/`;
        await call("PUT", base, { order: [] });
        await call("POST", base, { name: "In QA", category: "WIP", color: "#0ea5e9" });
        await call("PATCH", base, { board_columns_per_status: true });
        const { statuses } = await call("GET", base);
        const id = (name) => statuses.find((s) => s.name === name).statusId;
        const found = await call(
            "GET",
            `/task/getProjectTasks/?project_id=${project}&team_id=${session.team_id}`
        );
        const open = found.data.tasks.filter((t) => !t.isMilestone && t.status === "Open");
        const wip = found.data.tasks.filter((t) => !t.isMilestone && t.status === "WIP");
        const moves = [
            ...open.slice(0, 2).map((t) => [t, id("Ready")]),
            ...[...wip.slice(0, 1), ...open.slice(2, 3)].map((t) => [t, id("In QA")]),
        ];
        for (const [task, status] of moves) {
            await call("PUT", "/task/", {
                task_id: Number(task.id),
                team_id: session.team_id,
                project_id: project,
                custom_status: status,
            });
        }
        await openProjectTable(page, lang, { expand: false });
        await seen(page, UI[lang].board, true).click();
        await wait(page, 3000);
        await seen(page, UI[lang].showTasks, true)
            .click()
            .catch(() => {});
        await wait(page, 3000);
        const x = await paneStart(page, lang);
        return { clip: rect(x, 0, 1440 - x, 640), pins: [] };
    },
    "blog-pins": async (page, lang, session) => {
        await openThread(page, lang);
        // Pin two messages of the open room, through the same endpoint the menu calls.
        const call = apiFor(session);
        const found = await call("GET", `/api/v3/channels/?team_id=${session.team_id}`);
        const room = found.channels.find((c) => c.title.startsWith("general · "));
        const history = await call("GET", `/api/v3/channels/${room.id}/messages/`);
        for (const message of history.data.messages.slice(-3, -1)) {
            await call("POST", `/api/v3/messages/${message.id}/message_pin/`);
        }
        await openThread(page, lang);
        await page.getByRole("checkbox", { name: /^Also send to/ }).check();
        await page
            .locator('[class*="bn-chat-editor-box"] [contenteditable="true"]')
            .last()
            .click();
        await page.keyboard.type("Decided: we ship the new header on Thursday.");
        await wait(page, 1500);
        return { clip: rect(68, 0, 1372, 900), pins: [] };
    },
    overview: async (page, lang) => {
        await go(page, "/workspace/genos");
        const ask = page.getByPlaceholder(UI[lang].ask).first();
        const rail = (key) => ({ x: 56, y: RAIL[key] - 8 });
        return {
            clip: rect(0, 0, 1440, 900),
            pins: [
                await at(ask, "ask box", -0.02, 0.5),
                rail("inbox"),
                rail("chat"),
                rail("tasks"),
                rail("notes"),
                rail("todo"),
            ],
        };
    },
    ask: async (page, lang) => {
        await go(page, "/workspace/genos");
        const ask = page.getByPlaceholder(UI[lang].ask).first();
        const b = await boxOf(ask, "ask box");
        const clip = rect(380, b.y - 130, 1016, 330);
        return {
            clip,
            pins: [
                { x: b.x - 44, y: b.y + b.height / 2 },
                { x: b.x - 44, y: b.y + 78 },
                { x: b.x - 44, y: b.y + 150 },
            ],
        };
    },
    skills: async (page, lang) => {
        await go(page, "/workspace/genos");
        const ask = page.getByPlaceholder(UI[lang].ask).first();
        await ask.click();
        await page.keyboard.type("/");
        await wait(page, 2500);
        const b = await boxOf(ask, "ask box");
        const first = seen(page, "/weekly-update");
        return {
            clip: rect(380, b.y - 60, 1016, 330),
            pins: [
                await at(ask, "ask box", 0.05, 0.5),
                {
                    x: (await boxOf(first, "skill list")).x - 56,
                    y: (await boxOf(first, "skill list")).y + 8,
                },
            ],
        };
    },
    chat: async (page, lang) => {
        await openThread(page, lang);
        await page.mouse.move(1430, 890);
        const composer = page.locator('[class*="bn-chat-editor-box"]').first();
        return {
            clip: rect(68, 0, 1372, 900),
            pins: [
                await at(seen(page, UI[lang].chatRoom), "chat list", -0.25, 0),
                await at(seen(page, UI[lang].replies), "reply count", -0.4, 0.5),
                await at(composer, "composer", 0.5, 0.3),
                { x: 1010, y: 30 },
            ],
        };
    },
    "message-menu": async (page, lang) => {
        await openThread(page, lang);
        // The main column's copy of the message (the thread pane shows it again).
        let here = null;
        for (const found of await page.getByText(UI[lang].threadStart).all()) {
            const b = await found.boundingBox();
            if (b && b.x > 500 && b.x < 900) here = b; // the middle column
        }
        if (!here) throw new Error("Pin target not on screen: message");
        await page.mouse.move(here.x + 40, here.y + 12, { steps: 5 });
        await wait(page, 1000);
        // The hover toolbar's "..." is the one next to the message, not the pane header's.
        const dots = page
            .locator("button")
            .filter({ has: page.locator('svg[data-testid^="MoreHoriz"]') })
            .filter({ visible: true });
        let more = null;
        for (const button of await dots.all()) {
            const b = await button.boundingBox();
            if (b && b.x > here.x && b.x < here.x + 460 && Math.abs(b.y - here.y) < 90)
                more = button;
        }
        if (!more) throw new Error("Pin target not on screen: message toolbar");
        await more.click();
        await wait(page, 1500);
        const menu = page.getByRole("menu").filter({ visible: true }).first();
        const b = await boxOf(menu, "message menu");
        const remind = menu.getByText(/^(Remind me|リマインド|あとで通知)/).first();
        const r = await boxOf(remind, "remind me");
        return { clip: around(b, 120), pins: [{ x: b.x - 2, y: r.y + r.height / 2 }] };
    },
    tasks: async (page, lang) => {
        await openProjectTable(page, lang);
        await page.mouse.move(900, 860);
        const add = page.getByRole("button", { name: /(Task|タスク)$/ }).filter({ visible: true });
        const first = page.locator(".task-table-row").first();
        const row = await boxOf(first, "first row");
        const x = await paneStart(page, lang);
        const mid = row.y + row.height / 2;
        const status = await boxOf(first.getByText(/^(Open|オープン|未着手)$/).first(), "status");
        const title = await boxOf(first.getByText(/v1\.0/).first(), "milestone title");
        const filters = await boxOf(seen(page, /^(FILTERS|Filters|フィルター)$/i), "filters");
        return {
            clip: rect(x, 0, 1440 - x, 540),
            pins: [
                await at(add.first(), "new task", -0.15, 0.5),
                { x: filters.x - 36, y: filters.y + filters.height / 2 },
                { x: status.x - 34, y: mid },
                { x: title.x - 34, y: mid },
            ],
        };
    },
    task: async (page, lang) => {
        await openProjectTable(page, lang);
        await openTask(page, UI[lang].bigTask);
        const title = await boxOf(
            page.getByText(UI[lang].bigTask).filter({ visible: true }).last(),
            "task title"
        );
        const x = Math.max(0, title.x - 24);
        const label = async (names) => {
            for (const name of names) {
                const found = page.getByText(name, { exact: true }).filter({ visible: true });
                if (await found.count()) {
                    const b = await boxOf(found.last(), name);
                    return { x: b.x - 14, y: b.y + b.height / 2 };
                }
            }
            throw new Error(`No label ${names.join("/")}`);
        };
        return {
            clip: rect(x, 0, 1440 - x, 900),
            pins: [
                await label(["Status", "ステータス"]),
                await label(["Due Date", "締切", "期限"]),
                await label(["Links", "リンク"]),
                await label(["Dependencies", "依存関係"]),
            ],
        };
    },
    graph: async (page, lang) => {
        await openProjectTable(page, lang);
        await openTask(page, UI[lang].childTask);
        await page.keyboard.press("Control+Alt+g");
        await wait(page, 5000);
        const dialog = page.getByRole("dialog").filter({ visible: true }).last();
        const b = await boxOf(dialog, "task graph");
        return { clip: rect(b.x, b.y, b.width, b.height), pins: [] };
    },
    board: async (page, lang) => {
        await openProjectTable(page, lang, { expand: false });
        await seen(page, UI[lang].board, true).click();
        await wait(page, 3000);
        await seen(page, UI[lang].showTasks, true)
            .click()
            .catch(() => {});
        await wait(page, 3000);
        const x = await paneStart(page, lang);
        return { clip: rect(x, 0, 1440 - x, 700), pins: [] };
    },
    note: async (page, lang) => {
        await go(page, "/workspace/notes");
        const mine = seen(page, UI[lang].myNotes, true);
        const wanted = page.getByText(UI[lang].note, { exact: true }).filter({ visible: true });
        // The tree remembers what is open, so click "My notes" only while the note is not listed.
        await wait(page, 2000);
        for (let i = 0; i < 3 && !(await wanted.count()); i += 1) {
            await mine.click();
            await wait(page, 2500);
        }
        // The tree's sticky header can lie over the row, so the click is sent to the row itself.
        await wanted.last().dispatchEvent("click");
        await page.waitForFunction(
            () => (document.querySelector(".ProseMirror")?.textContent ?? "").trim().length > 80,
            null,
            { timeout: 30000 }
        );
        await wait(page, 1500);
        const body = page.locator(".ProseMirror").filter({ visible: true }).first();
        const b = await boxOf(body, "note body");
        return {
            clip: rect(68, 0, 1372, 780),
            pins: [
                {
                    x: 68 + 118,
                    y:
                        (await boxOf(seen(page, /^(Workspaces|ワークスペース)$/i), "workspaces"))
                            .y + 8,
                },
                { x: b.x + 4, y: b.y + 90 },
                { x: 1352, y: 30 },
            ],
        };
    },
    todo: async (page) => {
        await go(page, "/workspace/genos", 3000);
        await page.mouse.click(33, RAIL.todo);
        await wait(page, 3500);
        const dialog = page.getByRole("dialog").filter({ visible: true }).first();
        const b = await boxOf(dialog, "to-do window");
        return {
            clip: rect(b.x, b.y, b.width, Math.min(b.height, 640)),
            pins: [{ x: b.x + b.width - 236, y: b.y + 32 }],
        };
    },
    inbox: async (page, lang) => {
        await go(page, "/workspace/inbox", 7000);
        const report = seen(page, UI[lang].dashboardReport);
        await report.waitFor({ timeout: 30000 }).catch(() => {});
        return {
            clip: rect(68, 0, 1372, 700),
            pins: [
                {
                    x: (await boxOf(report, "dashboard report")).x - 16,
                    y: (await boxOf(report, "dashboard report")).y + 10,
                },
                { x: 150, y: 439 },
            ],
        };
    },
    dashboard: async (page, lang) => {
        await go(page, "/workspace/inbox", 7000);
        await seen(page, /^(Dashboard page|ダッシュボードページ)$/).click();
        await wait(page, 10000);
        const frame = page.locator("iframe").filter({ visible: true }).first();
        const b = await boxOf(frame, "dashboard page");
        return { clip: rect(b.x, b.y, b.width, Math.min(b.height, 600)), pins: [] };
    },
    schedules: async (page, lang) => {
        const dialog = await openSettings(page, lang, "genos");
        await seen(page, UI[lang].morning, true).scrollIntoViewIfNeeded();
        await dialog.hover();
        await page.mouse.wheel(0, 120);
        await wait(page, 1500);
        const b = await dialog.boundingBox();
        const run = page.getByRole("button", { name: /^(Run now|今すぐ実行)$/ }).first();
        return {
            clip: rect(b.x, b.y, b.width, b.height),
            pins: [await at(run, "run now", 0, 0.5)],
        };
    },
    connect: async (page, lang) => {
        const dialog = await openSettings(page, lang, "developer");
        const b = await dialog.boundingBox();
        const tabs = dialog.getByRole("tab", { name: "Claude Code" });
        const command = dialog.getByText("/plugin marketplace add", { exact: false }).first();
        const c = await boxOf(command, "plugin command");
        // Cut above the second command box: on a local stack it shows the local api address.
        const bottom = c.y + 128;
        return {
            clip: rect(b.x, b.y, b.width, bottom - b.y),
            pins: [await at(tabs, "app tabs", 0, 0.5), { x: c.x - 16, y: c.y + c.height / 2 }],
        };
    },
    settings: settingsShot("general"),
    notifications: settingsShot("notifications"),
    shortcuts: settingsShot("shortcuts"),
    security: async (page, lang) => {
        const { clip } = await settingsShot("security", 320)(page, lang);
        const on = page
            .getByRole("dialog")
            .getByRole("button", { name: /^(Turn on|オンにする|有効にする)/ });
        return { clip, pins: [await at(on.first(), "turn on", -0.12, 0.5)] };
    },
};

const cwebp = (png, file, w, h) =>
    execFileSync("cwebp", [
        "-quiet",
        "-q",
        "80",
        "-resize",
        String(w),
        String(h),
        png,
        "-o",
        file,
    ]);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const work = mkdtempSync(join(tmpdir(), "lp-guide-"));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const failed = [];
try {
    for (const lang of LANGS) {
        const { ctx, page, session } = await signIn(browser, lang);
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.stack).slice(0, 1200)));
        page.on(
            "console",
            (m) => /Error|error/.test(m.text()) && errors.push(m.text().slice(0, 900))
        );
        await seed(session, lang);
        for (const [name, scene] of Object.entries(SCENES)) {
            if (ONLY && !ONLY.has(name)) continue;
            if (lang !== "en" && BLOG_ONLY.has(name)) continue;
            try {
                const { clip, pins } = await scene(page, lang, session);
                await page.mouse.move(WINDOW.width - 4, WINDOW.height - 4);
                await page.addStyleTag({ content: HIDE });
                await wait(page, 800);
                const area = {
                    x: Math.round(clip.x),
                    y: Math.round(clip.y),
                    width: Math.round(clip.width),
                    height: Math.round(clip.height),
                };
                const png = join(work, `${lang}-${name}.png`);
                await page.screenshot({ path: png, clip: area });
                const dir = join(OUT, lang);
                mkdirSync(dir, { recursive: true });
                // 1x is at most 1000 px wide: the pages never show it wider.
                const w = Math.min(area.width, 1000);
                const h = Math.round((area.height * w) / area.width);
                cwebp(png, join(dir, `${name}.webp`), w, h);
                cwebp(png, join(dir, `${name}@2x.webp`), w * 2, h * 2);
                const fraction = (v) => Number(Math.min(0.985, Math.max(0.015, v)).toFixed(3));
                manifest[name] ??= {};
                manifest[name][lang] = {
                    width: w,
                    height: h,
                    pins: pins.map((p) => [
                        fraction((p.x - area.x) / area.width),
                        fraction((p.y - area.y) / area.height),
                    ]),
                };
                console.log(`${lang}/${name}`);
            } catch (error) {
                failed.push(`${lang}/${name}: ${String(error.message).split("\n")[0]}`);
                if (process.env.DEBUG_SCENE) console.error(String(error.message).slice(0, 700));
                console.error(`FAILED ${failed.at(-1)}`);
                await page.screenshot({ path: join(tmpdir(), `lp-guide-fail-${name}.png`) });
                if (process.env.DEBUG_SCENE) console.error(errors.slice(-8).join("\n"));
            }
        }
        await ctx.close();
    }
} finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`);
if (failed.length) {
    console.error(`\n${failed.length} scene(s) failed:\n${failed.join("\n")}`);
    process.exit(1);
}

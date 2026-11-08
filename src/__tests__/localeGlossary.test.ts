/**
 * MIP-1181: one agreed term per concept per locale (the table is
 * `src/i18n/locales/GLOSSARY.md`).
 *
 * These pin the terms that had already drifted once, so a later edit cannot bring the
 * old word back: a footrace for "sprint", "social standing" for "status", four spellings
 * of "milestone" in Arabic, two tiles that both said "Tasks".
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const HERE = dirname(fileURLToPath(import.meta.url));

const leaves = (node: unknown, prefix = "", out: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries((node ?? {}) as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") leaves(v, path, out);
        else if (typeof v === "string") out[path] = v;
    }
    return out;
};
const EN = leaves(en);
const L = {
    ja: leaves(ja),
    zh: leaves(zh),
    es: leaves(es),
    fr: leaves(fr),
    hi: leaves(hi),
    ar: leaves(ar),
};

/** Paths whose English text matches, with the locale's text. */
const whereEnglish = (locale: keyof typeof L, re: RegExp) =>
    Object.keys(EN)
        .filter((k) => re.test(EN[k]) && k in L[locale])
        .map((k) => ({ path: k, text: L[locale][k] }));

/** Every path whose text in `locale` matches `re` (to prove a retired word is gone). */
const using = (locale: keyof typeof L, re: RegExp) =>
    Object.entries(L[locale])
        .filter(([, v]) => re.test(v))
        .map(([k]) => k);

describe("zh", () => {
    it("sprint is 冲刺, not a footrace (短跑) or 迭代", () => {
        expect(L.zh["tasks.fields.sprint"]).toBe("冲刺");
        expect(L.zh["tasks.fields.noSprint"]).toBe("无冲刺");
        expect(using("zh", /短跑|迭代/)).toEqual([]);
    });
    it("status is 状态, never 地位 (social standing)", () => {
        expect(L.zh["tasks.dashboard.tags.status"]).toBe("状态");
        expect(L.zh["agentApproval.fieldLabels.status"]).toBe("状态");
        expect(using("zh", /地位/)).toEqual([]);
    });
    it("effort is 工作量 wherever the task field is named", () => {
        expect(L.zh["tasks.fields.effortLevel"]).toBe("工作量");
        expect(L.zh["agentApproval.fieldLabels.effort_level"]).toBe("工作量");
    });
});

describe("hi", () => {
    it("sprint is स्प्रिंट, not 'to run at full speed'", () => {
        expect(L.hi["tasks.fields.sprint"]).toBe("स्प्रिंट");
        expect(using("hi", /दौड़/)).toEqual([]);
    });
    it("milestone is one word, माइलस्टोन", () => {
        expect(L.hi["tasks.fields.milestone"]).toBe("माइलस्टोन");
        expect(using("hi", /मील (का|के) पत्थर/)).toEqual([]);
    });
    it("status is स्थिति and a note is never a टिप्पणी (comment)", () => {
        expect(L.hi["tasks.fields.status"]).toBe("स्थिति");
        expect(using("hi", /स्टेटस/)).toEqual([]);
        expect(L.hi["spotlight.filter.note"]).toBe("नोट्स");
    });
});

describe("ar", () => {
    // The retired spellings, including the vocalised مَعلَم and "الإنجاز" (completion) that
    // stood in for a milestone in the filter help.
    const RETIRED_MILESTONE =
        /منعطف|مرحلة|المراحل|الحدث الرئيسي|الأحداث الرئيسية|حدث رئيسي|مَعلَم|الإنجاز/;
    const MILESTONE = /معلم|المعلم|معالم|المعالم/;

    it("milestone has one spelling (معلم) across every key that names it", () => {
        // ("The main event" is `الحدث الرئيسي`: only keys whose English names a milestone count.)
        const about = whereEnglish("ar", /milestone/i);
        expect(about.filter((x) => RETIRED_MILESTONE.test(x.text)).map((x) => x.path)).toEqual([]);
        // Every tasks.* key that names a milestone in English says it with the one word.
        const tasks = about.filter((x) => x.path.startsWith("tasks."));
        expect(tasks.length).toBeGreaterThan(20);
        expect(tasks.filter((x) => !MILESTONE.test(x.text)).map((x) => x.path)).toEqual([]);
        expect(L.ar["tasks.fields.milestone"]).toBe("معلم");
    });

    it("sprint has one spelling (سبرنت), not سبرينت / سباق / العدو", () => {
        expect(L.ar["tasks.fields.sprint"]).toBe("سبرنت");
        expect(using("ar", /سبرينت|سباق|العدو/)).toEqual([]);
    });

    it("effort is الجهد (not المجهود) and a thread is موضوع (not خيط)", () => {
        expect(using("ar", /المجهود|خيط/)).toEqual([]);
    });
});

describe("the rail never shows one word on two buttons", () => {
    const ALL = { en: EN, ...L };
    const RAIL = [
        "sidebar.nav.inbox",
        "sidebar.nav.chats",
        "sidebar.nav.tasks",
        "sidebar.nav.notes",
        "sidebar.actions.todo",
        "sidebar.actions.history",
        "sidebar.actions.settings",
        "sidebar.actions.signOut",
    ];
    for (const [name, catalog] of Object.entries(ALL)) {
        it(`${name}: the rail labels are all different`, () => {
            const labels = RAIL.map((k) => catalog[k]);
            expect(labels.every(Boolean), `${name} lacks a rail label`).toBe(true);
            const dup = labels.filter((x, i) => labels.indexOf(x) !== i);
            expect(dup, `${name} rail repeats a label`).toEqual([]);
        });
        it(`${name}: the service switcher tiles are all different`, () => {
            const keys = ["inbox", "chats", "tasks", "notes", "todo"].map(
                (k) => `layout.serviceSwitcher.${k}`
            );
            const labels = keys.map((k) => catalog[k]);
            expect(labels.every(Boolean), `${name} lacks a tile label`).toBe(true);
            expect(labels.filter((x, i) => labels.indexOf(x) !== i)).toEqual([]);
        });
    }

    it("the To-Do label is the same in the rail, the switcher and Settings > Sidebar", () => {
        // Width is owned by GlobalRail.test.tsx (53px budget per label); this only keeps the
        // three places that name the same button in step.
        for (const name of Object.keys(L) as (keyof typeof L)[]) {
            const todo = L[name]["sidebar.actions.todo"];
            expect(L[name]["layout.serviceSwitcher.todo"], `${name} switcher`).toBe(todo);
            expect(L[name]["settings.sidebar.items.todo"], `${name} settings`).toBe(todo);
        }
    });
});

describe("ja / es / fr", () => {
    it("ja: a note is ノート (the sidebar's word) and the inbox is 受信箱", () => {
        expect(L.ja["sidebar.nav.notes"]).toBe("ノート");
        expect(using("ja", /受信トレイ/)).toEqual([]);
        // メモ remains only for "meeting notes" and the task's own notes field.
        const memo = using("ja", /メモ(?!リ)/).filter((k) => !/会議メモ/.test(L.ja[k]));
        expect(memo.sort()).toEqual([
            "agentApproval.edit.fields.notes",
            "chat.todoPane.createTask.description",
        ]);
    });
    it("es: To-Do is Por hacer (the pane's title), sprint is never a 'carrera' (race)", () => {
        expect(L.es["sidebar.actions.todo"]).toBe("Por hacer");
        expect(L.es["tasks.fields.noSprint"]).toBe("Sin sprint");
        expect(using("es", /carrera/i)).toEqual([]);
    });
    it("fr: a milestone is a jalon, never an étape (step), for every key about milestones", () => {
        const wrong = whereEnglish("fr", /milestone/i).filter((x) => /étape/i.test(x.text));
        expect(wrong).toEqual([]);
    });
});

describe("GLOSSARY.md matches the catalogs", () => {
    const doc = readFileSync(join(HERE, "..", "i18n", "locales", "GLOSSARY.md"), "utf8");
    const rows = doc
        .split("\n")
        .filter((l) => /^\|/.test(l) && !/^\|[\s-|]+$/.test(l))
        .map((l) =>
            l
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim())
        )
        .filter((r) => r[0] !== "Concept");
    const LOCALES = ["en", "ja", "zh", "es", "fr", "hi", "ar"] as const;
    const ALL: Record<string, Record<string, string>> = { en: EN, ...L };

    /** The key whose text is the concept's canonical label in the app. */
    const CANON: Record<string, string> = {
        Task: "spotlight.entitySubtitle.task",
        Project: "spotlight.entitySubtitle.project",
        Sprint: "tasks.fields.sprint",
        Milestone: "tasks.fields.milestone",
        "Backlog (no sprint)": "tasks.dashboard.emptyBacklogTitle",
        Status: "tasks.fields.status",
        Priority: "tasks.fields.priority",
        "Effort (task)": "tasks.fields.effortLevel",
        Inbox: "sidebar.nav.inbox",
        "Schedule (recurring)": "settings.schedules.newSchedule",
        Note: "spotlight.entitySubtitle.noteFallback",
        Thread: "chat.headers.thread",
        Comment: "chat.activity.chipComment",
        "Revoke (key, app)": "settings.connectedApps.revoke",
    };

    it("has a row for every concept the test can check", () => {
        const names = rows.map((r) => r[0]);
        for (const c of Object.keys(CANON)) expect(names, c).toContain(c);
    });

    for (const [concept, key] of Object.entries(CANON)) {
        it(`${concept}: every cell is the word the app uses`, () => {
            const row = rows.find((r) => r[0] === concept)!;
            LOCALES.forEach((loc, i) => {
                // "معلم (pl. معالم)": the first word is the term, the rest a note.
                const term = row[i + 1].replace(/\s*\(.*$/, "");
                expect(
                    ALL[loc][key].toLowerCase(),
                    `${concept} / ${loc}: the table says "${term}"`
                ).toContain(term.toLowerCase());
            });
        });
    }

    for (const term of [
        "冲刺",
        "स्प्रिंट",
        "माइलस्टोन",
        "معلم",
        "سبرنت",
        "مهام اليوم",
        "Por hacer",
    ]) {
        it(`names ${term}`, () => expect(doc).toContain(term));
    }
});

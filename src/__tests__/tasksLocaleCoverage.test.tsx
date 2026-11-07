/**
 * MIP-1135 (Arabic part 1): the task toolbar / board / dashboard are translated in every
 * locale, and a name keeps its reading order.
 *
 * `DeepPartial<Messages>` lets a locale omit a key and quietly show English, which is how
 * the Arabic task screens kept English labels with no failing test. So these read the RAW
 * catalogs and compare every leaf of `en.tasks` with each of the other six locales.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ResolvedUserName } from "../components/ui/avatars/AvatarContext";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

const OTHERS = { ar, es, fr, hi, ja, zh } as const;

const leaves = (node: unknown, prefix = "", out: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries((node ?? {}) as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") leaves(v, path, out);
        else out[path] = String(v);
    }
    return out;
};
const EN = leaves(en.tasks);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

/** Values that are legitimately identical to English (URLs, templates with only symbols). */
const SAME_AS_ENGLISH_OK = new Set([
    "linkedPr.paste",
    "dashboard.velocity.barTooltip",
    "diagram.tooltips.parentChild",
]);

describe("tasks catalog: every locale has every English key", () => {
    for (const [name, catalog] of Object.entries(OTHERS)) {
        const L = leaves((catalog as { tasks?: unknown }).tasks);

        it(`${name} is missing no tasks.* key`, () => {
            const missing = Object.keys(EN).filter((k) => !(k in L) || L[k].trim() === "");
            expect(missing, `${name} lacks ${missing.length} keys`).toEqual([]);
        });

        it(`${name} keeps the same {placeholders} as English`, () => {
            const bad = Object.keys(EN).filter(
                (k) => k in L && placeholders(L[k]).join() !== placeholders(EN[k]).join()
            );
            expect(bad).toEqual([]);
        });
    }

    it("no locale carries a tasks.* key that English does not have", () => {
        for (const [name, catalog] of Object.entries(OTHERS)) {
            const extra = Object.keys(leaves((catalog as { tasks?: unknown }).tasks)).filter(
                (k) => !(k in EN)
            );
            expect(extra, `${name} has keys English lacks`).toEqual([]);
        }
    });

    it("Arabic is translated, not English copied under an Arabic key", () => {
        const L = leaves(ar.tasks);
        const english = Object.keys(EN).filter(
            (k) => L[k] === EN[k] && /[A-Za-z]{3,}/.test(EN[k]) && !SAME_AS_ENGLISH_OK.has(k)
        );
        expect(english).toEqual([]);
    });
});

/** The keys this PR added or filled in, so a translation that is just the English fails. */
const PR_KEYS = [
    "dashboard.currentProject",
    "dashboard.selectProjectForAnalytics",
    "dashboard.tabOverall",
    "dashboard.tabSprint",
    "dashboard.tabMyTasks",
    "dashboard.tabMemberTasks",
    "dashboard.newTask",
    "dashboard.sprintProgress",
    "dashboard.sprintClosedOfTotal",
    "dashboard.chipMilestones",
    "dashboard.chipTasks",
    "dashboard.chipDone",
    "dashboard.chipRemaining",
    "dashboard.upNext.title",
    "dashboard.upNext.allClosed",
    "dashboard.assigneeWorkload",
    "dashboard.tagInsights",
    "dashboard.tags.colTag",
    "dashboard.tags.colItems",
    "dashboard.tags.colProgress",
    "dashboard.sectionsAriaLabel",
    "layout.noProjectTitle",
    "layout.noProjectBody",
    "layout.createProject",
    "table.loadingTasks",
    "table.emptyTitle",
    "table.emptyHint",
    "table.addTagsPlaceholder",
    "table.addTagsMenuItem",
    "board.quickAddTooltip",
    "board.quickAddPlaceholder",
    "board.quickAddHiddenByFilters",
    "folders.newFolder",
    "folders.deleteBody",
    "fields.folder",
    "activity.restore.confirmBody",
];

/** A word a locale deliberately keeps (a loanword that is the usual UI term there). */
const KEPT: Record<string, string[]> = {
    fr: ["dashboard.tags.colTag"],
};

describe("tasks catalog: the keys of the Arabic/toolbar pass are translated everywhere", () => {
    it("English has them all", () => {
        for (const k of PR_KEYS) expect(EN[k], k).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} translated them (not the English text)`, () => {
            const L = leaves((catalog as { tasks?: unknown }).tasks);
            const same = PR_KEYS.filter((k) => L[k] === EN[k] && !KEPT[name]?.includes(k));
            expect(same).toEqual([]);
        });
    }
});

// ---------------------------------------------------------------------------------------
// No literal English in the toolbar / board / dashboard components.
// ---------------------------------------------------------------------------------------

const TASKS = join(SRC, "features", "tasks", "components");
const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
    });

/**
 * Files NOT scanned: they still carry literal English (the "Sprint" / "Milestone" /
 * "Member" labels, "Filters", "Add tags", ...) and are being converted separately (MIP-1135
 * part 2). Remove an entry when its file is done so the guard covers it too.
 */
const NOT_YET = new Set([
    "table/TaskFilterMenu.tsx",
    "table/SavedFiltersMenu.tsx",
    "table/filterBarParts.tsx",
    "table/DraggableTaskRow.tsx",
    "table/QuickAddTaskRow.tsx",
    "table/cellEditors.tsx",
]);

const jsxTextLiterals = (file: string): string[] => {
    const sf = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    const found: string[] = [];
    const visit = (n: ts.Node) => {
        if (ts.isJsxText(n)) {
            const text = n.getText().replace(/\s+/g, " ").trim();
            if (/[A-Za-z]{2,}/.test(text)) found.push(text);
        }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return found;
};

describe("toolbar / board / dashboard components render no literal English", () => {
    const files = ["board", "dashboard", "header", "layout", "sidebar", "table"].flatMap((d) =>
        walk(join(TASKS, d))
    );
    for (const file of files) {
        const rel = file.slice(TASKS.length + 1);
        if (NOT_YET.has(rel)) continue;
        it(rel, () => {
            expect(jsxTextLiterals(file)).toEqual([]);
        });
    }
});

// ---------------------------------------------------------------------------------------
// A person's name keeps its reading order in RTL. jsdom has no bidi algorithm, so this pins
// the markup that makes the browser do it (checked in a real browser, see the PR).
// ---------------------------------------------------------------------------------------

describe("names are bidi-isolated", () => {
    const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
    /** The element that renders `expr` must carry dir="auto", or the name sits in a <bdi>. */
    const isolated = (src: string, expr: string) => {
        // The rendered occurrence: alone on its line, or the body of a <bdi>.
        const bdi = src.indexOf(`<bdi>${expr}</bdi>`);
        if (bdi > -1) return true;
        const m = new RegExp(`\\n\\s*${expr.replace(/[{}.|]/g, "\\$&")}\\n`).exec(src);
        expect(m, `${expr} not found as rendered text`).not.toBeNull();
        const open = src.lastIndexOf("<Typography", m!.index);
        return open > -1 && src.slice(open, m!.index).includes('dir="auto"');
    };

    const CASES: [string, string[]][] = [
        [
            "features/tasks/components/board/SprintBoardCard.tsx",
            ["{assigneeName || t.tasks.board.unassigned}"],
        ],
        ["features/tasks/components/dashboard/TaskVelocitySection.tsx", ["{m.name}"]],
        ["features/tasks/components/autocompletes/MultiMemberPicker.tsx", ["{user.userName}"]],
        ["features/tasks/components/contents/base/CustomFieldsBlock.tsx", ["{option.userName}"]],
        ["features/tasks/components/modals/ModalCreateProject.tsx", ["{member.userName}"]],
        [
            "features/tasks/components/dashboard/TaskHomeContent.tsx",
            ["{selectedMember.name}", "{o.name}", "{m.name}", "{a.name}"],
        ],
    ];
    for (const [file, exprs] of CASES) {
        it(file.split("/").pop()!, () => {
            const src = read(file);
            for (const expr of exprs) {
                expect(isolated(src, expr), `${expr} in ${file}`).toBe(true);
            }
        });
    }
});

describe("ResolvedUserName (the name in every table row, comment and milestone card)", () => {
    it("is a <bdi> island that RTL CSS lets truncate itself", () => {
        const { container } = render(
            <ResolvedUserName fallbackName="(DY) Ken Kamiya" userId={null} />
        );
        const bdi = container.querySelector("bdi.g-person-name");
        expect(bdi?.textContent).toBe("(DY) Ken Kamiya");
        // jsdom has no layout: pin the rule that does the truncating at the island's own end.
        const css = readFileSync(join(SRC, "App.css"), "utf8").replace(/\s+/g, " ");
        expect(css).toMatch(
            /\[dir="rtl"\] \.g-person-name \{[^}]*display: inline-block;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/
        );
    });
});

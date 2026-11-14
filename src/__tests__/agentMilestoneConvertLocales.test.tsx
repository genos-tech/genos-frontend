/**
 * The strings of the milestone convert and move cards (`agentApproval.milestoneAction.convert_*`,
 * `.move`, `convert*` and `move*`; MIP-1564) in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the loader merges every missing
 * key onto English, so a locale that FORGOT a key type-checks, renders, and shows an English sentence in
 * a Japanese card. These read the raw catalogs so the merge cannot hide a gap (as `agentUndoLocales`
 * does), and then render the real card in each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { I18nProvider, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

const FLAT = [
    "convertKeeps",
    "convertSubTasksJoin",
    "convertTasksStay",
    "convertAssignee",
    "convertCollaborators",
    "convertFolderDropped",
    "convertSprintDropped",
    "moveProject",
    "moveTasks",
    "moveSprintCleared",
    "moveFolderCleared",
    "moveTagsCleared",
    "moveRenumbered",
] as const;
const ACTIONS = ["convert_to_milestone", "convert_to_task", "move"] as const;

type Catalog = {
    agentApproval?: {
        milestoneAction?: Record<string, string>;
    } & Record<string, unknown>;
};
const read = (catalog: Catalog, key: string): string | undefined =>
    (ACTIONS as readonly string[]).includes(key)
        ? catalog.agentApproval?.milestoneAction?.[key]
        : (catalog.agentApproval?.[key] as string | undefined);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
const KEYS = [...ACTIONS, ...FLAT];

describe("the convert and move strings have every key in every locale", () => {
    it("English has all of them, filled in", () => {
        for (const key of KEYS) expect(read(en as Catalog, key)?.trim()).toBeTruthy();
    });

    it.each(NAMES)("%s defines every key English has", (name) => {
        const missing = KEYS.filter((k) => !read(OTHERS[name] as Catalog, k));
        expect({ locale: name, missing }).toEqual({ locale: name, missing: [] });
    });

    it.each(NAMES)("%s is translated, not pasted from English", (name) => {
        const untouched = KEYS.filter(
            (k) => read(OTHERS[name] as Catalog, k) === read(en as Catalog, k)
        );
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the card fills in", (name) => {
        const broken = KEYS.filter((k) => {
            const own = read(OTHERS[name] as Catalog, k);
            const english = read(en as Catalog, k) ?? "";
            return own === undefined || placeholders(own).join() !== placeholders(english).join();
        });
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe.each(LOCALES)("in %s", (locale) => {
    const card = async (args: Record<string, unknown>) => {
        const msgs = await loadLocale(locale);
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        const view = render(
            <CssVarsProvider>
                <I18nProvider>
                    <ApprovalCard
                        approveLabel="APPROVE"
                        rejectLabel="REJECT"
                        titleText="TITLE"
                        pending={{
                            step: 1,
                            tool_name: "manage_milestone",
                            arguments: args,
                            undoable: false,
                            undo_reason: "no_snapshot",
                            approval_token: "t",
                            run_id: "r",
                        }}
                        onApprove={() => {}}
                        onReject={() => {}}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        return { msgs, text: view.container.textContent ?? "" };
    };

    it("a convert to a milestone card is in that language", async () => {
        const { msgs, text } = await card({
            action: "convert",
            task_id: "WRD-7",
            current: {
                direction: "task_to_milestone",
                title: "Plan",
                display_id: "WRD-7",
                sub_tasks: 3,
            },
        });
        expect(text).toContain(msgs.agentApproval.convertKeeps);
        expect(text).toContain("WRD-7 Plan");
        expect(text).toContain("3");
        // not the English heading in another language's card
        if (locale !== "en") expect(text).not.toContain("Turn into a milestone");
    });

    it("a convert to a task card names what stays and what is dropped, in that language", async () => {
        const { msgs, text } = await card({
            action: "convert",
            milestone_id: "Launch",
            current: {
                direction: "milestone_to_task",
                title: "Launch",
                tasks: 2,
                assignee: "alice",
                collaborators: ["bob"],
                folder: "Roadmap",
                sprint: "S1",
            },
        });
        expect(text).toContain(msgs.agentApproval.convertKeeps);
        expect(text).toContain("Roadmap");
        expect(text).toContain("S1");
        expect(text).toContain("bob");
        if (locale !== "en") expect(text).not.toContain("Turn into a task");
    });

    it("a move card says where it goes, in that language", async () => {
        const { msgs, text } = await card({
            action: "update",
            milestone_id: "Launch",
            project_id: "Archive",
            current: {
                project_id: "Website",
                move: { tasks: 5, sprint: "S1", folder: "Roadmap", tags: ["q4"] },
            },
        });
        expect(text).toContain(msgs.agentApproval.moveRenumbered);
        expect(text).toContain("Website");
        expect(text).toContain("Archive");
        if (locale !== "en") expect(text).not.toContain("Move milestone");
    });
});

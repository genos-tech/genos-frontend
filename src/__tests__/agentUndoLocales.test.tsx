/**
 * Undo's strings (`agentApproval.undo.*`) in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the loader
 * merges every missing key onto English, so a locale that FORGOT a key type-checks,
 * renders, and shows an English sentence in a Japanese card. These read the raw
 * catalogs so the merge cannot hide a gap (as `agentApprovalEditLocales` and
 * `agentTurnLocales` do), and then render the real chip and the real control in
 * each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTurn } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { undoOutcomeText, undoRefusalText } from "../features/agentQA/undoCopy";
import { resetUndoStore, runUndo } from "../features/agentQA/undoStore";
import { I18nProvider, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import { UNDO_REASONS, type UndoRefusalCode } from "../services/agentApi";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };
const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};
const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const PREFIX = "agentApproval.undo";
const enUndo = leaves(en.agentApproval.undo, [PREFIX]);

// The same in the language, by its own spelling (not a missing translation).
const SAME: Partial<Record<keyof typeof OTHERS, string[]>> = {
    es: [`${PREFIX}.listSeparator`],
    fr: [`${PREFIX}.listSeparator`],
    hi: [`${PREFIX}.listSeparator`],
};

describe("agentApproval.undo has every string in every locale", () => {
    it("has a catalog worth testing", () => {
        expect(enUndo.length).toBeGreaterThan(40);
        expect(enUndo.every(([, text]) => text.trim() !== "")).toBe(true);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].agentApproval?.undo, [PREFIX]).map(([p]) => p);
        const wanted = enUndo.map(([p]) => p);
        expect({ locale: name, missing: wanted.filter((p) => !own.includes(p)) }).toEqual({
            locale: name,
            missing: [],
        });
        expect({ locale: name, extra: own.filter((p) => !wanted.includes(p)) }).toEqual({
            locale: name,
            extra: [],
        });
    });

    it.each(NAMES)("%s is translated, not pasted from English", (name) => {
        const untouched = enUndo
            .filter(([p, text]) => text.length > 12 && lookup(OTHERS[name], p) === text)
            .map(([p]) => p);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
        const sameShort = enUndo
            .filter(([p, text]) => text.length <= 12 && lookup(OTHERS[name], p) === text)
            .map(([p]) => p)
            .filter((p) => !SAME[name]?.includes(p));
        expect({ locale: name, sameShort }).toEqual({ locale: name, sameShort: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const broken = enUndo
            .filter(([p, text]) => {
                const own = lookup(OTHERS[name], p);
                return own === undefined || placeholders(own).join() !== placeholders(text).join();
            })
            .map(([p]) => p);
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });
});

describe("the catalog covers what the code can ask for", () => {
    it("a sentence for every reason code the card words", () => {
        expect(Object.keys(en.agentApproval.undo.reasons).sort()).toEqual(
            [...UNDO_REASONS].sort()
        );
    });

    it("a sentence for every refusal code, bar `unknown` (which has the generic one)", () => {
        const codes: UndoRefusalCode[] = [
            "not_found",
            "not_undoable",
            "already_undone",
            "changed_since",
            "expired",
            "permission_lost",
            "throttled",
            "unauthorized",
            "network",
            "server",
            "unknown",
        ];
        const have = new Set(Object.keys(en.agentApproval.undo.refused));
        expect(codes.filter((c) => !have.has(c))).toEqual([]);
    });

    it("a tooltip for every tool that can be undone, plus the fallback", () => {
        // genos-api `agent/undo.py` `HANDLERS`.
        expect(Object.keys(en.agentApproval.undo.hints).sort()).toEqual(
            [
                "add_comment",
                "create_note",
                "create_task",
                "fallback",
                "restore_note_version",
                "restore_task_body",
                "update_note",
                "update_task",
            ].sort()
        );
    });

    it("a tool phrase exists for every tool that can be undone (the control's label when there are several)", () => {
        const names = en.agentApproval.toolNames as Record<string, string>;
        for (const tool of [
            "create_task",
            "update_task",
            "restore_task_body",
            "add_comment",
            "create_note",
            "update_note",
            "restore_note_version",
        ]) {
            expect(names[tool]).toBeTruthy();
        }
    });

    it("a word for every field an undo can report", () => {
        const fields = en.agentApproval.fieldLabels as Record<string, string>;
        for (const f of ["status", "priority", "effort_level", "due_date", "start_date", "tags"]) {
            expect(fields[f]).toBeTruthy();
        }
        expect(en.agentApproval.undo.fields.title).toBeTruthy();
        expect(en.agentApproval.undo.fields.body).toBeTruthy();
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];
const UNTIL = new Date(Date.now() + 5 * 86_400_000).toISOString();

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});
beforeEach(() => {
    resetUndoStore();
});
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
});

describe.each(LOCALES)("in %s", (locale) => {
    it("the chip and its reason are in that language", async () => {
        const msgs = await loadLocale(locale);
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <ApprovalCard
                        approveLabel="APPROVE"
                        rejectLabel="REJECT"
                        titleText="TITLE"
                        pending={{
                            step: 1,
                            tool_name: "delete_note",
                            arguments: { note_id: 5 },
                            undoable: false,
                            undo_reason: "irreversible_delete",
                            approval_token: "t",
                            run_id: "r",
                        }}
                        onApprove={() => {}}
                        onReject={() => {}}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        const chip = screen.getByTestId("undo-chip");
        expect(chip.textContent).toContain(msgs.agentApproval.undo.chip);
        expect(chip.textContent).toContain(msgs.agentApproval.undo.reasons.irreversible_delete);
    });

    it("the control, its outcome and its refusal are in that language", async () => {
        const msgs = await loadLocale(locale);
        const labels = buildAgentTurnLabels(msgs, "spotlight");
        const answer = {
            run_id: "r",
            step_id: 4711,
            tool_name: "update_task",
            undone_at: "x",
            action: "restored",
            restored: ["status", "title"],
            skipped: [],
            entity: { kind: "task", task_id: 1, project_id: 2, display_id: "PRJ-1" },
            summary: "SERVER ENGLISH",
        };
        const reply = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => answer,
        })) as unknown as typeof fetch;
        vi.stubGlobal("fetch", reply);

        render(
            <CssVarsProvider>
                <AgentTurn
                    answer="A"
                    answerSources={[]}
                    askedQuery="Q"
                    askError={null}
                    isCurrent={false}
                    labels={labels}
                    runId="r"
                    toolEvents={[
                        {
                            step: 2,
                            tool_name: "update_task",
                            arguments: {},
                            status: "done",
                            summary: "s",
                            undo: { step_id: 4711, available_until: UNTIL, run_id: "r" },
                        },
                    ]}
                    onPreview={() => {}}
                    onUndo={(r) => void runUndo({ ...r, accessToken: "t" })}
                />
            </CssVarsProvider>
        );
        const button = screen.getByRole("button", { name: msgs.agentApproval.undo.button });
        fireEvent.click(button);
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        const line = screen.getByRole("status").textContent ?? "";
        expect(line).not.toContain("SERVER ENGLISH");
        expect(line).toContain(msgs.agentApproval.undo.notRecalled);
        // The words for the fields it put back are that language's own.
        expect(line).toContain(msgs.agentApproval.undo.fields.title);
        expect(line).toContain((msgs.agentApproval.fieldLabels as Record<string, string>).status);
    });

    it("every refusal code has a sentence of its own in that language", async () => {
        const msgs = await loadLocale(locale);
        const seen = new Set<string>();
        for (const code of [
            "not_found",
            "not_undoable",
            "already_undone",
            "changed_since",
            "expired",
            "permission_lost",
            "throttled",
            "unauthorized",
            "network",
            "server",
        ] as const) {
            const text = undoRefusalText(msgs, {
                code,
                status: 0,
                message: "SERVER ENGLISH",
                skipped: [],
                detail: null,
                retryable: false,
            });
            expect(text).not.toContain("SERVER ENGLISH");
            seen.add(text);
        }
        expect(seen.size).toBe(10);
    });

    it("a delete names what it removed, in that language", async () => {
        const msgs = await loadLocale(locale);
        const text = undoOutcomeText(msgs, {
            run_id: "r",
            step_id: 1,
            tool_name: "create_task",
            undone_at: "x",
            action: "deleted",
            restored: [],
            skipped: [],
            entity: { kind: "task", task_id: 1, project_id: 2, display_id: "PRJ-12" },
            summary: "SERVER ENGLISH",
        });
        expect(text).toContain("PRJ-12");
        expect(text).not.toContain("SERVER ENGLISH");
    });
});

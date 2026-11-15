/**
 * Every kind the server can put in `dropped_references` has its own calm sentence (genos-api #909,
 * `/decide/` re-reads each mentioned object with the asker's CURRENT access, behind the server's
 * `AGENT_PARITY_FOLLOWUPS` flag).
 *
 * THE LIST (genos-api, read on the `MIP-1590-model-visible-hardening` branch, which carries #906/#907):
 *   - `agent_views.py` /ask/ (~1567, 1571, 1581): `message`, `selection`, `selected_from`;
 *   - `task_context.rebuild` (~322) and the exception path of `_resumed_context` (~2327): `task`;
 *   - `ask_refs.rebuild` (~387) and the same exception path: `message`;
 *   - `mentions.rebuild_block` (~1207): the kind of each mention that cannot be read at the decision,
 *     `_VALID_TYPES` (mentions.py ~83) minus `_NO_BULLET_KINDS` (~96): `user`, `task`, `note`, `chat`,
 *     `project`, `group`, `todo`, `calendar_event`.
 * Eleven distinct words. Before this change the client kept the first four and silently dropped the
 * other seven when it parsed the event, so the member got no note for a mention lost at the approval.
 *
 * The server's rule: the SAME word for a thing that is missing, unreadable or deleted (no existence
 * oracle), so no sentence says why, and none says "could not read" or "deleted".
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useAgentQA, type UseAgentQAReturn } from "../features/agentQA";
import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import {
    droppedReferenceNotices,
    mergeDroppedReferences,
    type DroppedLabels,
} from "../features/agentQA/droppedReferences";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { getMessages, loadLocale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import {
    asDroppedReferences,
    askAgentStream,
    decideAgent,
    DROPPED_REFERENCES,
    type DroppedReference,
} from "../services/agentApi";

beforeAll(async () => {
    await loadLocale("ja");
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
});

/** The server's eleven, as a literal: a kind added there must be added here on purpose. */
const SERVER_KINDS = [
    "message",
    "selection",
    "selected_from",
    "task",
    "note",
    "project",
    "chat",
    "group",
    "user",
    "todo",
    "calendar_event",
] as const;

/** The kinds this change adds: what `/decide/` can now report for a mention it cannot use. */
const NEW_KINDS = [
    "note",
    "project",
    "chat",
    "group",
    "user",
    "todo",
    "calendar_event",
] as const satisfies readonly DroppedReference[];

/** The label key of each kind in `spotlight.dropped` (a kind is snake_case, a key camelCase). */
const KEY_OF: Record<(typeof NEW_KINDS)[number], keyof DroppedLabels> = {
    note: "note",
    project: "project",
    chat: "chat",
    group: "group",
    user: "user",
    todo: "todo",
    calendar_event: "calendarEvent",
};

const LABELS: DroppedLabels = {
    message: "ONE-MESSAGE",
    messages: "SOME-MESSAGES",
    selection: "SELECTION",
    selectedFrom: "SELECTED-FROM",
    task: "TASK",
    note: "NOTE",
    project: "PROJECT",
    chat: "CHAT",
    group: "GROUP",
    user: "USER",
    todo: "TODO",
    calendarEvent: "CALENDAR-EVENT",
};

const CATALOGS = { en, ja, zh, es, fr, hi, ar } as const;
type LocaleName = keyof typeof CATALOGS;
const NAMES = Object.keys(CATALOGS) as LocaleName[];

// ---------------------------------------------------------------------------------------------
// The kinds the client knows
// ---------------------------------------------------------------------------------------------

describe("the kinds the client knows", () => {
    it("are exactly the server's eleven", () => {
        expect([...DROPPED_REFERENCES].sort()).toEqual([...SERVER_KINDS].sort());
    });

    it.each(SERVER_KINDS)("keeps %s when the event carries it", (kind) => {
        expect(asDroppedReferences([kind])).toEqual([kind]);
    });

    it("keeps each once, in the server's order, and ignores a word that is not a kind", () => {
        expect(
            asDroppedReferences(["note", "task", "note", "project", "mystery", 7, null])
        ).toEqual(["note", "task", "project"]);
        expect(asDroppedReferences(["mystery"])).toBeUndefined();
        expect(asDroppedReferences([])).toBeUndefined();
        expect(asDroppedReferences(undefined)).toBeUndefined();
    });

    it("does not take an inherited property name for a kind", () => {
        expect(asDroppedReferences(["constructor", "toString", "__proto__"])).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------------------------
// The two events that carry them
// ---------------------------------------------------------------------------------------------

const ndjson = (events: unknown[]): Response => {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
    let sent = false;
    return {
        ok: true,
        body: {
            getReader: () => ({
                read: async () =>
                    sent
                        ? { value: undefined, done: true as const }
                        : ((sent = true), { value: payload, done: false as const }),
                releaseLock() {},
            }),
        },
    } as unknown as Response;
};

const CARD = {
    type: "tool_call_pending_approval",
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: 7, body: "hi" },
    editable: ["body"],
    approval_token: "ap-1",
    run_id: "run-1",
};

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onPendingApproval: vi.fn(),
});

describe("the card's event and the resumed done", () => {
    it("the card hands over a mention kind the decision lost, after the ask's own", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ndjson([{ ...CARD, dropped_references: ["message", "note"] }]))
        );
        const h = handlers();
        await askAgentStream({ query: "q", teamId: "team-1", accessToken: "tok", ...h });
        expect(h.onPendingApproval.mock.calls[0][1]).toEqual(["message", "note"]);
    });

    it("the resumed done hands over what /decide/ named, as the server gave it", async () => {
        // The shape in api #909's tests: `["task"]` and `["note", "project"]`.
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                ndjson([
                    {
                        type: "done",
                        session_id: "s1",
                        run_id: "run-1",
                        dropped_references: ["note", "project"],
                    },
                ])
            )
        );
        const h = handlers();
        await decideAgent({
            runId: "run-1",
            approvalToken: "ap-1",
            decision: "approve",
            accessToken: "tok",
            ...h,
        });
        expect(h.onDone).toHaveBeenCalledWith("s1", "run-1", undefined, ["note", "project"]);
    });

    it("with the server flag off there is no field and nothing reaches the handlers", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ndjson([{ type: "done", session_id: "s1", run_id: "run-1" }]))
        );
        const h = handlers();
        await decideAgent({
            runId: "run-1",
            approvalToken: "ap-1",
            decision: "approve",
            accessToken: "tok",
            ...h,
        });
        expect(h.onDone.mock.calls[0]).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------------------------
// One sentence per kind
// ---------------------------------------------------------------------------------------------

describe("droppedReferenceNotices", () => {
    it.each(NEW_KINDS)("%s is its own sentence, and only that", (kind) => {
        expect(droppedReferenceNotices([kind], undefined, LABELS)).toEqual([LABELS[KEY_OF[kind]]]);
    });

    it("every kind of the server maps to a different sentence", () => {
        const said = SERVER_KINDS.map((kind) =>
            droppedReferenceNotices([kind], undefined, LABELS)
        );
        for (const one of said) expect(one).toHaveLength(1);
        expect(new Set(said.map((s) => s[0])).size).toBe(SERVER_KINDS.length);
    });

    it("says each kind of a list, in the server's order", () => {
        expect(
            droppedReferenceNotices(["note", "task", "calendar_event", "user"], undefined, LABELS)
        ).toEqual(["NOTE", "TASK", "CALENDAR-EVENT", "USER"]);
    });

    it("does not depend on how many messages the turn pointed at", () => {
        const m = (id: string) => ({ kind: "message" as const, messageId: id, label: id });
        expect(droppedReferenceNotices(["note"], [m("a"), m("b")], LABELS)).toEqual(["NOTE"]);
    });

    it("says nothing for a kind it does not know, even when one is handed in", () => {
        const unknown = [
            "mystery",
            "note",
            "constructor",
            "__proto__",
            "toString",
        ] as unknown as DroppedReference[];
        expect(droppedReferenceNotices(unknown, undefined, LABELS)).toEqual(["NOTE"]);
        expect(
            droppedReferenceNotices(["mystery" as DroppedReference], undefined, LABELS)
        ).toEqual([]);
    });

    it("never puts an undefined entry on screen, even for a catalog that lacks a sentence", () => {
        const gap = { ...LABELS, note: undefined } as unknown as DroppedLabels;
        const said = droppedReferenceNotices(["note", "project"], undefined, gap);
        expect(said).toEqual(["PROJECT"]);
        expect(said.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
    });

    it("never puts a blank line on screen either, for a catalog whose sentence is empty", () => {
        const blank = { ...LABELS, note: "" } as DroppedLabels;
        expect(droppedReferenceNotices(["note", "project"], undefined, blank)).toEqual([
            "PROJECT",
        ]);
    });

    it("says nothing for no list and for an empty one (the server flag off sends no field)", () => {
        expect(droppedReferenceNotices(undefined, undefined, LABELS)).toEqual([]);
        expect(droppedReferenceNotices([], undefined, LABELS)).toEqual([]);
    });
});

describe("mergeDroppedReferences with the new kinds", () => {
    it("holds each kind once when the card and the resumed done carry the same one", () => {
        const card: DroppedReference[] = ["message", "note"];
        expect(mergeDroppedReferences(card, ["message", "note"])).toBe(card);
        expect(mergeDroppedReferences(card, ["note", "project"])).toEqual([
            "message",
            "note",
            "project",
        ]);
    });
});

// ---------------------------------------------------------------------------------------------
// The real catalogs
// ---------------------------------------------------------------------------------------------

// Words that would say WHY, or that the member never has to think about. English only: the other
// catalogs are pinned by the noun checks below and by the distinct-sentence check.
const WHY = /\b(read|deleted|missing|removed|access|permission|found|undefined)\b/i;

/** What each sentence must name, per locale: the glossary's (or the app's) word for the kind. */
const NOUNS: Record<LocaleName, Record<(typeof NEW_KINDS)[number], string>> = {
    en: {
        note: "note",
        project: "project",
        chat: "chat",
        group: "group",
        user: "person",
        todo: "to-do",
        calendar_event: "calendar event",
    },
    ja: {
        note: "ノート",
        project: "プロジェクト",
        chat: "チャット",
        group: "グループ",
        user: "ユーザー",
        todo: "To-Do",
        calendar_event: "予定",
    },
    zh: {
        note: "笔记",
        project: "项目",
        chat: "聊天",
        group: "群组",
        user: "用户",
        todo: "待办事项",
        calendar_event: "日历事件",
    },
    es: {
        note: "nota",
        project: "proyecto",
        chat: "chat",
        group: "grupo",
        user: "persona",
        todo: "pendiente",
        calendar_event: "evento de calendario",
    },
    fr: {
        note: "note",
        project: "projet",
        chat: "conversation",
        group: "groupe",
        user: "personne",
        todo: "À faire",
        calendar_event: "événement d'agenda",
    },
    hi: {
        note: "नोट",
        project: "प्रोजेक्ट",
        chat: "चैट",
        group: "समूह",
        user: "व्यक्ति",
        todo: "टू-डू",
        calendar_event: "कैलेंडर इवेंट",
    },
    ar: {
        note: "ملاحظة",
        project: "مشروع",
        chat: "محادثة",
        group: "مجموعة",
        user: "شخص",
        todo: "قائمة المهام",
        calendar_event: "التقويم",
    },
};

const sentencesOf = (name: LocaleName) =>
    (CATALOGS[name].spotlight?.dropped ?? {}) as Record<string, string | undefined>;

describe.each(NAMES)("the sentences in %s", (name) => {
    it("has one for every kind the server can report, each naming Genos", () => {
        const dropped = sentencesOf(name);
        for (const kind of NEW_KINDS) {
            const sentence = dropped[KEY_OF[kind]];
            expect(sentence?.trim(), `${name}.${kind}`).toBeTruthy();
            expect(sentence, `${name}.${kind}`).toContain("Genos");
        }
    });

    it("gives every kind a sentence of its own (a copy-paste is caught)", () => {
        const dropped = sentencesOf(name);
        const all = [
            "message",
            "selection",
            "selectedFrom",
            "task",
            ...NEW_KINDS.map((k) => KEY_OF[k]),
        ].map((key) => dropped[key]);
        expect(new Set(all).size).toBe(all.length);
    });

    it("names the kind in the app's own word", () => {
        const dropped = sentencesOf(name);
        for (const kind of NEW_KINDS) {
            expect(dropped[KEY_OF[kind]]?.toLowerCase(), `${name}.${kind}`).toContain(
                NOUNS[name][kind].toLowerCase()
            );
        }
    });

    it("is one sentence, with no placeholder in it", () => {
        const dropped = sentencesOf(name);
        for (const kind of NEW_KINDS) {
            const sentence = dropped[KEY_OF[kind]] ?? "";
            expect(sentence, `${name}.${kind}`).not.toMatch(/[{}]/);
            expect(sentence.trim(), `${name}.${kind}`).toBe(sentence);
            expect(
                sentence.split(/[.。]/).filter((s) => s.trim()),
                `${name}.${kind}`
            ).toHaveLength(1);
        }
    });
});

describe("the English sentences", () => {
    it.each(NEW_KINDS)("%s says 'could not use' and never why", (kind) => {
        const sentence = en.spotlight.dropped[KEY_OF[kind]];
        expect(sentence).toMatch(/^Genos could not use /);
        expect(sentence).toMatch(/so it answered without /);
        // The server gives ONE value for missing, unreadable and deleted: no existence oracle.
        expect(sentence).not.toMatch(WHY);
    });

    it("is plural-neutral: an indefinite thing, never 'the' one, never a count", () => {
        for (const kind of NEW_KINDS) {
            const sentence = en.spotlight.dropped[KEY_OF[kind]];
            expect(sentence, kind).toMatch(/could not use an? /);
            expect(sentence, kind).not.toMatch(/\b(the|some|all|both|\d+)\b/i);
        }
    });
});

// ---------------------------------------------------------------------------------------------
// What a member sees
// ---------------------------------------------------------------------------------------------

const labelsEn = () => buildAgentTurnLabels(getMessages("en"), "spotlight");

const renderTurn = (over: Partial<AgentTurnProps> = {}) => {
    const props: AgentTurnProps = {
        askedQuery: "What changed in this note?",
        answer: "Nothing yet.",
        answerSources: [],
        askError: null,
        isCurrent: false,
        labels: labelsEn(),
        toolEvents: [],
        onPreview: vi.fn(),
        ...over,
    };
    return render(
        <CssVarsProvider>
            <AgentTurn {...props} />
        </CssVarsProvider>
    );
};

describe("the note under an answer", () => {
    it.each(NEW_KINDS)("%s reads as its own calm sentence", (kind) => {
        renderTurn({ droppedReferences: [kind] });
        const note = screen.getByRole("status");
        expect(note.textContent).toBe(en.spotlight.dropped[KEY_OF[kind]]);
        expect(note.textContent).not.toMatch(WHY);
        expect(note.textContent).not.toContain("undefined");
    });

    it("says one sentence per kind of a mixed list, in order", () => {
        renderTurn({ droppedReferences: ["task", "note", "project"] });
        expect(screen.getByRole("status").textContent).toBe(
            `${en.spotlight.dropped.task}${en.spotlight.dropped.note}${en.spotlight.dropped.project}`
        );
    });

    it("says it in the member's language", () => {
        renderTurn({
            labels: buildAgentTurnLabels(getMessages("ja"), "spotlight"),
            droppedReferences: ["note"],
        });
        const ja = getMessages("ja").spotlight.dropped.note;
        expect(screen.getByRole("status").textContent).toBe(ja);
        expect(ja).not.toBe(en.spotlight.dropped.note);
    });

    it("shows nothing for a kind it does not know", () => {
        renderTurn({ droppedReferences: ["mystery"] as unknown as DroppedReference[] });
        expect(screen.queryByRole("status")).toBeNull();
        expect(document.body.textContent).not.toContain("undefined");
    });

    it("shows only the known sentences of a list that also holds an unknown kind", () => {
        renderTurn({ droppedReferences: ["mystery", "note"] as unknown as DroppedReference[] });
        const note = screen.getByRole("status");
        expect(note.textContent).toBe(en.spotlight.dropped.note);
        expect(note.textContent).not.toContain("undefined");
    });

    it("shows nothing with the server flag off (no field), and nothing for an empty list", () => {
        renderTurn({});
        expect(screen.queryByRole("status")).toBeNull();
        cleanup();
        renderTurn({ droppedReferences: [] });
        expect(screen.queryByRole("status")).toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// The whole path: the card and the resumed done name the same kind
// ---------------------------------------------------------------------------------------------

const noteAskModal = (agentQA: UseAgentQAReturn) => {
    const state = {
        isOpen: true,
        open: vi.fn(),
        close: vi.fn(),
        noteContext: { noteType: 1, noteId: 5 },
        summary: {
            text: "A note about the launch.",
            lastUpdatedIso: "2026-07-29T09:00:00Z",
            fingerprint: "fp-1",
            bodyLength: 120,
            noteTitle: "Launch",
        },
        summaryLoading: false,
        summaryError: null,
        refreshSummary: vi.fn(),
        staleSummary: false,
        agentQA,
    } as unknown as UseNoteAskReturn;
    return (
        <CssVarsProvider>
            <NoteAskModal state={state} onSelectSource={vi.fn()} />
        </CssVarsProvider>
    );
};

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return { ...actual, AgentQAInput: () => <div data-testid="qa-input" /> };
});

const mountWholePath = (askEvents: unknown[], decideEvents: unknown[]) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
            ndjson(String(url).includes("/agent/decide/") ? decideEvents : askEvents)
        )
    );
    let hook: UseAgentQAReturn | null = null;
    const Harness = () => {
        const agentQA = useAgentQA({ accessToken: "tok", teamId: "team-1" });
        hook = agentQA;
        return noteAskModal(agentQA);
    };
    render(<Harness />);
    return async () => {
        await act(async () => {
            hook?.onAsk("Reply to this", []);
        });
    };
};

const START = { type: "tool_call_start", step: 1, tool_name: "add_comment", arguments: {} };
const CARD_EVENT = { ...CARD, arguments: { task_id: 12, body: "Done" }, editable: [] };

const approve = async () => {
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("Added.")).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).toBeNull());
};

describe("the whole path, with the real stream parser and the real hook", () => {
    it("a kind the card and the resumed done both carry is said once", async () => {
        const ask = mountWholePath(
            [START, { ...CARD_EVENT, dropped_references: ["note"] }],
            [
                { type: "answer_delta", text: "Added." },
                { type: "done", session_id: "s1", run_id: "run-1", dropped_references: ["note"] },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
        expect(screen.getByRole("status").textContent).toBe(en.spotlight.dropped.note);
        await approve();
        const notes = screen.getAllByRole("status");
        expect(notes).toHaveLength(1);
        expect(notes[0].textContent).toBe(en.spotlight.dropped.note);
    });

    it("a mention lost at the decision (not on the card) adds its sentence to the turn", async () => {
        const ask = mountWholePath(
            [START, CARD_EVENT],
            [
                { type: "answer_delta", text: "Added." },
                {
                    type: "done",
                    session_id: "s1",
                    run_id: "run-1",
                    dropped_references: ["note", "project"],
                },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        expect(screen.queryByRole("status")).toBeNull();
        await approve();
        const notes = screen.getAllByRole("status");
        expect(notes).toHaveLength(1);
        expect(notes[0].textContent).toBe(
            `${en.spotlight.dropped.note}${en.spotlight.dropped.project}`
        );
    });

    it("a card with no field and a done with no field (the flag off) say nothing", async () => {
        const ask = mountWholePath(
            [START, CARD_EVENT],
            [
                { type: "answer_delta", text: "Added." },
                { type: "done", session_id: "s1", run_id: "run-1" },
            ]
        );
        await ask();
        await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy());
        await approve();
        expect(screen.queryByRole("status")).toBeNull();
    });
});

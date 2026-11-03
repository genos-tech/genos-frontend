// The thread and note "Ask" modals render the same 👍/👎 buttons as Spotlight
// (FeedbackThumbs, through AgentQAConversation). Their label sets used to omit
// `feedbackUp` / `feedbackDown`, so FeedbackThumbs fell back to its built-in
// English "Good answer / Needs work" in every language. Both modals now read
// Spotlight's translated labels, and the "Answered in" footnote beside them is
// localized too. These tests render the real conversation under the real
// I18nProvider, in English and Japanese.

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CompletedTurn } from "../features/agentQA";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { I18nProvider, loadLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

// The mention picker drags in the team/task/note stores and isn't under test.
vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return {
        ...actual,
        AgentQAInput: () => <div data-testid="qa-input" />,
    };
});

const finishedTurn: CompletedTurn = {
    id: 1,
    askedQuery: "What did we decide?",
    answer: "We shipped it.",
    answerSources: [],
    toolEvents: [],
    askError: null,
    runId: "run-1",
    elapsedMs: 1800,
};

const agentQA = {
    query: "",
    setQuery: vi.fn(),
    ask: { isStreaming: false, askError: null, answer: "", toolEvents: [], pendingApproval: null },
    turns: [finishedTurn],
    sessionId: "sess-1",
    onAsk: vi.fn(),
    onCancel: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    clearConversation: vi.fn(),
    reset: vi.fn(),
    submitFeedback: vi.fn(),
} as unknown as UseThreadAskReturn["agentQA"];

const threadState = {
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    threadContext: { chatType: 2, chatId: 77, threadId: 404 },
    summary: {
        text: "Ten messages about the launch.",
        lastUpdatedIso: "2026-07-29T09:00:00Z",
        fingerprint: "fp-1",
        messageCount: 10,
    },
    summaryLoading: false,
    summaryError: null,
    refreshSummary: vi.fn(),
    staleSummary: false,
    agentQA,
} as unknown as UseThreadAskReturn;

const noteState = {
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

const renderThread = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <UrlLinkModalProvider value={{ openModalByHref: vi.fn() }}>
                    <ThreadAskModal
                        accessToken="tok"
                        chatName="Launch"
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        state={threadState}
                    />
                </UrlLinkModalProvider>
            </I18nProvider>
        </CssVarsProvider>
    );

const renderNote = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <NoteAskModal state={noteState} />
            </I18nProvider>
        </CssVarsProvider>
    );

const surfaces = [
    ["ThreadAskModal", renderThread],
    ["NoteAskModal", renderNote],
] as const;

afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
});

describe.each(surfaces)("%s feedback labels", (_name, renderModal) => {
    describe("in English", () => {
        beforeEach(async () => {
            localStorage.clear();
            await loadLocale("en");
        });

        it("keeps Spotlight's wording", () => {
            renderModal();
            expect(
                screen.getByRole("button", { name: en.spotlight.actions.feedbackUp })
            ).toBeTruthy();
            expect(
                screen.getByRole("button", { name: en.spotlight.actions.feedbackDown })
            ).toBeTruthy();
        });
    });

    describe("in Japanese", () => {
        beforeEach(async () => {
            localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
            await loadLocale("ja");
        });

        it("labels the thumbs with Spotlight's Japanese, not the English fallback", async () => {
            renderModal();
            const up = ja.spotlight!.actions!.feedbackUp!;
            const down = ja.spotlight!.actions!.feedbackDown!;
            // Guard the premise: the Japanese really differs from the fallback.
            expect(up).not.toBe("Good answer");
            expect(down).not.toBe("Needs work");

            expect(await screen.findByRole("button", { name: up })).toBeTruthy();
            expect(screen.getByRole("button", { name: down })).toBeTruthy();
            expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
            expect(screen.queryByRole("button", { name: "Needs work" })).toBeNull();
        });
    });
});

describe("the per-turn 'Answered in' footnote", () => {
    beforeEach(async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        await loadLocale("ja");
    });

    it.each([
        ["ThreadAskModal", renderThread, ja.threadAsk!.states!.answeredIn!],
        ["NoteAskModal", renderNote, ja.noteAsk!.states!.answeredIn!],
    ] as const)("%s is localized", async (_name, renderModal, template) => {
        renderModal();
        expect(await screen.findByText(template.replace("{duration}", "1.8s"))).toBeTruthy();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });
});

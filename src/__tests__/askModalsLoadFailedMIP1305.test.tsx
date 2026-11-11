/**
 * MIP-1305: the "Ask about this note / thread" modals draw a failed summary as the
 * shared ErrorState, and its Retry sends the request again.
 *
 * Fails at the REQUEST (`fetch` answers 500, then 200), through the real hooks and
 * modals; only the Q&A conversation (a markdown / BlockNote stack) is stubbed.
 */
import { useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import { useNoteAsk } from "../features/noteAsk/useNoteAsk";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import { useThreadAsk } from "../features/threadAsk/useThreadAsk";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";

vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return {
        ...actual,
        AgentQAConversation: () => <div />,
        AgentQAInput: () => <div />,
    };
});

const SUMMARY = {
    summary: "A short summary of it.",
    last_updated_iso: "2026-11-10T00:00:00Z",
    fingerprint: "f1",
    body_length: 10,
    note_title: "Plan",
    message_count: 3,
    turns: [],
    agent_session_id: null,
};

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const failThenSucceed = (path: string) => {
    fetchMock.mockImplementation(async (url: string) => {
        if (!String(url).includes(path)) throw new Error(`unexpected request ${url}`);
        const calls = fetchMock.mock.calls.filter(([u]) => String(u).includes(path)).length;
        return calls === 1
            ? new Response(JSON.stringify({}), { status: 500 })
            : new Response(JSON.stringify(SUMMARY), { status: 200 });
    });
};
const askCalls = (path: string) =>
    fetchMock.mock.calls.filter(([u]) => String(u).includes(path)).length;
const SLOW = { timeout: 15000 };

describe("Ask about this note", () => {
    const Harness = () => {
        const state = useNoteAsk({ accessToken: "tok", teamId: "t1" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        useEffect(() => state.open({ noteType: 1, noteId: 7 }), []);
        return <NoteAskModal state={state} onSelectSource={vi.fn()} />;
    };

    it("a failed summary is an ErrorState; Retry asks again and the summary lands", async () => {
        failThenSucceed("/agent/note-summary/");
        render(
            <CssVarsProvider>
                <UrlLinkModalProvider value={null as never}>
                    <Harness />
                </UrlLinkModalProvider>
            </CssVarsProvider>
        );

        expect(
            await screen.findByRole("button", { name: en.common.actions.retry }, SLOW)
        ).toBeTruthy();
        expect(document.querySelector('[data-error="noteAsk-summary"]')).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));

        expect(await screen.findByText(/A short summary of it/, {}, SLOW)).toBeTruthy();
        await waitFor(() =>
            expect(document.querySelector('[data-error="noteAsk-summary"]')).toBeNull()
        );
        expect(askCalls("/agent/note-summary/")).toBe(2);
    }, 40000);
});

describe("Ask about this thread", () => {
    const myself = { userId: "u1", userName: "Me", teamId: "t1" } as UserProps;
    const Harness = () => {
        const state = useThreadAsk({ accessToken: "tok", teamId: "t1" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        useEffect(() => state.open({ chatType: 1, chatId: 2, threadId: 3 }), []);
        return (
            <ThreadAskModal
                accessToken="tok"
                chatName="General"
                myself={myself}
                state={state}
                onSelectSource={vi.fn()}
            />
        );
    };

    it("a failed summary is an ErrorState; Retry asks again and the summary lands", async () => {
        failThenSucceed("/agent/thread-summary/");
        render(
            <CssVarsProvider>
                <UrlLinkModalProvider value={null as never}>
                    <Harness />
                </UrlLinkModalProvider>
            </CssVarsProvider>
        );

        expect(
            await screen.findByRole("button", { name: en.common.actions.retry }, SLOW)
        ).toBeTruthy();
        expect(document.querySelector('[data-error="threadAsk-summary"]')).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));

        expect(await screen.findByText(/A short summary of it/, {}, SLOW)).toBeTruthy();
        expect(askCalls("/agent/thread-summary/")).toBe(2);
    }, 40000);
});

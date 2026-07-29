/**
 * ThreadAskModal — the "Open note" deep link shown after "Save as Chat Note".
 *
 * Saving posts the summary + Q&A to `/note/chat/` and gets back a
 * `noteId`. The footer then offers a link to that note, built through
 * `entityRefToHref` so it matches the shape `parseInternalUrl`
 * classifies as `chatNote`. Clicking it opens the shared UrlLinkModal
 * rather than navigating away.
 *
 * The link is gated on the save fingerprint, not on "a save happened" —
 * once the user asks a follow-up the saved note no longer reflects what
 * is on screen, so the link disappears at the same moment the Save
 * button re-arms.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

const saveMock = vi.fn();
vi.mock("../features/threadAsk/saveThreadAskAsNote", () => ({
    saveThreadAskAsNote: (...args: unknown[]) => saveMock(...args),
}));

// The Q&A surface pulls in the markdown/BlockNote stack and isn't under
// test here — the footer is.
vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return {
        ...actual,
        AgentQAConversation: () => <div data-testid="qa-conversation" />,
        AgentQAInput: () => <div data-testid="qa-input" />,
    };
});

const agentQAStub = {
    query: "",
    setQuery: vi.fn(),
    ask: { isStreaming: false, askError: null, answer: "", toolEvents: [], pendingApproval: null },
    turns: [],
    sessionId: null,
    onAsk: vi.fn(),
    onCancel: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    clearConversation: vi.fn(),
    reset: vi.fn(),
    submitFeedback: vi.fn(),
} as unknown as UseThreadAskReturn["agentQA"];

const buildState = (
    overrides: Partial<UseThreadAskReturn> = {}
): { state: UseThreadAskReturn } => ({
    state: {
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
        agentQA: agentQAStub,
        ...overrides,
    } as UseThreadAskReturn,
});

const renderModal = (
    openModalByHref = vi.fn(),
    overrides: Partial<UseThreadAskReturn> = {},
    zIndex?: number
) => {
    render(
        <CssVarsProvider>
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <ThreadAskModal
                    accessToken="tok"
                    chatName="Launch"
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    zIndex={zIndex}
                    {...buildState(overrides)}
                />
            </UrlLinkModalProvider>
        </CssVarsProvider>
    );
    return openModalByHref;
};

const clickSave = () => fireEvent.click(screen.getByRole("button", { name: /Save as Chat Note/ }));

describe("ThreadAskModal saved-note link", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        saveMock.mockResolvedValue(918);
    });

    it("shows no link before a save", () => {
        renderModal();
        expect(screen.queryByRole("link", { name: /Open note/ })).toBeNull();
    });

    it("renders a chat-note deep link once the save returns a noteId", async () => {
        renderModal();
        clickSave();
        const link = await screen.findByRole("link", { name: /Open note/ });
        expect(link).toHaveAttribute("href", "/workspace/notes/chat/gm/77/thread/404/note/918");
        expect(screen.getByText("Saved as Chat Note.")).toBeTruthy();
    });

    it("opens the note in the UrlLinkModal instead of navigating", async () => {
        const open = renderModal();
        clickSave();
        const link = await screen.findByRole("link", { name: /Open note/ });
        const clickNotCancelled = fireEvent.click(link);
        expect(open).toHaveBeenCalledWith("/workspace/notes/chat/gm/77/thread/404/note/918", {
            zIndex: undefined,
        });
        // preventDefault() ran, so the browser never follows the href.
        expect(clickNotCancelled).toBe(false);
    });

    it("passes a stacking level above a raised host", async () => {
        const open = renderModal(vi.fn(), {}, 10021);
        clickSave();
        const link = await screen.findByRole("link", { name: /Open note/ });
        fireEvent.click(link);
        expect(open).toHaveBeenCalledWith(expect.any(String), { zIndex: 10031 });
    });

    it("leaves the href alone on cmd-click so a new tab still works", async () => {
        const open = renderModal();
        clickSave();
        const link = await screen.findByRole("link", { name: /Open note/ });
        fireEvent.click(link, { metaKey: true });
        expect(open).not.toHaveBeenCalled();
    });

    it("drops the link once the content moves on from what was saved", async () => {
        const open = vi.fn();
        const tree = (state: ReturnType<typeof buildState>) => (
            <CssVarsProvider>
                <UrlLinkModalProvider value={{ openModalByHref: open }}>
                    <ThreadAskModal
                        accessToken="tok"
                        chatName="Launch"
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        {...state}
                    />
                </UrlLinkModalProvider>
            </CssVarsProvider>
        );
        const { rerender } = render(tree(buildState()));
        clickSave();
        await screen.findByRole("link", { name: /Open note/ });

        // Summary refreshed → the saved note no longer reflects the modal.
        rerender(
            tree(
                buildState({
                    summary: {
                        text: "A longer, refreshed summary.",
                        lastUpdatedIso: "2026-07-29T10:00:00Z",
                        fingerprint: "fp-2",
                        messageCount: 12,
                    },
                })
            )
        );
        expect(screen.queryByRole("link", { name: /Open note/ })).toBeNull();
        expect(screen.queryByText("Saved as Chat Note.")).toBeNull();
    });

    it("shows the failure message and no link when the save throws", async () => {
        saveMock.mockRejectedValue(new Error("boom"));
        renderModal();
        clickSave();
        await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
        expect(screen.queryByRole("link", { name: /Open note/ })).toBeNull();
    });
});

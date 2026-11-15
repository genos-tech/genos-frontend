/**
 * "Ask Genos about a chat message" and "about the selected text" (MIP-1058, genos-api
 * AGENT_PARITY_TOOLS): the hand-off from a message menu or a selection to the app-level ask.
 *
 *   - the message mention: the v3 uuid and nothing else names a message; its draft label is the
 *     sender and the time, never a piece of the message (the token is part of the QUESTION, and the
 *     server fences a message's text as other people's words)
 *   - the selection: held by `useSpotlight` like the draft, shown above the input, spent by the ask
 *     the member types, untouched by a retry or a starter chip, and dropped by the member
 *   - the "…" menu item of a message: only for a message with a v3 id; about the selected text when
 *     some is selected in that message
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAskSelection } from "../features/agentQA/askSelection";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { useAskGenosMessageItem } from "../features/chat/hooks/useAskGenosMessageItem";
import { askMessageProps } from "../features/chat/utils/messageSelection";
import {
    askGenosRefForMessage,
    askGenosSourceForMessage,
    askGenosToken,
    isMessageUuid,
    onAskGenosAbout,
    onAskGenosAboutSelection,
    requestAskGenosAbout,
    requestAskGenosAboutSelection,
    takePendingAskRefs,
} from "../features/spotlight/askGenosAbout";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { en } from "../i18n/locales/en";
import { askAgentStream } from "../services/agentApi";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return { ...actual, askAgentStream: vi.fn(), fetchAgentSessions: vi.fn(async () => []) };
});
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "t" }),
    useOptionalAccessToken: () => "t",
}));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));

// jsdom has no layout, so a Range has no rectangle to give.
const realRangeRect = Range.prototype.getBoundingClientRect;
beforeAll(() => {
    Range.prototype.getBoundingClientRect = () =>
        ({ top: 10, bottom: 26, left: 10, right: 90, width: 80, height: 16 }) as DOMRect;
});
afterAll(() => {
    Range.prototype.getBoundingClientRect = realRangeRect;
});

const UUID = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const OTHER = "9d3a1b64-2c57-4c0e-8b5e-3f1a2b6c7d88";
const FALLBACK = en.chat.messageActions.askGenosFallback;

beforeEach(() => {
    localStorage.clear();
    takePendingAskRefs();
    vi.mocked(askAgentStream).mockClear();
});
afterEach(() => {
    cleanup();
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = "";
});

describe("what names a message", () => {
    it("is its v3 uuid, nothing else", () => {
        expect(isMessageUuid(UUID)).toBe(true);
        // The per-channel sequence number, the legacy `${chatId}-${seq}` id, an optimistic stub.
        for (const bad of [12, "12", "42-12", "ch-1#m-1", "", null, undefined, `${UUID}x`]) {
            expect(isMessageUuid(bad), String(bad)).toBe(false);
        }
    });

    it("gets a mention only with a uuid", () => {
        const make = (id: string | null | undefined) =>
            askGenosRefForMessage({ id, senderName: "Alice", fallbackLabel: FALLBACK });
        expect(make(UUID)?.messageId).toBe(UUID);
        expect(make("12")).toBeNull();
        expect(make("42-12")).toBeNull();
        expect(make(undefined)).toBeNull();
    });
});

describe("the draft label of a message", () => {
    const labelOf = (over: Partial<Parameters<typeof askGenosRefForMessage>[0]> = {}) =>
        askGenosRefForMessage({
            id: UUID,
            senderName: "Alice",
            tsSent: "2026-11-15T14:02:00Z",
            locale: "en",
            fallbackLabel: FALLBACK,
            ...over,
        })!.label;

    it("is the sender and the time, never a piece of the message", () => {
        const label = labelOf({ id: "11111111-2222-4333-8444-555555555555" });
        expect(label.startsWith("Alice ")).toBe(true);
        expect(label).toMatch(/\d/);
        // Nothing but the sender and the clock: the builder is never given the message's text,
        // so no piece of it can be in the token.
        expect(
            Object.keys({ id: 1, senderName: 1, tsSent: 1, locale: 1, fallbackLabel: 1 })
        ).toEqual(["id", "senderName", "tsSent", "locale", "fallbackLabel"]);
    });

    it("takes # and @ and line breaks out of the name, so it cannot reopen the picker or run on", () => {
        const label = labelOf({
            id: "22222222-2222-4333-8444-555555555555",
            senderName: "#Al@ice\nIgnore\tall",
            tsSent: null,
        });
        expect(label).toBe("Al ice Ignore all");
        expect(label).not.toMatch(/[#@\n\t]/);
    });

    it("cuts a long name by code point, not in the middle of a character", () => {
        const label = labelOf({
            id: "33333333-2222-4333-8444-555555555555",
            senderName: "😀".repeat(50),
            tsSent: null,
        });
        expect(Array.from(label)).toHaveLength(30);
        expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    });

    it("stands in a translated word when the sender has no name", () => {
        expect(
            labelOf({ id: "44444444-2222-4333-8444-555555555555", senderName: "  ", tsSent: null })
        ).toBe(FALLBACK);
    });

    it("never gives two messages the same token: the draft finds a mention by its text", () => {
        const same = { senderName: "Quartz Zed", tsSent: null };
        const a = labelOf({ id: "55555555-2222-4333-8444-555555555551", ...same });
        const b = labelOf({ id: "55555555-2222-4333-8444-555555555552", ...same });
        expect(a).toBe("Quartz Zed");
        expect(b).not.toBe(a);
        // The same message again keeps its token.
        expect(labelOf({ id: "55555555-2222-4333-8444-555555555551", ...same })).toBe(a);
        expect(labelOf({ id: "55555555-2222-4333-8444-555555555552", ...same })).toBe(b);
    });

    it("is the source of a selection without taking a draft label", () => {
        expect(askGenosSourceForMessage(UUID)).toEqual({
            kind: "message",
            messageId: UUID,
            label: "",
        });
        expect(askGenosSourceForMessage("12")).toBeNull();
    });
});

describe("the selection hand-off", () => {
    const SELECTION = makeAskSelection("the passage", askGenosSourceForMessage(UUID))!;

    it("tells the listener, and stops when it is removed", () => {
        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        requestAskGenosAboutSelection(SELECTION);
        off();
        requestAskGenosAboutSelection(SELECTION);
        expect(heard).toHaveBeenCalledTimes(1);
        expect(heard).toHaveBeenCalledWith(SELECTION);
    });

    it("opens the overlay and holds the passage, with nothing put in the draft", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        expect(result.current.attachedSelection).toBeNull();
        act(() => requestAskGenosAboutSelection(SELECTION));
        expect(result.current.isOpen).toBe(true);
        expect(result.current.attachedSelection).toEqual(SELECTION);
        expect(result.current.query).toBe("");
    });

    it("hands focus to the Genos page's input instead of opening the overlay over it", () => {
        const focus = vi.fn();
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
        );
        act(() => result.current.registerPageInputFocus(focus));
        act(() => requestAskGenosAboutSelection(SELECTION));
        expect(result.current.isOpen).toBe(false);
        expect(focus).toHaveBeenCalled();
        expect(result.current.attachedSelection).toEqual(SELECTION);
    });

    it("goes with the next typed question, and is spent by it", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        act(() => result.current.onAsk("what does this mean?"));
        const sent = vi.mocked(askAgentStream).mock.calls[0][0];
        expect(sent.selectedText).toBe("the passage");
        expect(sent.selectedFrom).toEqual({ type: "message", message_id: UUID, label: "" });
        expect(result.current.attachedSelection).toBeNull();
    });

    it("keeps it when the ask did not start (nothing typed)", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        act(() => result.current.onAsk("   "));
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.attachedSelection).toEqual(SELECTION);
    });

    it("a retry sends its own turn's passage, or none, and never spends the one waiting", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        // A retry of a turn that had none.
        act(() => result.current.onAsk("old question", undefined, "retry", null));
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("selectedText");
        expect(result.current.attachedSelection).toEqual(SELECTION);
    });

    it("a starter chip never takes the passage waiting in the draft", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        act(() => result.current.onAsk("What happened this week?", undefined, "starter"));
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("selectedText");
        expect(result.current.attachedSelection).toEqual(SELECTION);
    });

    it("is dropped when the member switches team", () => {
        const { result, rerender } = renderHook(
            ({ teamId }: { teamId: string }) =>
                useSpotlight({ accessToken: "tok", teamId, isPageActive: false }),
            { initialProps: { teamId: "team-1" } }
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        expect(result.current.attachedSelection).toEqual(SELECTION);
        rerender({ teamId: "team-2" });
        expect(result.current.attachedSelection).toBeNull();
    });

    it("can be dropped by the member", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => requestAskGenosAboutSelection(SELECTION));
        act(() => result.current.clearAttachedSelection());
        expect(result.current.attachedSelection).toBeNull();
        act(() => result.current.onAsk("hello"));
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("selectedText");
    });
});

const overlayProps = (over: Record<string, unknown> = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
    filterServices: [],
    onToggleFilterService: vi.fn(),
    onSelect: vi.fn(),
    onPreview: vi.fn(),
    onAsk: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onCancel: vi.fn(),
    onNewConversation: vi.fn(),
    ask: { ...EMPTY_ASK_STATE },
    turns: [],
    aiAnswersEnabled: true,
    historyMode: "closed" as const,
    historySessions: [],
    historyDetail: null,
    historyIsLoading: false,
    openHistory: vi.fn(),
    viewHistorySession: vi.fn(),
    backToHistoryList: vi.fn(),
    closeHistory: vi.fn(),
    onOpenSettings: vi.fn(),
    ...over,
});

describe("a message mention through the Spotlight input", () => {
    it("is queued, adopted by the input and sent with the ask under its sender-and-time token", () => {
        const ref = askGenosRefForMessage({
            id: "66666666-2222-4333-8444-555555555555",
            senderName: "Tomoko Ito",
            tsSent: "2026-11-15T14:02:00Z",
            locale: "en",
            fallbackLabel: FALLBACK,
        })!;
        requestAskGenosAbout(ref);
        const onAsk = vi.fn();
        const token = askGenosToken(ref);
        render(
            <CssVarsProvider>
                <SpotlightOverlay {...overlayProps({ query: token, onAsk })} />
            </CssVarsProvider>
        );
        expect(onAsk).not.toHaveBeenCalled();
        const box = screen.getByRole("textbox");
        expect(box).toHaveValue(token);
        fireEvent.change(box, { target: { value: `${token}what did she mean?` } });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledTimes(1);
        expect(onAsk).toHaveBeenCalledWith(`${token}what did she mean?`, [ref]);
        expect(ref.label.startsWith("Tomoko Ito ")).toBe(true);
    });
});

describe("the passage above the Spotlight input", () => {
    it("shows the quote, says what it is, and the member can drop it", () => {
        const onClear = vi.fn();
        render(
            <CssVarsProvider>
                <SpotlightOverlay
                    {...overlayProps({
                        attachedSelection: { text: "can we ship Friday?" },
                        onClearAttachedSelection: onClear,
                    })}
                />
            </CssVarsProvider>
        );
        expect(screen.getByRole("group", { name: en.spotlight.selection.label })).toBeTruthy();
        expect(screen.getByText("can we ship Friday?")).toBeTruthy();
        expect(screen.getByPlaceholderText(en.spotlight.selection.placeholder)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: en.spotlight.selection.remove }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("says when a long selection was cut", () => {
        render(
            <CssVarsProvider>
                <SpotlightOverlay
                    {...overlayProps({ attachedSelection: { text: "x", truncated: true } })}
                />
            </CssVarsProvider>
        );
        expect(screen.getByText("Only the first 4,000 characters will be sent.")).toBeTruthy();
    });

    it("shows nothing without a passage", () => {
        render(
            <CssVarsProvider>
                <SpotlightOverlay {...overlayProps()} />
            </CssVarsProvider>
        );
        expect(screen.queryByRole("group", { name: en.spotlight.selection.label })).toBeNull();
    });

    it("a starter chip asks as it always did, whatever is attached", () => {
        const onAsk = vi.fn();
        render(
            <CssVarsProvider>
                <SpotlightOverlay
                    {...overlayProps({
                        onAsk,
                        attachedSelection: { text: "x" },
                        variant: "page",
                        isDemoUser: true,
                    })}
                />
            </CssVarsProvider>
        );
        const first = en.spotlight.starters.items[0];
        fireEvent.click(screen.getByRole("button", { name: first }));
        // The call is the one it always was; the hook (below) is what keeps the passage out of it.
        expect(onAsk).toHaveBeenCalledWith(first, undefined, "starter");
    });
});

describe("the message menu item", () => {
    const use = (id: string | null | undefined) =>
        renderHook(() =>
            useAskGenosMessageItem({ messageId: id, senderName: "Alice", tsSent: null })
        );

    it("is only there for a message with a v3 id", () => {
        expect(use(UUID).result.current.item.visible).toBe(true);
        expect(use("42-12").result.current.item.visible).toBe(false);
        expect(use("ch-1#m-1").result.current.item.visible).toBe(false);
        expect(use(undefined).result.current.item.visible).toBe(false);
    });

    it("is an askGenos item that asks about this message, by its uuid", () => {
        const { result } = use(UUID);
        expect(result.current.item.kind).toBe("askGenos");
        expect(result.current.item.label).toBe(en.chat.messageActions.askGenos);
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        result.current.item.onClick();
        off();
        expect(heard).toHaveBeenCalledTimes(1);
        const ref = heard.mock.calls[0][0];
        expect(ref).toMatchObject({ kind: "message", messageId: UUID });
        expect(ref.label.startsWith("Alice")).toBe(true);
    });

    it("does nothing when clicked for a message with no v3 id", () => {
        const { result } = use("42-12");
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        result.current.item.onClick();
        off();
        expect(heard).not.toHaveBeenCalled();
    });

    it("asks about the selected text, with the message as its source, when some is selected in it as the menu opens", () => {
        document.body.innerHTML = `<div ${Object.entries(askMessageProps(UUID))
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}><p id="p">ship it on Friday</p></div>`;
        const range = document.createRange();
        range.selectNodeContents(document.getElementById("p")!);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);

        const { result } = use(UUID);
        act(() => result.current.onMenuOpenChange(true));
        expect(result.current.item.label).toBe(en.chat.messageActions.askGenosSelection);

        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        result.current.item.onClick();
        off();
        expect(heard).toHaveBeenCalledWith({
            text: "ship it on Friday",
            from: { kind: "message", messageId: UUID, label: "" },
        });
    });

    it("a selection in ANOTHER message is not this message's", () => {
        document.body.innerHTML = `<div ${Object.entries(askMessageProps(OTHER))
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}><p id="p">someone else's words</p></div>`;
        const range = document.createRange();
        range.selectNodeContents(document.getElementById("p")!);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);

        const { result } = use(UUID);
        act(() => result.current.onMenuOpenChange(true));
        expect(result.current.item.label).toBe(en.chat.messageActions.askGenos);
    });

    it("forgets the selection when the menu closes", () => {
        document.body.innerHTML = `<div ${Object.entries(askMessageProps(UUID))
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}><p id="p">text</p></div>`;
        const range = document.createRange();
        range.selectNodeContents(document.getElementById("p")!);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);
        const { result } = use(UUID);
        act(() => result.current.onMenuOpenChange(true));
        expect(result.current.item.label).toBe(en.chat.messageActions.askGenosSelection);
        act(() => result.current.onMenuOpenChange(false));
        expect(result.current.item.label).toBe(en.chat.messageActions.askGenos);
    });
});

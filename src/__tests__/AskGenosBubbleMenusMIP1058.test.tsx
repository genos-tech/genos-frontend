/**
 * "Ask Genos about this message" in the message "…" menu (MIP-1058): the main-message menu and the
 * thread-reply menu cover DM, GM, PM and MDM, and ask by the message's v3 uuid. A row with no v3 id
 * (an optimistic message, an old cached row) offers nothing, and a task comment (not a chat message)
 * has no such item at all.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import { onAskGenosAbout } from "../features/spotlight/askGenosAbout";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { en } from "../i18n/locales/en";

vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));

const ASK = en.chat.messageActions.askGenos;
const UUID_MAIN = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const UUID_REPLY = "9d3a1b64-2c57-4c0e-8b5e-3f1a2b6c7d88";

const message = (over: Record<string, unknown> = {}) => ({
    // The per-channel SEQUENCE number: what must never be sent.
    messageId: 7,
    messageIdWithChatId: UUID_MAIN,
    messageIdWithChatIdAndThreadId: UUID_REPLY,
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    tsSent: "2026-11-15T14:02:00Z",
    sender: { userId: "u-2", userName: "Other Person", isSystemUser: false },
    ...over,
});

const renderMenu = (
    kind: "main" | "thread",
    chatType: number,
    msg: Record<string, unknown> = message(),
    hostZIndex?: number
) => {
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: msg as never,
        myself: { userId: "u-1", teamId: "t-1" } as never,
        setEditTargetMessage: vi.fn(),
        setFlaggedMessages: vi.fn(),
        setIsInEdit: vi.fn(),
        setUnwrapAll: vi.fn(),
        setUnwrapCode: vi.fn(),
        socket: null,
        unwrapAll: false,
        unwrapCode: false,
        useCM: { flaggedMessages: [] } as never,
    };
    const Host = ({ children }: { children: React.ReactNode }) =>
        hostZIndex === undefined ? (
            <>{children}</>
        ) : (
            <NoteModalHostZIndexProvider value={hostZIndex}>
                {children}
            </NoteModalHostZIndexProvider>
        );
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                <Host>
                    {kind === "main" ? (
                        <BubbleMoreMenu
                            {...common}
                            chat={{ chatId: "ch-1", chatType } as never}
                            replyHandler={vi.fn()}
                            setCurrentChat={vi.fn()}
                            usePM={{} as never}
                            useTM={{} as never}
                        />
                    ) : (
                        <BubbleThreadMoreMenu
                            {...common}
                            currentMessageIndex={0}
                            setCurrentThreadChat={vi.fn()}
                            setTargetMessageIndex={vi.fn()}
                            thread={{ chatId: "ch-1", threadId: "th-1", chatType } as never}
                        />
                    )}
                </Host>
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );
};

const openMenu = () => {
    fireEvent.click(screen.getAllByRole("button").at(-1) as HTMLElement);
    return screen.getAllByRole("menuitem");
};
const askItem = () => openMenu().find((el) => el.textContent === ASK);

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

// 1 DM, 2 GM, 3 PM, 4 MDM.
describe.each([
    ["main", 1],
    ["main", 2],
    ["main", 3],
    ["main", 4],
    ["thread", 1],
    ["thread", 2],
    ["thread", 3],
    ["thread", 4],
] as const)("the %s menu of chat type %i", (kind, chatType) => {
    it("offers Ask Genos about this message", () => {
        renderMenu(kind, chatType);
        expect(askItem()).toBeTruthy();
    });

    it("asks by the v3 uuid (never the sequence number), with the sender and the time as its label", () => {
        renderMenu(kind, chatType);
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        fireEvent.click(askItem()!);
        off();
        expect(heard).toHaveBeenCalledTimes(1);
        const ref = heard.mock.calls[0][0];
        expect(ref.kind).toBe("message");
        expect(ref.messageId).toBe(kind === "main" ? UUID_MAIN : UUID_REPLY);
        expect(ref.messageId).not.toBe("7");
        expect(ref.label.startsWith("Other Person")).toBe(true);
        // The label says who and when: nothing of what was said.
        expect(ref.label).not.toContain("hello");
    });
});

describe("a row with no v3 id", () => {
    it.each(["main", "thread"] as const)(
        "offers nothing in the %s menu: an optimistic row, a legacy `${chatId}-${seq}` id",
        (kind) => {
            for (const bad of ["ch-1#m-1", "42-7", "", undefined]) {
                cleanup();
                renderMenu(
                    kind,
                    2,
                    message({ messageIdWithChatId: bad, messageIdWithChatIdAndThreadId: bad })
                );
                expect(openMenu().map((el) => el.textContent)).not.toContain(ASK);
            }
        }
    );

    it("never falls back to the sequence number", () => {
        renderMenu("main", 2, message({ messageIdWithChatId: undefined, messageId: 7 }));
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        openMenu();
        off();
        expect(heard).not.toHaveBeenCalled();
        expect(screen.queryByText(ASK)).toBeNull();
    });
});

describe("inside a link-preview modal", () => {
    // The UrlLinkModal provides its layer around every body it renders; Spotlight opens above it but
    // the modal's focus trap would keep the question's input from taking focus (#694).
    it.each(["main", "thread"] as const)("the %s menu offers no Ask Genos item", (kind) => {
        renderMenu(kind, 2, message(), 10020);
        expect(openMenu().map((el) => el.textContent)).not.toContain(ASK);
    });

    it.each(["main", "thread"] as const)("the %s menu offers it on a page", (kind) => {
        renderMenu(kind, 2);
        expect(openMenu().map((el) => el.textContent)).toContain(ASK);
    });
});

describe("the main menu and the thread menu are not mixed up", () => {
    it("the main menu asks by messageIdWithChatId, not the thread id", () => {
        renderMenu("main", 2);
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        fireEvent.click(askItem()!);
        off();
        expect(heard.mock.calls[0][0].messageId).toBe(UUID_MAIN);
    });

    it("the thread menu asks by messageIdWithChatIdAndThreadId, not the main id", () => {
        renderMenu("thread", 2);
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        fireEvent.click(askItem()!);
        off();
        expect(heard.mock.calls[0][0].messageId).toBe(UUID_REPLY);
    });
});

describe("task comments", () => {
    it("have no Ask Genos item: they are TaskComments rows, not chat messages", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const root = path.resolve(__dirname, "..");
        const files = [
            "features/tasks/components/contents/base/sub/TaskCommentBubble.tsx",
            "features/tasks/components/contents/base/sub/TaskCommentList.tsx",
        ];
        for (const f of files) {
            const src = fs.readFileSync(path.join(root, f), "utf8");
            expect(src, f).not.toMatch(/useAskGenosMessageItem|askGenosRefForMessage/);
        }
    });
});

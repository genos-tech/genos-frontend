/**
 * MIP-1956: a screen reader is told when someone else writes in the open conversation.
 * A polite, visually hidden status region fed ONLY by the live `v3:message:created` event:
 * other people's messages in this pane, rate limited so a burst does not flood the reader.
 * jsdom has no screen reader; the accessibility tree was read in a real browser (see the PR).
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatLiveAnnouncer } from "../features/chat/components/shared/ChatLiveAnnouncer";
import { ANNOUNCE_WINDOW_MS } from "../features/chat/hooks/useIncomingMessageAnnouncer";
import {
    ANNOUNCE_PREVIEW_MAX,
    matchesConversation,
    previewForAnnouncement,
} from "../features/chat/utils/liveAnnouncement";
import { I18nProvider } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { Message } from "../types/channel";

let n = 0;
const msg = (over: Partial<Message> = {}): Message =>
    ({
        id: `m${++n}`,
        channelId: "chat-a",
        sender: { userId: "u-alice", userName: "Alice", isSystemUser: false },
        body: [],
        bodyText: "hello there",
        isThreadReply: false,
        threadRootId: null,
        ...over,
    }) as unknown as Message;

const receive = (m: Message) =>
    act(() => {
        window.dispatchEvent(new CustomEvent("v3:message:created", { detail: { message: m } }));
    });
const settle = (ms = 0) => act(() => void vi.advanceTimersByTime(ms));

const mount = (props: { chatId?: string; threadId?: string } = {}) =>
    render(
        <I18nProvider>
            <ChatLiveAnnouncer
                key={props.chatId ?? "chat-a"}
                chatId={props.chatId ?? "chat-a"}
                myselfId="u-me"
                threadId={props.threadId}
            />
        </I18nProvider>
    );
const region = () => screen.getByRole("status");

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem("genos-locale", "en");
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("the live region", () => {
    it("is a polite, atomic status region that starts empty", () => {
        mount();
        expect(region().getAttribute("aria-live")).toBe("polite");
        expect(region().getAttribute("aria-atomic")).toBe("true");
        expect(region().textContent).toBe("");
    });

    it("announces a message from another person once, as 'Name: preview'", () => {
        mount();
        receive(msg());
        settle(50);
        expect(region().textContent).toBe("Alice: hello there");
        settle(ANNOUNCE_WINDOW_MS * 2);
        expect(region().textContent).toBe("Alice: hello there");
    });

    it("says nothing for the person's own message (this device or another)", () => {
        mount();
        receive(msg({ sender: { userId: "u-me", userName: "Me" } as Message["sender"] }));
        settle(ANNOUNCE_WINDOW_MS * 2);
        expect(region().textContent).toBe("");
    });

    it("says nothing for another chat, or a thread reply in the main pane", () => {
        mount();
        receive(msg({ channelId: "chat-b" }));
        receive(msg({ isThreadReply: true, threadRootId: "root-1" }));
        settle(ANNOUNCE_WINDOW_MS * 2);
        expect(region().textContent).toBe("");
    });

    it("announces a thread's replies only in that thread", () => {
        mount({ threadId: "root-1" });
        receive(msg({ bodyText: "main message" }));
        receive(msg({ isThreadReply: true, threadRootId: "root-2", bodyText: "other thread" }));
        settle(100);
        expect(region().textContent).toBe("");
        receive(msg({ isThreadReply: true, threadRootId: "root-1", bodyText: "a reply" }));
        settle(50);
        expect(region().textContent).toBe("Alice: a reply");
    });

    it("reads the same message once even when two panes show the channel", () => {
        mount();
        const m = msg({ bodyText: "twice?" });
        receive(m);
        settle(50);
        receive(m);
        settle(ANNOUNCE_WINDOW_MS * 2);
        expect(region().textContent).toBe("Alice: twice?");
    });

    it("coalesces a burst: the first at once, then one line with the count", () => {
        mount();
        for (const body of ["m1", "m2", "m3", "m4", "m5"]) receive(msg({ bodyText: body }));
        settle(50);
        expect(region().textContent).toBe("Alice: m1");
        settle(ANNOUNCE_WINDOW_MS);
        expect(region().textContent).toBe("Alice: m2 +3 more messages");
    });

    it("drops what is queued when the conversation changes", () => {
        const { rerender } = mount();
        receive(msg({ bodyText: "first" }));
        receive(msg({ bodyText: "queued for A" }));
        settle(50);
        rerender(
            <I18nProvider>
                <ChatLiveAnnouncer key="chat-b" chatId="chat-b" myselfId="u-me" />
            </I18nProvider>
        );
        settle(ANNOUNCE_WINDOW_MS * 2);
        expect(region().textContent).toBe("");
        receive(msg({ channelId: "chat-b", bodyText: "in B" }));
        settle(50);
        expect(region().textContent).toBe("Alice: in B");
    });
});

describe("matchesConversation and previewForAnnouncement", () => {
    const labels = {
        attachment: "sent an attachment",
        media: {
            gif: "GIF",
            image: "Image",
            video: "Video",
            audio: "Audio",
            file: "File",
            table: "Table",
        },
    };
    it("scopes by channel or thread root", () => {
        expect(matchesConversation(msg(), { chatId: "chat-a" })).toBe(true);
        expect(matchesConversation(msg(), { chatId: "chat-b" })).toBe(false);
        expect(
            matchesConversation(msg({ isThreadReply: true, threadRootId: "r" }), {
                chatId: "chat-a",
                threadId: "r",
            })
        ).toBe(true);
    });
    it("collapses whitespace and cuts a long preview with an ellipsis", () => {
        expect(previewForAnnouncement(msg({ bodyText: "a \n  b" }), labels)).toBe("a b");
        const long = previewForAnnouncement(msg({ bodyText: "x".repeat(300) }), labels);
        expect(long.length).toBe(ANNOUNCE_PREVIEW_MAX);
        expect(long.endsWith("…")).toBe(true);
    });
    it("says what a text-less message carries", () => {
        expect(previewForAnnouncement(msg({ bodyText: "" }), labels)).toBe("sent an attachment");
        expect(
            previewForAnnouncement(
                msg({ bodyText: "", body: [{ type: "image", props: { url: "u" } }] }),
                labels
            )
        ).toBe("Image");
    });
});

describe("the strings", () => {
    it("exist in all 7 locales", () => {
        const catalogs = { en, ja, es, fr, zh, ar, hi } as Record<
            string,
            { chat?: { liveRegion?: Record<string, string> } }
        >;
        for (const [locale, catalog] of Object.entries(catalogs)) {
            const lr = catalog.chat?.liveRegion;
            expect(Object.keys(lr ?? {}).sort(), locale).toEqual(
                ["attachment", "listLabel", "more", "newMessage", "threadListLabel"].sort()
            );
        }
    });
});

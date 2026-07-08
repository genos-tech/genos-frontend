/**
 * PM task-card "N comments" chip — counts REAL task comments.
 *
 * The chip must show the task's live (non-deleted) comment count — what
 * the thread's Comments tab renders — sourced from the server-computed
 * `taskCommentCount`, NOT `reply_count`/`numReplies`. `reply_count`
 * counts every thread reply, so it over-counts legacy free-form replies
 * that were never task comments (the "+1" bug) and under-counts when a
 * comment→thread-reply mirror failed. See genos-api
 * `MessageSerializer.get_taskCommentCount`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { v3MessageToLegacy } from "../features/chat/adapters/v3ToLegacy";
import { BubbleUnderBar } from "../features/chat/components/bubbles/BubbleUnderBar";
import type { UserProps } from "../types/admin";
import { ChannelKind, type Message } from "../types/channel";
import type { MessageProps } from "../types/chat";

// Isolate the chip: the emoji-reaction row pulls in socket/context deps
// that are irrelevant to the count under test.
vi.mock("../components/ui/emoji/ShowEmojiReaction", () => ({
    ShowEmojiReaction: () => null,
}));

// ---- adapter: taskCommentCount sourcing --------------------------------

const makeV3 = (overrides: Partial<Message>): Message =>
    ({
        id: "m-1",
        channelId: "ch-1",
        channelKind: ChannelKind.PM,
        sender: {
            userId: "u1",
            userName: "U",
            userEmail: "u@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: "hi",
        parentId: null,
        threadRootId: null,
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        taskId: 7,
        displayId: "PRJ-7",
        taskStatus: "Open",
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
        ...overrides,
    }) as Message;

const toLegacy = (overrides: Partial<Message>): MessageProps =>
    v3MessageToLegacy({ message: makeV3(overrides), channelId: "ch-1", chatType: 3 });

describe("v3MessageToLegacy — taskCommentCount sourcing", () => {
    it("prefers the top-level server-computed count over stale metadata", () => {
        expect(
            toLegacy({ taskCommentCount: 4, metadata: { taskCommentCount: 99 } }).taskCommentCount
        ).toBe(4);
    });

    it("reads 0 as a real count (task with no comments), not as absent", () => {
        expect(toLegacy({ taskCommentCount: 0 }).taskCommentCount).toBe(0);
    });

    it("falls back to metadata for older cached rows lacking the top-level field", () => {
        expect(
            toLegacy({ taskCommentCount: null, metadata: { taskCommentCount: 6 } })
                .taskCommentCount
        ).toBe(6);
    });

    it("is undefined when neither is present (so the chip falls back to replyCount)", () => {
        expect(
            toLegacy({ taskCommentCount: null, metadata: {} }).taskCommentCount
        ).toBeUndefined();
    });
});

// ---- chip render -------------------------------------------------------

const baseProps = {
    socket: null,
    myself: {} as UserProps,
    chatName: "PRJ",
    dmPartnerUser: {} as UserProps,
    message: {} as MessageProps,
    showUnderBarOption: false,
    reactions: [],
    setReactions: () => {},
    setUniqueReactionEmojiCount: () => {},
    setShowEmojiPicker: () => {},
    replayHandler: () => {},
    isThread: false,
};

const renderBar = (props: Record<string, unknown>) =>
    render(
        <CssVarsProvider>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <BubbleUnderBar {...({ ...baseProps, ...props } as any)} />
        </CssVarsProvider>
    );

describe("BubbleUnderBar — PM comment-count chip", () => {
    it("PM: shows the authoritative taskCommentCount, not the higher reply_count", () => {
        renderBar({ chatType: 3, numReplies: 5, taskCommentCount: 4 });
        expect(screen.getByText("4 comments")).toBeTruthy();
        expect(screen.queryByText("5 comments")).toBeNull();
    });

    it("PM: taskCommentCount=0 (orphan reply, no real comments) renders no chip", () => {
        const { container } = renderBar({ chatType: 3, numReplies: 1, taskCommentCount: 0 });
        expect(container.textContent).not.toContain("comment");
    });

    it("PM: falls back to reply_count when taskCommentCount is absent (pre-change cached row)", () => {
        renderBar({ chatType: 3, numReplies: 3, taskCommentCount: undefined });
        expect(screen.getByText("3 comments")).toBeTruthy();
    });

    it("PM: uses the singular noun at 1", () => {
        renderBar({ chatType: 3, numReplies: 9, taskCommentCount: 1 });
        expect(screen.getByText("1 comment")).toBeTruthy();
    });

    it("non-PM: still uses reply_count with the reply noun", () => {
        renderBar({ chatType: 2, numReplies: 2, taskCommentCount: undefined });
        expect(screen.getByText("2 replies")).toBeTruthy();
    });
});

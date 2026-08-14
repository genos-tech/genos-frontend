/**
 * The hover row of quick reactions has to read as separate buttons.
 *
 * The picks are square-ish buttons sized to a 16px glyph, and the chat/thread
 * row set no `gap` at all: 👍👀✅ touched, and because each button paints its
 * own hover background, moving across them looked like one continuous strip
 * rather than three targets. The task-comment row already had a gap, so the
 * two surfaces disagreed.
 *
 * Only the separation is asserted, not exact pixels — Joy compiles spacing to
 * `calc(... * var(--joy-spacing))` and jsdom resolves neither `calc()` nor
 * `var()`, so a pixel assertion would be asserting the string. What carries
 * meaning is that a gap is declared and that the buttons keep side padding.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmojiReaction } from "../components/ui/emoji/EmojiReaction";
import { TaskCommentEmojiReaction } from "../components/ui/emoji/TaskCommentEmojiReaction";
import { UserProps } from "../types/admin";

const me = { userId: "u-me", userName: "Me", teamId: 1 } as unknown as UserProps;

/** Whether `el`'s own emotion rule declares a non-zero horizontal gap.
 *
 *  Read out of the emitted CSS text rather than via `getComputedStyle`,
 *  which reports nothing at all here: jsdom's cssstyle drops the `gap`
 *  family as unsupported, so a computed-style assertion fails identically
 *  whether the row has a gap or not. Same reason `ReactionChipAppearance`
 *  reads `document.head.innerHTML` for its brand variable. */
const declaresGap = (el: Element) => {
    const css = Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent ?? "")
        .join("\n");

    return Array.from(el.classList).some((cls) => {
        const block = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
        if (!block) return false;
        const gap = block[1].match(/(?:^|;)\s*(?:column-)?gap:\s*([^;]+)/);
        return gap ? !/^(0(px)?|normal)$/.test(gap[1].trim()) : false;
    });
};

const renderChatRow = () =>
    render(
        <CssVarsProvider>
            <EmojiReaction
                chatName="Ryan"
                chatType={1}
                dmPartnerUser={me}
                isThread={false}
                message={{ messageId: 7 } as never}
                myself={me}
                numReplies={0}
                reactions={[]}
                setReactions={vi.fn()}
                setShowEmojiPicker={vi.fn()}
                setUniqueReactionEmojiCount={vi.fn()}
                showUnderBarOption
                socket={null}
            />
        </CssVarsProvider>
    );

const renderTaskCommentRow = () =>
    render(
        <CssVarsProvider>
            <TaskCommentEmojiReaction
                comment={{ commentId: 3, taskId: 1 } as never}
                myself={me}
                reactions={[]}
                setReactions={vi.fn()}
                setShowEmojiPicker={vi.fn()}
                showUnderBarOption
                socket={null}
            />
        </CssVarsProvider>
    );

describe("quick reaction row spacing", () => {
    it("renders the default picks plus the picker button", () => {
        const { container } = renderChatRow();
        // 👍 👀 ✅ from `DEFAULT_QUICK_REACTIONS`, then the emoji picker.
        expect(container.querySelectorAll("button").length).toBe(4);
    });

    it("separates the picks in chat and thread bubbles", () => {
        const { container } = renderChatRow();
        const row = container.querySelector("button")!.parentElement!;
        expect(declaresGap(row), "the chat/thread quick-pick row declares no gap").toBe(true);
    });

    it("separates the picks in task comments", () => {
        const { container } = renderTaskCommentRow();
        const row = container.querySelector("button")!.parentElement!;
        expect(declaresGap(row), "the task-comment quick-pick row declares no gap").toBe(true);
    });

    it("keeps side padding on each pick, so its hover fill isn't flush", () => {
        for (const { container } of [renderChatRow(), renderTaskCommentRow()]) {
            const pick = container.querySelector("button")!;
            const { paddingLeft, paddingRight } = getComputedStyle(pick);
            expect(paddingLeft).toBe(paddingRight);
            expect(parseFloat(paddingLeft)).toBeGreaterThan(4);
        }
    });
});

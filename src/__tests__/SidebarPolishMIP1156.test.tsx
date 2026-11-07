/**
 * MIP-1156 / MIP-1167: small sidebar and editor fixes whose cause jsdom cannot
 * measure (layout). Each test pins the rule that fixes it; the visible result
 * was checked in a browser (see the evidence page).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ChatListItemMeta } from "../features/chat/components/sidebar/ChatListItemActions";
import { CellTextInput } from "../features/tasks/components/table/cellEditors";

vi.mock("../components/ui/emoji/EmojiText", () => ({
    EmojiText: ({ text }: { text: string }) => <span>{text}</span>,
}));

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

describe("a chat row's time gives way to the actions on hover (MIP-1167)", () => {
    it("the time carries the class the row hides while its actions show", () => {
        const chat = {
            latestMessage: { messageId: 5, tsSent: "2026-07-24T15:37:00Z" },
            lastReadMessageId: "5",
        } as never;
        render(
            <CssVarsProvider>
                <ChatListItemMeta chat={chat} />
            </CssVarsProvider>
        );
        const time = document.querySelector(".NavItem-hide-on-actions");
        expect(time).not.toBeNull();
        expect(time!.textContent).toMatch(/\d/);
    });
});

describe("the title field is taller than a picker in a cell (MIP-1156)", () => {
    it("34px (a real min-height: the --Input-minHeight variable alone is cancelled by the cell editors' `minHeight: 0`)", () => {
        render(
            <CssVarsProvider>
                <CellTextInput value="" onChange={() => {}} />
            </CssVarsProvider>
        );
        const input = screen.getByRole("textbox");
        expect(cssOf(input.closest(".MuiInput-root") as Element)).toMatch(/min-height:\s*34px/);
    });
});

describe("activity and flagged rows keep the sidebar's width (MIP-1156)", () => {
    it("rows are not wrapped in a row Stack: Joy's ListItem is flex: none and kept its content's width", () => {
        // In a `direction="row"` Stack the card grew to its longest line (1,143px in a
        // 409px sidebar) and pushed the time out of view.
        const code = source("features/chat/components/sidebar/ChatList.tsx");
        expect(code).not.toMatch(
            /<Stack direction="row">\s*<ChatListItemFor(Activity|FlagMessages)/
        );
    });

    it("the preview box is the same width in every row, indent included", () => {
        const code = source("features/chat/components/sidebar/activity/ActivityContent.tsx");
        // 100% - the 44px indent, not `maxWidth: 100%` plus a 44px margin (a 44px overshoot).
        expect(code).toContain('width: "calc(100% - 44px)"');
        expect(code).not.toMatch(/maxWidth:\s*"100%"/);
        expect(code).toContain("minWidth: 0");
    });
});

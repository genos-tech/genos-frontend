// MIP-1202: the v3 row toolbar's buttons were `#fff` with a `#ddd` border: white boxes on the
// dark surface. They follow the theme through tokens now (the markup and the emoji are as before).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageRowHoverToolbar } from "../features/channel/components/MessageRowHoverToolbar";

describe("the v3 row toolbar buttons", () => {
    it("take surface, border and text from the theme, not from hex", () => {
        render(
            <MessageRowHoverToolbar
                isFlagged={false}
                isMine
                messageId="m1"
                replyCount={0}
                visible
                onCopyLink={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
                onFlag={vi.fn()}
                onReact={vi.fn()}
            />
        );
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(5);
        for (const b of buttons) {
            const style = b.getAttribute("style") ?? "";
            expect(style).not.toMatch(/#[0-9a-f]{3,6}/i);
            expect(style).toContain("var(--g-surface-raised)");
            expect(style).toContain("var(--g-border)");
            expect(style).toContain("var(--g-text)");
        }
    });
});

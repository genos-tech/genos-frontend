/**
 * Empty-state CTA wiring (onboarding pass): the GM pane's empty state
 * offers "New Group Message" instead of only telling the user things
 * will appear here — and the CTA stays absent everywhere it isn't
 * explicitly wired (the tag-filtered view must not push "create another
 * group" as the fix for a filter with zero matches).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../features/chat/components/sidebar/ChatList";

const renderEmpty = (props: Partial<React.ComponentProps<typeof EmptyState>> = {}) =>
    render(
        <CssVarsProvider>
            <EmptyState chatType={2} {...props} />
        </CssVarsProvider>
    );

describe("ChatList EmptyState CTA", () => {
    it("renders the action button when wired and fires the handler", () => {
        const onAction = vi.fn();
        renderEmpty({ actionLabelKey: "newGroupMessageMenu", onAction });
        const button = screen.getByRole("button", { name: /new group message/i });
        fireEvent.click(button);
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("renders no button when the CTA is not wired", () => {
        renderEmpty();
        expect(screen.queryByRole("button")).toBeNull();
        // The informational copy still renders.
        expect(screen.getByText(/no group messages/i)).toBeTruthy();
    });

    it("renders no button when a handler exists but no label (half-wired)", () => {
        renderEmpty({ onAction: vi.fn() });
        expect(screen.queryByRole("button")).toBeNull();
    });
});

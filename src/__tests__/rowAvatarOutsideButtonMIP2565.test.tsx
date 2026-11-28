// MIP-2565: a row's avatar button is not inside the row's button, a group avatar opens only
// the profile, and focus lands on the main content after leaving a multi-person DM.
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Clickable } from "../components/ui/Clickable";
import { NavItem } from "../components/ui/nav/NavItem";

describe("NavItem with its own controls in the content", () => {
    const draw = (onRow: () => void, onChip: () => void) =>
        render(
            <CssVarsProvider>
                <NavItem
                    as="div"
                    label="Bo, Cy"
                    icon={
                        <Clickable
                            label="members"
                            onActivate={(e) => {
                                e.stopPropagation();
                                onChip();
                            }}
                        >
                            x
                        </Clickable>
                    }
                    interactiveContent
                    onClick={onRow}
                />
            </CssVarsProvider>
        );

    it("keeps the control out of the row button, which the content names", () => {
        draw(vi.fn(), vi.fn());
        const chip = screen.getByRole("button", { name: "members" });
        // The row is named by its text only: the control's name is not read as part of it.
        const row = screen.getByRole("button", { name: "Bo, Cy" });
        expect(row).not.toBe(chip);
        expect(row.contains(chip)).toBe(false);
        expect(chip.parentElement?.closest('[role="button"], button')).toBeNull();
    });

    it("opens the row from its button or its text, and not from the control", () => {
        const onRow = vi.fn();
        const onChip = vi.fn();
        draw(onRow, onChip);
        fireEvent.click(screen.getByRole("button", { name: "members" }));
        expect(onChip).toHaveBeenCalledTimes(1);
        expect(onRow).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Bo, Cy"));
        fireEvent.click(screen.getByRole("button", { name: /Bo, Cy/ }));
        expect(onRow).toHaveBeenCalledTimes(2);
    });
});

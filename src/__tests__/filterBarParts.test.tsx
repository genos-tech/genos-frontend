/**
 * MIP-1121: the Joy parts the task filter bar's dropdowns are built from.
 *
 * They replace Material's controlled `Menu`, whose contract the bar was written
 * around: the parent owns `open`, nothing closes a menu except the parent (so a
 * multi-select filter stays open while you tick several values), and Escape or
 * clicking away closes it. Rendered under Joy's provider ALONE, which is also
 * the proof that no Material theme is needed any more.
 */

import { useState } from "react";
import { MenuButton } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskFilterMenuStyles } from "../components/ui/styles/commonStyle";
import {
    FilterDropdown,
    FilterMenu,
    FilterMenuItem,
} from "../features/tasks/components/table/filterBarParts";

const Harness = ({
    onPick,
    closeOnPick = false,
}: {
    onPick: () => void;
    closeOnPick?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    return (
        <CssVarsProvider>
            <FilterDropdown open={open} onOpenChange={setOpen}>
                <MenuButton>Status</MenuButton>
                <FilterMenu
                    isDark={false}
                    maxHeight={200}
                    minWidth={160}
                    styles={TaskFilterMenuStyles.light}
                >
                    <FilterMenuItem
                        onClick={() => {
                            onPick();
                            if (closeOnPick) setOpen(false);
                        }}
                    >
                        Open
                    </FilterMenuItem>
                    <FilterMenuItem>WIP</FilterMenuItem>
                </FilterMenu>
            </FilterDropdown>
        </CssVarsProvider>
    );
};

const trigger = () => screen.getByRole("button", { name: "Status" });

describe("FilterDropdown / FilterMenu / FilterMenuItem", () => {
    it("is closed until the trigger is pressed, then lists its items", async () => {
        render(<Harness onPick={vi.fn()} />);
        expect(screen.queryByRole("menuitem", { name: "Open" })).toBeNull();
        fireEvent.click(trigger());
        expect(await screen.findByRole("menuitem", { name: "Open" })).toBeTruthy();
        expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    });

    it("an item click does NOT close the menu (multi-select filters stay open)", async () => {
        const onPick = vi.fn();
        render(<Harness onPick={onPick} />);
        fireEvent.click(trigger());
        const first = await screen.findByRole("menuitem", { name: "Open" });
        fireEvent.click(first);
        fireEvent.click(screen.getByRole("menuitem", { name: "WIP" }));
        expect(onPick).toHaveBeenCalledTimes(1);
        // Both rows are still there after two clicks.
        expect(screen.getAllByRole("menuitem")).toHaveLength(2);
        expect(trigger().getAttribute("aria-expanded")).toBe("true");
    });

    it("a handler that closes the menu still can, by setting its own state", async () => {
        render(<Harness closeOnPick onPick={vi.fn()} />);
        fireEvent.click(trigger());
        fireEvent.click(await screen.findByRole("menuitem", { name: "Open" }));
        await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Open" })).toBeNull());
    });

    it("Escape closes it", async () => {
        render(<Harness onPick={vi.fn()} />);
        fireEvent.click(trigger());
        const menu = await screen.findByRole("menu");
        fireEvent.keyDown(menu, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("pressing the trigger again closes it (it does not re-open)", async () => {
        render(<Harness onPick={vi.fn()} />);
        fireEvent.click(trigger());
        await screen.findByRole("menu");
        fireEvent.click(trigger());
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
});

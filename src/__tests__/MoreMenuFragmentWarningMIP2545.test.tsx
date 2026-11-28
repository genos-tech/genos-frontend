/**
 * MIP-2545: opening a "..." menu logged `Invalid prop data-first-child supplied to
 * React.Fragment`. Joy warns on the UPDATE path, so the open menu is re-rendered here.
 */

import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoreMenu, type MoreMenuItem } from "../components/ui/MoreMenu";

const noop = () => undefined;

const items = (label: string): MoreMenuItem[] => [
    { id: "first", label, icon: <DeleteRoundedIcon />, onClick: noop },
    {
        id: "hinted",
        label: "Hinted",
        icon: <DeleteRoundedIcon />,
        onClick: noop,
        disabled: true,
        hint: "Why not",
    },
    { id: "last", label: "Delete", icon: <DeleteRoundedIcon />, onClick: noop, danger: true },
];

describe("MoreMenu", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs no Fragment warning when open and re-rendered, and keeps the divider", async () => {
        const errors = vi.spyOn(console, "error");
        const view = render(<MoreMenu ariaLabel="More" items={items("One")} />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "More" }));
        });
        await act(async () => {
            view.rerender(<MoreMenu ariaLabel="More" items={items("Two")} />);
        });

        expect(screen.getByRole("menuitem", { name: "Two" })).toBeTruthy();
        expect(screen.getByRole("separator")).toBeTruthy();
        expect(errors.mock.calls.filter((c) => String(c.join(" ")).includes("Fragment"))).toEqual(
            []
        );
    });
});

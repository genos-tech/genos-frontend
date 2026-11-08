// MIP-1202: the tag colour palette used to be a Menu held open with `anchorEl` state. Joy then
// never moved focus into it, so the Arrow keys did nothing and Escape went on to close the
// whole Manage Tags dialog (and a tag being typed with it). It is a Dropdown + MenuButton now.
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ColorPickerMenu } from "../features/tasks/components/contents/base/sub/TagColorPickerMenu";

const mount = (onSelectColor = vi.fn(), onHostKeyDown = vi.fn()) => {
    render(
        <CssVarsProvider>
            {/* The host: a dialog that closes on Escape. Portals bubble through the React tree. */}
            <div onKeyDown={onHostKeyDown}>
                <ColorPickerMenu onSelectColor={onSelectColor} />
            </div>
        </CssVarsProvider>
    );
    return { onSelectColor, onHostKeyDown };
};

describe("the tag colour palette", () => {
    it("takes focus into the menu when it opens (Arrow keys work)", async () => {
        mount();
        fireEvent.click(screen.getByRole("button"));
        await waitFor(() => expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(30));
        await waitFor(() =>
            expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull()
        );
    });

    it("Escape closes the palette and does not reach the dialog around it", async () => {
        const { onHostKeyDown } = mount();
        fireEvent.click(screen.getByRole("button"));
        await waitFor(() =>
            expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull()
        );
        fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
        expect(onHostKeyDown).not.toHaveBeenCalled();
    });

    it("picking a colour reports it and closes the palette", async () => {
        const { onSelectColor } = mount();
        fireEvent.click(screen.getByRole("button"));
        fireEvent.click(await screen.findByText("Red"));
        expect(onSelectColor).toHaveBeenCalledWith(
            expect.objectContaining({ key: "red", value: "#ff2323" })
        );
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
});

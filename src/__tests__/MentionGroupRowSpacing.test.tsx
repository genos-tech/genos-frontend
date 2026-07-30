import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MentionGroupsPanel } from "../components/layout/MentionGroupsPanel";

vi.mock("../context/MentionGroupsContext", () => ({
    useMentionGroupsContext: () => ({
        createGroup: vi.fn(),
        mentionGroups: [{ groupId: 1, groupName: "designers", memberCount: 4 }],
    }),
}));
// The right-hand editor is a separate concern and pulls in avatars +
// member pickers; the row layout under test is on the left.
vi.mock("../components/layout/MentionGroupEditor", () => ({
    MentionGroupEditor: () => <div />,
}));

const renderPanel = () =>
    render(
        <CssVarsProvider>
            <MentionGroupsPanel
                myself={{ userId: "u1", userName: "Me" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMembers: [] } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

/**
 * The group row is `[icon] @name [member-count chip]` inside a
 * `ListItemButton`. Spacing came from a single `mr` on the icon and
 * nothing before the chip, so the icon and the count sat almost against
 * the row's edges and the name. Spacing is now one `gap` for the whole row
 * — and unconditionally, because the row was cramped at every width, not
 * just on a phone.
 */
describe("mention group row", () => {
    it("insets the rows from the container's border", () => {
        renderPanel();
        const list = screen.getByRole("list");
        expect(getComputedStyle(list).padding).toBe("6px");
    });

    it("does not let rows bleed over each other", () => {
        // Joy's ListItem gives its child ListItemButton a NEGATIVE margin
        // (`calc(-1 * var(--ListItem-paddingY))`) so the button can bleed out
        // to the ListItem's edges. Ours carries no padding to cancel — and
        // `p: 0` does NOT reset the variable — so each row spilled 6px over
        // the rows above and below. You only saw it on hover, when the fill
        // painted the real box.
        //
        // Asserted on the VARIABLE as resolved at the row, not on
        // `marginTop`: jsdom doesn't evaluate `var()` inside a margin, so a
        // margin assertion here passes against the broken version. It also
        // has to be read at the ROW — the ListItem re-declares the variable
        // on itself, so a List-level override never reaches the button (an
        // earlier draft of this fix did exactly that and did nothing).
        renderPanel();
        const row = screen.getByText("@designers").closest("[role='button']") as HTMLElement;
        const style = getComputedStyle(row);
        expect(style.getPropertyValue("--ListItemButton-marginBlock")).toBe("0px");
        expect(style.getPropertyValue("--ListItemButton-marginInline")).toBe("0px");
    });

    it("spaces the icon, name and member count with one row gap", () => {
        renderPanel();
        const row = screen.getByText("@designers").closest("[role='button']") as HTMLElement;
        const style = getComputedStyle(row);
        expect(style.gap).toBe("10px");
        // 1.75 spacing units. Combined with the List's own 6px inset, the
        // icon and the member count sit 20px off the container's border —
        // 1.25 (10px) and then 1.5 (12px) both still read as cramped.
        expect(style.paddingLeft).toBe("14px");
        expect(style.paddingRight).toBe("14px");
    });

    it("keeps the member count intact next to a long group name", () => {
        renderPanel();
        // `getByText` lands on Joy Chip's inner label span, not the
        // root the sx applies to.
        const chip = screen.getByText("4").closest(".MuiChip-root") as HTMLElement;
        expect(getComputedStyle(chip).flexShrink).toBe("0");
    });
});

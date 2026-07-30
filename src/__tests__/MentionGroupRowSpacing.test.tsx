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
    it("spaces the icon, name and member count with one row gap", () => {
        renderPanel();
        const row = screen.getByText("@designers").closest("[role='button']") as HTMLElement;
        const style = getComputedStyle(row);
        expect(style.gap).toBe("8px");
        // 1.5 spacing units — the old 1.25 left the icon nearly touching
        // the row edge.
        expect(style.paddingLeft).toBe("12px");
        expect(style.paddingRight).toBe("12px");
    });

    it("keeps the member count intact next to a long group name", () => {
        renderPanel();
        // `getByText` lands on Joy Chip's inner label span, not the
        // root the sx applies to.
        const chip = screen.getByText("4").closest(".MuiChip-root") as HTMLElement;
        expect(getComputedStyle(chip).flexShrink).toBe("0");
    });
});

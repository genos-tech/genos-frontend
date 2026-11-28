// MIP-2565: a press on a group avatar opens the profile only, not the row around it.
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GMAvatar } from "../components/ui/avatars/GMAvatar";

vi.mock("../features/chat/components/modals/ModalGMProfile", () => ({
    ModalGMProfile: ({ openModalGMProfile }: { openModalGMProfile: boolean }) =>
        openModalGMProfile ? <button type="button">in the profile</button> : null,
}));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("GMAvatar in a row", () => {
    it("opens the profile without opening the row, nor does a press inside it", () => {
        const onRow = vi.fn();
        render(
            <CssVarsProvider>
                <div onClick={onRow}>
                    <GMAvatar
                        gmChat={{ chatId: "g1", chatType: 2 } as any}
                        isYou={false}
                        myself={{} as any}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{ allChats: [] } as any}
                        useTEM={{ teamMemberProfiles: {} } as any}
                        useUISM={{} as any}
                    />
                </div>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button"));
        fireEvent.click(screen.getByRole("button", { name: "in the profile" }));
        expect(onRow).not.toHaveBeenCalled();
    });
});

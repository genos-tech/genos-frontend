/**
 * The group and project avatars open a profile; their content is a picture or an icon, so the
 * button needs a name of its own (MIP-2587: a screen reader said only "button").
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GMAvatar } from "../components/ui/avatars/GMAvatar";
import { ProjectAvatar } from "../components/ui/avatars/ProjectAvatar";

vi.mock("../features/chat/components/modals/ModalGMProfile", () => ({
    ModalGMProfile: () => null,
}));
vi.mock("../features/admin/components/modals/ModalProjectProfile", () => ({
    ModalProjectProfile: () => null,
}));

const shared = {
    myself: {} as never,
    setMyself: vi.fn(),
    socket: null,
    useCM: { allChats: [] } as never,
    useTEM: { teamMemberProfiles: {} } as never,
    useUISM: {} as never,
};
const chat = (over: Record<string, unknown>) => ({ chatId: "c1", ...over }) as never;
const show = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);

describe("avatar buttons have a name", () => {
    it("a group chat's avatar says whose profile it opens", () => {
        show(
            <GMAvatar
                {...shared}
                gmChat={chat({ chatName: "Design room", chatType: 2 })}
                isYou={false}
            />
        );
        expect(
            screen.getByRole("button", { name: "Group profile: Design room" })
        ).toBeInTheDocument();
    });

    it("a project's avatar says whose profile it opens", () => {
        show(<ProjectAvatar {...shared} pmChat={chat({ chatName: "Alpha", chatType: 3 })} />);
        expect(screen.getByRole("button", { name: "Project profile: Alpha" })).toBeInTheDocument();
    });

    it("takes the project's own name when the chat row has none", () => {
        show(
            <ProjectAvatar
                {...shared}
                pmChat={chat({ chatName: "", chatType: 3, project: { projectName: "Alpha" } })}
            />
        );
        expect(screen.getByRole("button", { name: "Project profile: Alpha" })).toBeInTheDocument();
    });
});

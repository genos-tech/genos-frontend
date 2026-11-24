/**
 * MIP-2336: the project menu's "Customize Task Fields" is shown to the owner AND to editors (the
 * API's `can_manage`), not to viewers. The API says so in `canManage`; an older API without it
 * leaves the owner-only check. Archive stays owner-only.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetArchiveStateForTests } from "../features/archive/archiveState";
import { canCustomizeTaskFields } from "../features/archive/projectOwner";
import { TaskHeader } from "../features/tasks/components/header/TaskHeader";
import { en } from "../i18n/locales/en";
import type { ProjectProps } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/notifications/notificationsContextState", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));

const project = { projectId: 7, projectName: "P" } as ProjectProps;

type Rules = { projectId: number; ownerUserId: string | null; canManage?: boolean };

const openMenu = (userId: string, taskFieldRules: Rules | null) => {
    render(
        <MemoryRouter initialEntries={["/workspace/tasks"]}>
            <CssVarsProvider>
                <TaskHeader
                    myself={{ userId, teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    usePM={{ currentProject: project, projects: [] } as never}
                    useTEM={{ teamMembers: [] } as never}
                    useTM={{ taskFieldRules, isCreatingTask: { flag: false } } as never}
                    useUISM={{} as never}
                    onCloseTaskHome={vi.fn()}
                    onCreateProject={vi.fn()}
                    onDeleteProject={vi.fn()}
                    onManageTags={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );
    fireEvent.click(screen.getAllByLabelText("More options")[0]);
};

const customizeRow = () =>
    screen.queryByRole("menuitem", { name: en.tasks.header.customizeFieldsMenuItem });
const archiveRow = () =>
    screen.queryByRole("menuitem", { name: en.common.archive.archiveMenuProject });

describe("Customize Task Fields menu item by role (MIP-2336)", () => {
    beforeEach(() => resetArchiveStateForTests());
    afterEach(cleanup);

    it("shows it to the owner", () => {
        openMenu("owner", { projectId: 7, ownerUserId: "owner", canManage: true });
        expect(customizeRow()).not.toBeNull();
        expect(archiveRow()).not.toBeNull();
    });

    it("shows it to an editor, who still cannot archive", () => {
        openMenu("editor", { projectId: 7, ownerUserId: "owner", canManage: true });
        expect(customizeRow()).not.toBeNull();
        expect(archiveRow()).toBeNull();
    });

    it("hides it from a viewer", () => {
        openMenu("viewer", { projectId: 7, ownerUserId: "owner", canManage: false });
        expect(customizeRow()).toBeNull();
    });

    it("keeps the owner-only check when the API does not send canManage", () => {
        openMenu("owner", { projectId: 7, ownerUserId: "owner" });
        expect(customizeRow()).not.toBeNull();
        cleanup();
        openMenu("editor", { projectId: 7, ownerUserId: "owner" });
        expect(customizeRow()).toBeNull();
    });
});

describe("canCustomizeTaskFields", () => {
    it("claims nothing before the rules for THIS project arrive", () => {
        const rules = { projectId: 8, ownerUserId: "u", canManage: true };
        expect(canCustomizeTaskFields(rules, 7, "u")).toBe(false);
        expect(canCustomizeTaskFields(null, 7, "u")).toBe(false);
        expect(canCustomizeTaskFields(rules, null, "u")).toBe(false);
    });
});

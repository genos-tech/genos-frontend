/**
 * MIP-1693: in an archived project the project menu's Delete is disabled and says why, instead of
 * failing with a 409 after the confirm dialog. A live project's Delete is unchanged.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { markProjectArchived, resetArchiveStateForTests } from "../features/archive/archiveState";
import { TaskHeader } from "../features/tasks/components/header/TaskHeader";
import { en } from "../i18n/locales/en";
import type { ProjectProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));

const myself = { userId: "u1", teamId: "t1" } as never;
const project = { projectId: 7, projectName: "P" } as ProjectProps;

const renderHeader = (onDeleteProject: () => void) =>
    render(
        <MemoryRouter initialEntries={["/workspace/tasks"]}>
            <CssVarsProvider>
                <TaskHeader
                    myself={myself}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    usePM={{ currentProject: project, projects: [] } as never}
                    useTEM={{ teamMembers: [] } as never}
                    useUISM={{} as never}
                    useTM={
                        {
                            taskFieldRules: { projectId: 7, ownerUserId: "u1" },
                            isCreatingTask: { flag: false },
                        } as never
                    }
                    onCloseTaskHome={vi.fn()}
                    onCreateProject={vi.fn()}
                    onDeleteProject={onDeleteProject}
                    onManageTags={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );

const deleteRow = () => {
    fireEvent.click(screen.getAllByLabelText("More options")[0]);
    return screen.getByRole("menuitem", { name: en.tasks.header.deleteProjectMenuItem });
};

describe("project menu Delete in an archived project (MIP-1693)", () => {
    beforeEach(() => resetArchiveStateForTests());
    afterEach(cleanup);

    it("is disabled and carries the archived reason", () => {
        markProjectArchived(project, true);
        const onDelete = vi.fn();
        renderHeader(onDelete);
        const row = deleteRow();
        expect(row.getAttribute("aria-disabled")).toBe("true");
        expect(row.getAttribute("aria-description")).toBe(en.common.archive.deleteDisabled);
        fireEvent.click(row);
        expect(onDelete).not.toHaveBeenCalled();
    });

    it("still opens the confirm dialog for a live project", () => {
        const onDelete = vi.fn();
        renderHeader(onDelete);
        const row = deleteRow();
        expect(row.getAttribute("aria-disabled")).not.toBe("true");
        fireEvent.click(row);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});

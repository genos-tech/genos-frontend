/**
 * The task "…" menus list their actions in the shared order (MIP-903).
 *
 * The task preview used to read Copy link, Open thread, New task, New sub-task,
 * Open note, New tag...: the ways to open the task were scattered between the
 * ways to create things. Opening now leads, then sharing, then creating, with
 * Mute and Delete at the end like every other menu. The project header's menu
 * follows the same rule (tag and project before milestone).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskTitleBlock } from "../features/tasks/components/contents/base/TaskTitleBlock";
import { TaskHeader } from "../features/tasks/components/header/TaskHeader";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));
vi.mock("../features/tasks/components/modals/ModalDeleteTask", () => ({
    ModalDeleteTask: () => <div />,
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => <div />,
}));

afterEach(cleanup);

const menuLabels = () => {
    fireEvent.click(screen.getAllByLabelText("More options")[0]);
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

const myself = { userId: "u1", teamId: "t1" } as never;

describe("task preview menu", () => {
    it("opens first, then shares, creates, mutes and deletes", () => {
        const m = en.tasks.titleBlock.menu;
        render(
            <MemoryRouter initialEntries={["/workspace/tasks"]}>
                <CssVarsProvider>
                    <TaskTitleBlock
                        isPreviewMode={true}
                        myself={myself}
                        setTaskTitle={vi.fn()}
                        taskTitle="A task"
                        useCM={{} as never}
                        useNM={{ taskNoteMeta: [] } as never}
                        usePM={{} as never}
                        useTM={{ isCreatingTask: { flag: false } } as never}
                        useUISM={{} as never}
                        taskContent={
                            {
                                id: 42,
                                rootTaskId: 42,
                                title: "A task",
                                project: { projectId: 7 },
                                threadId: 1,
                                chatType: 2,
                                chatId: "c-1",
                                status: { status: "Open" },
                            } as never
                        }
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
        expect(menuLabels()).toEqual([
            m.openThread,
            m.openNote,
            m.askGenos,
            m.copyTaskLink,
            m.newTask,
            m.newSubTask,
            m.newProject,
            m.manageTags,
            en.services.notifications.muteButton.mute,
            m.deleteTask,
        ]);
    });
});

// MIP-1042: converting a task to a milestone. Offered for a ROOT task only, in the
// "organize" group: after what creates things, before Mute and Delete.
describe("task preview menu: convert to milestone", () => {
    const renderMenu = (
        taskOverrides: Record<string, unknown>,
        props: Record<string, unknown> = {}
    ) =>
        render(
            <MemoryRouter initialEntries={["/workspace/tasks"]}>
                <CssVarsProvider>
                    <TaskTitleBlock
                        isPreviewMode={true}
                        myself={myself}
                        setTaskTitle={vi.fn()}
                        taskTitle="A task"
                        useCM={{} as never}
                        useNM={{ taskNoteMeta: [] } as never}
                        usePM={{} as never}
                        useSM={
                            { applyMilestoneToState: vi.fn(), forgetMilestone: vi.fn() } as never
                        }
                        useTM={{ isCreatingTask: { flag: false } } as never}
                        useUISM={{} as never}
                        taskContent={
                            {
                                id: 42,
                                rootTaskId: 42,
                                title: "A task",
                                parentTaskId: null,
                                milestoneId: null,
                                project: { projectId: 7 },
                                status: { status: "Open" },
                                ...taskOverrides,
                            } as never
                        }
                        {...(props as object)}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
    const m = en.tasks.titleBlock.menu;

    it("sits after the create actions and before Mute and Delete", () => {
        renderMenu({});
        const labels = menuLabels();
        expect(labels).toContain(m.convertToMilestone);
        expect(labels.indexOf(m.convertToMilestone)).toBeGreaterThan(labels.indexOf(m.newProject));
        expect(labels.indexOf(m.convertToMilestone)).toBeLessThan(
            labels.indexOf(en.services.notifications.muteButton.mute)
        );
        expect(labels[labels.length - 1]).toBe(m.deleteTask);
    });

    it("is not offered for a sub-task", () => {
        renderMenu({ parentTaskId: 3 });
        expect(menuLabels()).not.toContain(m.convertToMilestone);
    });

    it("is not offered for a task inside a milestone", () => {
        renderMenu({ milestoneId: 5 });
        expect(menuLabels()).not.toContain(m.convertToMilestone);
    });

    it("is not offered for a milestone's own row", () => {
        renderMenu({ isMilestone: true });
        expect(menuLabels()).not.toContain(m.convertToMilestone);
    });

    it("is not offered where the host has no milestone store", () => {
        renderMenu({}, { useSM: undefined });
        expect(menuLabels()).not.toContain(m.convertToMilestone);
    });
});

describe("project header menu", () => {
    it("creates tag and project before milestone, and ends with Delete", () => {
        const h = en.tasks.header;
        render(
            <MemoryRouter initialEntries={["/workspace/tasks"]}>
                <CssVarsProvider>
                    <TaskHeader
                        myself={myself}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{ allChats: [] } as never}
                        useTEM={{ teamMembers: [] } as never}
                        useUISM={{} as never}
                        usePM={
                            {
                                currentProject: { projectId: 7, projectName: "P" },
                                projects: [],
                            } as never
                        }
                        useTM={
                            {
                                taskFieldRules: { projectId: 7, ownerUserId: "u1" },
                                isCreatingTask: { flag: false },
                            } as never
                        }
                        onCloseTaskHome={vi.fn()}
                        onCreateProject={vi.fn()}
                        onManageTags={vi.fn()}
                        onDeleteProject={vi.fn()}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
        expect(menuLabels()).toEqual([
            h.newProjectMenuItem,
            h.newMilestoneMenuItem,
            h.manageTagsMenuItem,
            h.customizeFieldsMenuItem,
            h.deleteProjectMenuItem,
        ]);
    });
});

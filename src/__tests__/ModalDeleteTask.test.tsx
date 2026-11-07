/**
 * MIP-1155: Delete Task from a task opened in a modal.
 *
 * `TaskTitleBlock` used to hide Delete in a modal-hosted preview because the
 * confirm sat at 10010, behind the UrlLinkModal (10020). It now takes the
 * host's layer, so the confirm opens above it and Delete can be offered.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MODAL_FRAME_DEFAULT_Z_INDEX } from "../components/ui/modal/ModalFrame";
import { TaskTitleBlock } from "../features/tasks/components/contents/base/TaskTitleBlock";
import { ModalDeleteTask } from "../features/tasks/components/modals/ModalDeleteTask";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => <div />,
}));

afterEach(cleanup);

const task = {
    id: 42,
    rootTaskId: 42,
    title: "Fix the login bug",
    project: { projectId: 7 },
    status: { status: "Open" },
} as never;

const layer = () => getComputedStyle(screen.getByRole("presentation")).zIndex;

describe("ModalDeleteTask layer", () => {
    const mount = (hostZIndex?: number) =>
        render(
            <CssVarsProvider>
                <ModalDeleteTask
                    currentTaskContent={task}
                    hostZIndex={hostZIndex}
                    setOpenDeleteTask={vi.fn()}
                    setTaskUpdated={vi.fn()}
                    openDeleteTask
                />
            </CssVarsProvider>
        );

    it("sits above the modal that hosts the task", () => {
        mount(10020);
        expect(layer()).toBe("10022");
    });

    it("keeps the page-level layer when nothing hosts it", () => {
        mount();
        expect(layer()).toBe(String(MODAL_FRAME_DEFAULT_Z_INDEX));
    });
});

describe("Delete Task in a modal-hosted task header", () => {
    const mount = (props: Record<string, unknown>, status = "Open") =>
        render(
            <MemoryRouter initialEntries={["/workspace/tasks"]}>
                <CssVarsProvider>
                    <TaskTitleBlock
                        isPreviewMode={true}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        setTaskTitle={vi.fn()}
                        setTaskUpdated={vi.fn()}
                        taskContent={{ ...(task as object), status: { status } } as never}
                        taskTitle="Fix the login bug"
                        useCM={{} as never}
                        useNM={{ taskNoteMeta: [] } as never}
                        usePM={{} as never}
                        useTM={{ isCreatingTask: { flag: false } } as never}
                        useUISM={{} as never}
                        {...(props as object)}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
    const menu = () => {
        fireEvent.click(screen.getAllByLabelText("More options")[0]);
        return screen.getAllByRole("menuitem");
    };

    it("offers Delete task, and its confirm opens above the host", () => {
        mount({ hostZIndex: 10020 });
        const item = menu().find((el) => el.textContent === en.tasks.titleBlock.menu.deleteTask);
        expect(item).toBeTruthy();
        fireEvent.click(item!);
        expect(screen.getByRole("alertdialog").textContent).toContain("Fix the login bug");
        // The task menu (host + 1) and the confirm (host + 2): the confirm wins.
        expect(layer()).toBe("10022");
    });

    it("still offers it on the page, at the page layer", () => {
        mount({});
        const item = menu().find((el) => el.textContent === en.tasks.titleBlock.menu.deleteTask);
        expect(item).toBeTruthy();
        fireEvent.click(item!);
        expect(layer()).toBe(String(MODAL_FRAME_DEFAULT_Z_INDEX));
    });

    it("does not offer it for a closed task", () => {
        mount({ hostZIndex: 10020 }, "Closed");
        expect(menu().map((el) => el.textContent)).not.toContain(
            en.tasks.titleBlock.menu.deleteTask
        );
    });
});

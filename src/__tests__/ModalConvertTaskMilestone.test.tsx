/**
 * MIP-1042 follow-up: the two conversion confirmations are the app's own dialog,
 * with the words that used to be in the browser's `confirm()`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskTitleBlock } from "../features/tasks/components/contents/base/TaskTitleBlock";
import { ModalConvertTaskMilestone } from "../features/tasks/components/modals/ModalConvertTaskMilestone";
import { en } from "../i18n/locales/en";

const convert = vi.hoisted(() => ({
    toMilestone: vi.fn(async () => true),
    toTask: vi.fn(async () => true),
}));
vi.mock("../features/tasks/hooks/useConvertTaskMilestone", () => ({
    useConvertTaskMilestone: () => convert,
}));
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

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const tm = en.tasks.titleBlock.menu;
const pm = en.tasks.preview.menu;

describe("ModalConvertTaskMilestone", () => {
    const mount = (direction: "toMilestone" | "toTask", extra: Record<string, unknown> = {}) => {
        const onConfirm = vi.fn(async () => {});
        const onClose = vi.fn();
        render(
            <CssVarsProvider>
                <ModalConvertTaskMilestone
                    direction={direction}
                    name="Launch plan"
                    open
                    onClose={onClose}
                    onConfirm={onConfirm}
                    {...(extra as object)}
                />
            </CssVarsProvider>
        );
        return { onConfirm, onClose };
    };

    it("task → milestone: the question, what happens, the name, and a button that names the act", () => {
        mount("toMilestone");
        const dialog = screen.getByRole("dialog").textContent ?? "";
        expect(dialog).toContain(tm.convertToMilestoneTitle);
        expect(dialog).toContain(tm.convertToMilestoneBody);
        expect(dialog).toContain("Launch plan");
        expect(screen.getByRole("button", { name: tm.convertToMilestone })).toBeTruthy();
        expect(screen.getByRole("button", { name: en.common.actions.cancel })).toBeTruthy();
    });

    it("milestone → task: its own words, not the other direction's", () => {
        mount("toTask");
        const dialog = screen.getByRole("dialog").textContent ?? "";
        expect(dialog).toContain(pm.convertToTaskTitle);
        expect(dialog).toContain(pm.convertToTaskBody);
        expect(dialog).not.toContain(tm.convertToMilestoneTitle);
        expect(screen.getByRole("button", { name: pm.convertToTask })).toBeTruthy();
    });

    it("Confirm runs the conversion and closes; Cancel does neither", () => {
        const a = mount("toMilestone");
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.cancel }));
        expect(a.onClose).toHaveBeenCalledTimes(1);
        expect(a.onConfirm).not.toHaveBeenCalled();
    });

    it("sits above the preview it was opened from", () => {
        mount("toMilestone", { zIndex: 13210 });
        expect(getComputedStyle(screen.getByRole("presentation")).zIndex).toBe("13210");
    });
});

describe("the task menu's 'Convert to milestone'", () => {
    const myself = { userId: "u1", teamId: "t1" } as never;
    const renderTitleBlock = (props: Record<string, unknown> = {}) =>
        render(
            <MemoryRouter initialEntries={["/workspace/tasks"]}>
                <CssVarsProvider>
                    <TaskTitleBlock
                        isPreviewMode={true}
                        myself={myself}
                        setTaskTitle={vi.fn()}
                        taskTitle="Launch plan"
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
                                title: "Launch plan",
                                parentTaskId: null,
                                milestoneId: null,
                                project: { projectId: 7 },
                                status: { status: "Open" },
                            } as never
                        }
                        {...(props as object)}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
    const chooseConvert = () => {
        fireEvent.click(screen.getAllByLabelText("More options")[0]);
        fireEvent.click(screen.getByRole("menuitem", { name: tm.convertToMilestone }));
    };

    it("opens the app's dialog, not the browser's, and converts nothing yet", () => {
        const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
        renderTitleBlock();
        chooseConvert();
        expect(spy).not.toHaveBeenCalled();
        const dialog = screen.getByRole("dialog");
        expect(dialog.textContent).toContain(tm.convertToMilestoneTitle);
        expect(dialog.textContent).toContain("Launch plan");
        expect(convert.toMilestone).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("Cancel converts nothing", () => {
        renderTitleBlock();
        chooseConvert();
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.cancel }));
        expect(convert.toMilestone).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("Confirm converts THIS task, once", async () => {
        renderTitleBlock();
        chooseConvert();
        fireEvent.click(screen.getByRole("button", { name: tm.convertToMilestone }));
        await vi.waitFor(() => expect(convert.toMilestone).toHaveBeenCalledTimes(1));
        expect(convert.toMilestone).toHaveBeenCalledWith(42);
    });

    it("in a modal-hosted preview the dialog opens above it", () => {
        renderTitleBlock({ hostZIndex: 10020 });
        chooseConvert();
        expect(Number(getComputedStyle(screen.getByRole("presentation")).zIndex)).toBeGreaterThan(
            10020
        );
    });

    it("both menu items open the dialog; neither calls the browser's confirm", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
        // The menu item's own block: from its id to the next item's id.
        const item = (src: string, id: string) => {
            const at = src.indexOf(`id: "${id}"`);
            expect(at, `${id} item`).toBeGreaterThan(-1);
            const next = src.indexOf("id: ", at + 5);
            return src.slice(at, next === -1 ? undefined : next);
        };
        const title = read("features/tasks/components/contents/base/TaskTitleBlock.tsx");
        const preview = read("features/tasks/components/contents/TaskPreview.tsx");
        const toMilestone = item(title, "convertToMilestone");
        const toTask = item(preview, "convertToTask");
        expect(toMilestone).toContain("setOpenConvertToMilestone(true)");
        expect(toTask).toContain("setOpenConvertToTask(true)");
        expect(toMilestone).not.toMatch(/\bconfirm\(/);
        expect(toTask).not.toMatch(/\bconfirm\(/);
        expect(preview).toMatch(/<ModalConvertTaskMilestone[\s\S]*?direction="toTask"/);
    });
});

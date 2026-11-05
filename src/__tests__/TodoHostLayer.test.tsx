/**
 * MIP-1047: the to-do pane's dialogs open ABOVE the modal that holds the pane.
 *
 * The to-do list opens in the preview modal (layer 10020 and up). The pane's
 * own dialogs used to open at 1300 / 10010 and so appeared behind it: Scheduled
 * todos was unreachable from there. They now read the layer the pane is hosted
 * at; on the page (no host) they keep their usual layer.
 */
import { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalRemindMe } from "../features/chat/components/modals/ModalRemindMe";
import { ModalCreateTaskFromTodo } from "../features/chat/components/todo/ModalCreateTaskFromTodo";
import { ModalManageTodoTags } from "../features/chat/components/todo/ModalManageTodoTags";
import { ModalScheduledTodos } from "../features/chat/components/todo/ModalScheduledTodos";
import {
    TodoHostLayerProvider,
    useTodoDialogLayer,
} from "../features/chat/components/todo/TodoHostLayer";
import { TodoItemMoreMenu } from "../features/chat/components/todo/TodoItemMoreMenu";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref: vi.fn() }),
}));
vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => []),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const hosted = (layer: number | undefined, children: ReactNode) => (
    <CssVarsProvider>
        <TodoHostLayerProvider value={layer}>{children}</TodoHostLayerProvider>
    </CssVarsProvider>
);
const rootLayer = (dialog: HTMLElement) =>
    Number(getComputedStyle(dialog.closest('[role="presentation"]') as HTMLElement).zIndex);

describe("useTodoDialogLayer", () => {
    it("is the fallback on the page", () => {
        const { result } = renderHook(() => useTodoDialogLayer(10010));
        expect(result.current).toBe(10010);
        expect(renderHook(() => useTodoDialogLayer()).result.current).toBeUndefined();
    });

    it("is 10 above the host inside a modal, whatever the fallback", () => {
        const { result } = renderHook(() => useTodoDialogLayer(10010), {
            wrapper: ({ children }) => (
                <TodoHostLayerProvider value={13200}>{children}</TodoHostLayerProvider>
            ),
        });
        expect(result.current).toBe(13210);
    });
});

describe("each dialog of the to-do pane", () => {
    const tagsModal = () => (
        <ModalManageTodoTags
            categories={[]}
            open
            onClose={vi.fn()}
            onCreate={vi.fn()}
            onDelete={vi.fn()}
            onUpdate={vi.fn()}
        />
    );
    const scheduleModal = () => (
        <ModalScheduledTodos
            categories={[]}
            open
            schedules={[]}
            onAdd={vi.fn()}
            onClose={vi.fn()}
            onRemove={vi.fn()}
            onUpdate={vi.fn()}
        />
    );
    const createTaskModal = () => (
        <ModalCreateTaskFromTodo
            myself={{ teamId: "t", userId: "u" } as UserProps}
            open
            todoNotes={null}
            todoTitle="x"
            onClose={vi.fn()}
        />
    );
    const remindModal = () => (
        <ModalRemindMe open onClose={vi.fn()} onCommit={vi.fn()} onRemove={vi.fn()} />
    );

    it.each([
        ["Manage tags", tagsModal],
        ["Scheduled todos", scheduleModal],
        ["Create task from to-do", createTaskModal],
        ["Remind me", remindModal],
    ])("%s opens above a modal-hosted pane", (_name, make) => {
        render(hosted(10020, make()));
        expect(rootLayer(screen.getByRole("dialog"))).toBe(10030);
    });

    it("Manage tags and Remind me keep 10010 on the page", () => {
        render(hosted(undefined, tagsModal()));
        expect(rootLayer(screen.getByRole("dialog"))).toBe(10010);
        cleanup();
        render(hosted(undefined, remindModal()));
        expect(rootLayer(screen.getByRole("dialog"))).toBe(10010);
    });
});

describe("the item ⋮ menu", () => {
    it("opens above a modal-hosted pane", () => {
        render(
            hosted(
                10020,
                <TodoItemMoreMenu
                    categories={[]}
                    currentCategoryId={null}
                    isChild={false}
                    linkCopied={false}
                    notesExpanded={false}
                    onCopyLink={vi.fn()}
                    onCreateCategory={vi.fn()}
                    onCreateTask={vi.fn()}
                    onDelete={vi.fn()}
                    onRemindMe={vi.fn()}
                    onSelectCategory={vi.fn()}
                    onToggleNotes={vi.fn()}
                />
            )
        );
        fireEvent.click(screen.getByRole("button"));
        const menu = screen.getByRole("menu");
        expect(Number(getComputedStyle(menu).zIndex)).toBe(10030);
    });
});

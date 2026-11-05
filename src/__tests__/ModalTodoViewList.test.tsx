/**
 * MIP-1044: ModalTodoView with no day in its target shows the whole to-do list
 * at once. There is nothing to look up, so it must not fetch a day, and it
 * starts on the user's usual All / Incomplete tab (kept modal-local).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalTodoView } from "../components/modals/views/ModalTodoView";

const loadTodoGroups = vi.hoisted(() => vi.fn(async () => []));
vi.mock("../features/chat/components/todo/services/loadTodoGroups", () => ({ loadTodoGroups }));

const pane = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("../features/chat/ToDoPane", () => ({
    ToDoPane: (props: Record<string, unknown>) => {
        pane.props = props;
        return <div data-testid="todo-pane" />;
    },
}));

const makeProps = (over: Record<string, unknown> = {}) => {
    const hostSetter = vi.fn();
    const useTG = {
        groups: [],
        isLoading: false,
        refresh: vi.fn(async () => {}),
        setGroups: vi.fn(),
    };
    return {
        hostSetter,
        useTG,
        props: {
            target: { kind: "todo" as const },
            onClose: vi.fn(),
            accessToken: "t",
            myself: { userId: "u1", teamId: "team" },
            setMyself: vi.fn(),
            socket: null,
            useTEM: {},
            useUISM: {},
            useCM: { showOnlyInCompleteTodos: false, setShowOnlyInCompleteTodos: hostSetter },
            useTG,
            ...over,
        } as never,
    };
};

beforeEach(() => {
    pane.props = null;
    loadTodoGroups.mockClear();
});
afterEach(cleanup);

const mount = async (propsBag: ReturnType<typeof makeProps>) => {
    await act(async () => {
        render(
            <CssVarsProvider>
                <ModalTodoView
                    {...(propsBag.props as object as Parameters<typeof ModalTodoView>[0])}
                />
            </CssVarsProvider>
        );
    });
};

describe("ModalTodoView — whole list", () => {
    it("renders the pane at once, with no day to focus", async () => {
        await mount(makeProps());
        expect(screen.getByTestId("todo-pane")).toBeTruthy();
        expect(pane.props?.focusTarget).toBeUndefined();
        expect(pane.props?.hostedInModal).toBe(true);
    });

    it("fetches no day and never shows 'unavailable' for an empty list", async () => {
        const bag = makeProps();
        await mount(bag);
        expect(loadTodoGroups).not.toHaveBeenCalled();
        expect(screen.queryByText(/unavailable|not available|can.t be opened/i)).toBeNull();
    });

    it("still refreshes the shared list once, so a stale cache is not what is shown", async () => {
        const bag = makeProps();
        await mount(bag);
        expect(bag.useTG.refresh).toHaveBeenCalledTimes(1);
    });

    it("starts on the user's usual tab, and a chip press stays inside the modal", async () => {
        const bag = makeProps({
            useCM: { showOnlyInCompleteTodos: true, setShowOnlyInCompleteTodos: vi.fn() },
        });
        await mount(bag);
        const cm = pane.props?.useCM as {
            showOnlyInCompleteTodos: boolean;
            setShowOnlyInCompleteTodos: (v: boolean) => void;
        };
        expect(cm.showOnlyInCompleteTodos).toBe(true);
        await act(async () => cm.setShowOnlyInCompleteTodos(false));
        expect(
            (pane.props?.useCM as { showOnlyInCompleteTodos: boolean }).showOnlyInCompleteTodos
        ).toBe(false);
        // The host page's own setter was never called.
        expect(
            (bag.props as { useCM: { setShowOnlyInCompleteTodos: unknown } }).useCM
                .setShowOnlyInCompleteTodos as ReturnType<typeof vi.fn>
        ).not.toHaveBeenCalled();
    });
});

describe("ModalTodoView — a day target is unchanged", () => {
    it("still looks the day up when it is not loaded", async () => {
        const bag = makeProps({ target: { kind: "todo", localDate: "2026-11-05" } });
        await mount(bag);
        expect(loadTodoGroups).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("todo-pane")).toBeNull();
    });
});

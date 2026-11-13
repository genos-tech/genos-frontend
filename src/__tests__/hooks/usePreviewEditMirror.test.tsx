/**
 * The task preview's working copy → the rest of the app (MIP-968).
 *
 * TaskPreview keeps its own working copy of the open task. Whenever that copy
 * changes it has to (a) hand an EDITED copy to the host's preview slot and to
 * the table row, and (b) refresh the assignee / reporter chips, which keep
 * their own state. It used to do (a) through a flag that a hook effect reset
 * (`isTaskUpdated`): every open cost two extra commits, and an edit that landed
 * while the flag was still set was dropped.
 *
 * What must hold:
 *   - a LOAD (the working copy IS the host's preview object) and a self-echo
 *     push nothing, so an open writes nothing to the table;
 *   - an edit (a new object) is handed over, and reaches the row;
 *   - every edit is handed over, even in back-to-back commits;
 *   - the empty working copy of a fresh mount touches neither the host's slot
 *     nor the table;
 *   - a copy of ANOTHER task never overwrites the host's slot: two previews can
 *     be mounted on one slot (the Tasks page and another Home's panel), and
 *     each handing over a copy the other has not caught up with sent them back
 *     and forth, dozens of whole-pane renders per click;
 *   - a copy that says exactly what the shown task says (another object, same content)
 *     does NOT go to the slot: handing it over made the slot and TaskPreview's sync
 *     effect swap their two objects forever, a React "Maximum update depth exceeded"
 *     that blanked the Tasks page on some opens (MIP-1439). It still reaches the row,
 *     which a refused save relies on (the stored task goes back into the working copy
 *     and the slot as two objects of one content, and the row has to follow);
 *   - the chips always show the people of the working copy that arrived.
 */
import { useEffect, useState } from "react";
import { act, render, renderHook } from "@testing-library/react";
import axios, { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePreviewEditMirror } from "../../features/tasks/components/contents/utils/usePreviewEditMirror";
import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));

// Every request any axios instance makes lands here, whichever module makes it:
// the test watches the wire, so a task-meta request added back under any name is
// seen. Every request is answered with an empty list.
const requested: string[] = [];
let originalAdapter: typeof axios.defaults.adapter;
beforeEach(() => {
    requested.length = 0;
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        requested.push(`${config.baseURL ?? ""}${config.url ?? ""}`);
        return { data: [], status: 200, statusText: "OK", headers: {}, config };
    };
});
afterEach(() => {
    axios.defaults.adapter = originalAdapter;
});

// `/note/task/meta/` (task NOTES) is a different endpoint that ends the same way.
const taskMetaRequests = () => requested.filter((url) => /(?<!\/note)\/task\/meta\//.test(url));

const me = { userId: "me", userName: "Me" } as unknown as UserProps;
const person = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

const task = (id: number, over: Partial<TaskProps> = {}): TaskProps =>
    ({
        id,
        title: `Task ${id}`,
        assignee: person(`assignee-${id}`),
        reporter: person(`reporter-${id}`),
        ...over,
    }) as unknown as TaskProps;

const setup = (initial: { working: TaskProps; preview: TaskProps | undefined }) => {
    const calls = {
        setPreview: vi.fn(),
        syncRow: vi.fn(),
        setAssignee: vi.fn(),
        setReporter: vi.fn(),
    };
    const view = renderHook(
        (props: { working: TaskProps; preview: TaskProps | undefined }) =>
            usePreviewEditMirror({ ...props, myself: me, ...calls }),
        { initialProps: initial }
    );
    return { calls, view };
};

describe("usePreviewEditMirror", () => {
    it("an open (the working copy is the host's preview object) writes nothing to the host or the table", () => {
        const loaded = task(1);
        const { calls } = setup({ working: loaded, preview: loaded });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();
    });

    it("an edit hands the new working copy to the host's slot and to the row, once", () => {
        const loaded = task(1);
        const { calls, view } = setup({ working: loaded, preview: loaded });

        const edited = { ...loaded, title: "Edited" };
        view.rerender({ working: edited, preview: loaded });

        expect(calls.setPreview).toHaveBeenCalledTimes(1);
        expect(calls.setPreview).toHaveBeenCalledWith(edited);
        expect(calls.syncRow).toHaveBeenCalledTimes(1);
        expect(calls.syncRow).toHaveBeenCalledWith(edited);
    });

    it("the echo of its own write (preview now is the working copy) does nothing more", () => {
        const loaded = task(1);
        const { calls, view } = setup({ working: loaded, preview: loaded });
        const edited = { ...loaded, title: "Edited" };
        view.rerender({ working: edited, preview: loaded });
        calls.setPreview.mockClear();
        calls.syncRow.mockClear();

        // The host stored it: the preview is now that very object.
        view.rerender({ working: edited, preview: edited });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();
    });

    it("edits in back-to-back commits are ALL handed over (none is swallowed)", () => {
        const loaded = task(1);
        const { calls, view } = setup({ working: loaded, preview: loaded });

        const first = { ...loaded, title: "First" };
        const second = { ...first, title: "Second" };
        // The host has not caught up between the two: the preview is still `loaded`.
        view.rerender({ working: first, preview: loaded });
        view.rerender({ working: second, preview: loaded });

        expect(calls.syncRow.mock.calls.map((c) => (c[0] as TaskProps).title)).toEqual([
            "First",
            "Second",
        ]);
        expect(calls.setPreview.mock.calls.map((c) => (c[0] as TaskProps).title)).toEqual([
            "First",
            "Second",
        ]);
    });

    it("the empty working copy of a fresh mount touches neither the host's slot nor the table", () => {
        const empty = {} as TaskProps;
        const shown = task(1);
        const { calls } = setup({ working: empty, preview: shown });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();

        const none = setup({ working: {} as TaskProps, preview: undefined });
        expect(none.calls.setPreview).not.toHaveBeenCalled();
        expect(none.calls.syncRow).not.toHaveBeenCalled();
    });

    it("a copy of ANOTHER task never overwrites the host's slot", () => {
        const { calls } = setup({ working: task(1), preview: task(2) });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();
    });

    it("a copy with the shown task's exact content (another object) is not handed to the slot, but the row follows it", () => {
        const shown = task(1, { tags: [{ tagId: 1, name: "bug" }] as never });
        const sameContent = { ...shown, tags: [{ tagId: 1, name: "bug" }] } as TaskProps;
        expect(sameContent).not.toBe(shown);
        const { calls } = setup({ working: sameContent, preview: shown });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).toHaveBeenCalledTimes(1);
        expect(calls.syncRow).toHaveBeenCalledWith(sameContent);
        // The chips still follow whatever working copy arrived.
        expect(calls.setAssignee).toHaveBeenCalledWith(sameContent.assignee);
    });

    it("any difference from the shown task is still an edit (a field, a nested value, a removed key)", () => {
        const shown = task(1, {
            tags: [{ tagId: 1, name: "bug" }] as never,
            dueDate: "2026-11-20",
        });
        const differing: Array<[string, TaskProps]> = [
            ["a field", { ...shown, title: "Edited" }],
            ["a nested value", { ...shown, tags: [{ tagId: 1, name: "chore" }] as never }],
            [
                "an added element",
                { ...shown, tags: [...(shown.tags as never[]), { tagId: 2 }] } as never,
            ],
            [
                "a removed key",
                Object.fromEntries(
                    Object.entries(shown).filter(([key]) => key !== "dueDate")
                ) as unknown as TaskProps,
            ],
        ];
        for (const [what, working] of differing) {
            const { calls } = setup({ working, preview: shown });
            expect(calls.setPreview, what).toHaveBeenCalledWith(working);
            expect(calls.syncRow, what).toHaveBeenCalledWith(working);
        }
    });

    it("reverting an edit is an edit: the slot holds the edited copy, so the original content goes over again", () => {
        const original = task(1);
        const edited = { ...original, title: "Edited" };
        const { calls, view } = setup({ working: edited, preview: original });
        // The host stored the edit.
        view.rerender({ working: edited, preview: edited });
        calls.setPreview.mockClear();
        calls.syncRow.mockClear();

        const reverted = { ...original };
        view.rerender({ working: reverted, preview: edited });

        expect(calls.setPreview).toHaveBeenCalledWith(reverted);
        expect(calls.syncRow).toHaveBeenCalledWith(reverted);
    });

    it("a copy with an id still fills a host slot that is empty or holds no task", () => {
        const mine = task(1);
        const empty = setup({ working: mine, preview: undefined });
        expect(empty.calls.setPreview).toHaveBeenCalledWith(mine);
        expect(empty.calls.syncRow).toHaveBeenCalledWith(mine);

        const bare = setup({ working: mine, preview: {} as TaskProps });
        expect(bare.calls.setPreview).toHaveBeenCalledWith(mine);
    });

    it("the chips show the people of the working copy that arrived, on mount and on a switch", () => {
        const a = task(1);
        const b = task(2);
        const { calls, view } = setup({ working: a, preview: a });

        expect(calls.setAssignee).toHaveBeenLastCalledWith(a.assignee);
        expect(calls.setReporter).toHaveBeenLastCalledWith(a.reporter);

        // Task B lands: the working copy is B and so is the host's preview (a load).
        view.rerender({ working: b, preview: b });

        expect(calls.setAssignee).toHaveBeenLastCalledWith(b.assignee);
        expect(calls.setReporter).toHaveBeenLastCalledWith(b.reporter);
        // ...and the load itself pushed nothing.
        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();
    });

    it("a task with no assignee clears the chip, and no reporter falls back to the signed-in user", () => {
        const a = task(1);
        const bare = task(2, { assignee: undefined, reporter: undefined });
        const { calls, view } = setup({ working: a, preview: a });

        view.rerender({ working: bare, preview: bare });

        expect(calls.setAssignee).toHaveBeenLastCalledWith(null);
        expect(calls.setReporter).toHaveBeenLastCalledWith(me);
    });

    it("does nothing on a re-render with the same working copy", () => {
        const loaded = task(1);
        const { calls, view } = setup({ working: loaded, preview: loaded });
        const edited = { ...loaded, title: "Edited" };
        view.rerender({ working: edited, preview: loaded });
        calls.setPreview.mockClear();
        calls.syncRow.mockClear();
        calls.setAssignee.mockClear();

        view.rerender({ working: edited, preview: loaded });

        expect(calls.setPreview).not.toHaveBeenCalled();
        expect(calls.syncRow).not.toHaveBeenCalled();
        expect(calls.setAssignee).not.toHaveBeenCalled();
    });
});

describe("usePreviewEditMirror wired to the real table state", () => {
    const row = (title: string) =>
        ({
            id: "1",
            title,
            priority: "High",
            effortLevel: "M",
            createdDate: "2026-07-01",
            updatedAt: "2026-07-20 10:00:00",
            status: "Open",
            parentTaskId: null,
            rootTaskId: 1,
            teamId: "t1",
            projectId: 10,
            tags: [],
            concatTags: "//",
        }) as unknown as TaskTableProps;
    const full = (title: string): TaskProps =>
        ({
            ...task(1),
            title,
            priority: { priority: "High" },
            effortLevel: { level: "M" },
            status: { status: "Open" },
            createdDate: "2026-07-01",
            updatedAt: "2026-07-20 10:00:00",
            tags: [],
            concatTags: "//",
            rootTaskId: 1,
            project: { projectId: 10 },
        }) as unknown as TaskProps;

    it("an open leaves the table and the network alone; an edit reaches the row; neither asks the server for task meta", async () => {
        const meUser = { userId: "u1", teamId: "t1" } as unknown as UserProps;
        const view = renderHook(
            (props: { working: TaskProps }) => {
                const tm = useTaskManagement(meUser, "token");
                usePreviewEditMirror({
                    working: props.working,
                    preview: tm.currentPreviewTask,
                    myself: meUser,
                    setPreview: tm.setCurrentPreviewTask,
                    syncRow: tm.syncPreviewEdit,
                    setAssignee: vi.fn(),
                    setReporter: vi.fn(),
                });
                return tm;
            },
            { initialProps: { working: full("Original") } }
        );
        act(() => view.result.current.setAllTasks([row("Original")]));
        const tableBefore = view.result.current.allTasks;

        // The open: the host's preview becomes the loaded task, and the
        // working copy follows it (the same object).
        const loaded = full("Original");
        act(() => view.result.current.setCurrentPreviewTask(loaded));
        view.rerender({ working: loaded });
        await act(async () => {});

        expect(view.result.current.allTasks).toBe(tableBefore);

        // The edit: a new working copy.
        view.rerender({ working: { ...loaded, title: "Edited" } });
        await act(async () => {});

        expect(view.result.current.allTasks[0].title).toBe("Edited");
        expect(view.result.current.currentPreviewTask?.title).toBe("Edited");
        expect(taskMetaRequests()).toEqual([]);

        // The other fields that used to make the host refetch task meta: status,
        // parent and project. Each reaches the row, none reaches the server.
        view.rerender({
            working: {
                ...loaded,
                title: "Edited",
                status: { status: "WIP" },
                parentTaskId: 7,
                project: { projectId: 11 },
            } as unknown as TaskProps,
        });
        await act(async () => {});

        const edited = view.result.current.allTasks[0];
        expect(edited.status).toBe("WIP");
        expect(edited.parentTaskId).toBe("7");
        expect(edited.projectId).toBe(11);
        expect(taskMetaRequests()).toEqual([]);
    });
});

describe("usePreviewEditMirror with two previews on one host slot", () => {
    // What the app does when a second TaskPreview is mounted on the same slot
    // (the Tasks page plus another Home's panel): each keeps its own working
    // copy, pulls the slot's task into it (TaskPreview's sync effect), and hands
    // its copy to the slot through the mirror. One of them starts empty.
    const Preview = ({
        name,
        slot,
        setSlot,
        initial,
        pushes,
    }: {
        name: string;
        slot: TaskProps | undefined;
        setSlot: (t: TaskProps) => void;
        initial: TaskProps;
        pushes: string[];
    }) => {
        const [working, setWorking] = useState<TaskProps>(initial);
        useEffect(() => {
            if (slot && slot !== working) setWorking(slot);
        }, [slot]);
        usePreviewEditMirror({
            working,
            preview: slot,
            myself: me,
            setPreview: (t) => {
                pushes.push(`${name}:${t?.id ?? "none"}`);
                setSlot(t);
            },
            syncRow: () => {},
            setAssignee: () => {},
            setReporter: () => {},
        });
        return <span data-testid={name}>{String(working?.id ?? "none")}</span>;
    };

    it("settles on the shown task with no pushes, instead of overwriting each other", async () => {
        const shown = task(7);
        const pushes: string[] = [];
        let renders = 0;
        const Harness = () => {
            renders += 1;
            // Fail fast instead of hanging if the two previews fight over the slot.
            if (renders > 60) throw new Error("previews are overwriting each other");
            const [slot, setSlot] = useState<TaskProps | undefined>(shown);
            return (
                <>
                    <Preview
                        initial={shown}
                        name="tasks"
                        pushes={pushes}
                        setSlot={setSlot}
                        slot={slot}
                    />
                    <Preview
                        initial={{} as TaskProps}
                        name="other"
                        pushes={pushes}
                        setSlot={setSlot}
                        slot={slot}
                    />
                </>
            );
        };

        const view = render(<Harness />);
        await act(async () => {});

        expect(pushes).toEqual([]);
        expect(view.getByTestId("tasks").textContent).toBe("7");
        expect(view.getByTestId("other").textContent).toBe("7");
        expect(renders).toBeLessThan(6);
    });
});

describe("usePreviewEditMirror beside TaskPreview's sync effect (MIP-1439)", () => {
    // TaskPreview pulls the host's task into its working copy whenever the slot
    // changes (its sync effect), and this hook pushes the working copy into the
    // slot whenever it changes. Given two objects with the same content, one in
    // each place, both effects fire in the same commit and each takes the other's
    // object, so the next commit they have swapped, and so on for ever.
    const Host = ({
        shown,
        working0,
        counters,
    }: {
        shown: TaskProps;
        working0: TaskProps;
        counters: { renders: number; pushes: number; rows: number };
    }) => {
        counters.renders += 1;
        // Fail fast instead of waiting for React's 50 nested updates.
        if (counters.renders > 40) throw new Error("the slot and the working copy are swapping");
        const [slot, setSlot] = useState<TaskProps | undefined>(shown);
        const [working, setWorking] = useState<TaskProps>(working0);
        // TaskPreview's sync effect, as it matters here: take the slot's task when it is not the
        // working copy. Keyed on the slot alone, like the real one.
        useEffect(() => {
            if (slot && slot !== working) setWorking(slot);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [slot]);
        usePreviewEditMirror({
            working,
            preview: slot,
            myself: me,
            setPreview: (t) => {
                counters.pushes += 1;
                setSlot(t);
            },
            syncRow: () => {
                counters.rows += 1;
            },
            setAssignee: () => {},
            setReporter: () => {},
        });
        return <span data-testid="seen">{`${slot?.title}|${working.title}`}</span>;
    };

    it("two objects with the same content settle at once instead of swapping", async () => {
        const shown = task(7, { title: "Same" });
        const counters = { renders: 0, pushes: 0, rows: 0 };

        const view = render(<Host counters={counters} shown={shown} working0={{ ...shown }} />);
        await act(async () => {});

        expect(counters.pushes).toBe(0);
        // The row hears about it once, not every commit.
        expect(counters.rows).toBeLessThanOrEqual(2);
        expect(counters.renders).toBeLessThan(6);
        expect(view.getByTestId("seen").textContent).toBe("Same|Same");
    });
});

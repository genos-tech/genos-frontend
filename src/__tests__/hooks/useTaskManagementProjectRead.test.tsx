/**
 * Reading a project's rows into the table (MIP-969, step 1).
 *
 * `fetchProjectTasks` reads the project's rows from IndexedDB and hands them
 * to `allTasks`. Two things were wrong with how the answer landed:
 *
 *   - It never asked whether the project it read for was still the open one.
 *     A slow read for A that came back after the user clicked B wrote A's rows
 *     under B (and an old team's rows under the new team).
 *   - Its "nothing changed" check was all-or-nothing: if one row differed,
 *     every row got a new object, so the whole table re-rendered for one edit.
 *
 * What must hold:
 *   - an answer for a project / team that is no longer current is dropped;
 *   - of two reads for the same project only the newest lands;
 *   - the loading flag belongs to the newest read (an older one landing must
 *     not flip it off while the newer one is still in flight);
 *   - the same ids and `updatedAt` leave `allTasks` as the very same array;
 *   - otherwise unchanged rows keep their object, and only the changed ones are
 *     new; added rows appear and removed rows disappear;
 *   - two components that both ask for a read (the Tasks page and another Home
 *     that stays mounted) settle in a bounded number of renders.
 */
import { useEffect } from "react";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
import { mergeProjectRows } from "../../features/tasks/utils/mergeProjectRows";
import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: vi.fn(),
}));
vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));
vi.mock("../../features/notes/task-notes/services/loadTaskMeta", () => ({
    loadTaskMeta: vi.fn(async () => []),
}));

const read = vi.mocked(popSpecificProjectTasks);

const me = (teamId: string) =>
    ({ userId: "u1", teamId, userName: "Me", userEmail: "m@x.io" }) as unknown as UserProps;

const A = 10;
const B = 20;

const row = (id: number, projectId: number, updatedAt = "2026-11-01 10:00:00", title = `T${id}`) =>
    ({
        id: String(id),
        title,
        updatedAt,
        status: "Open",
        projectId,
        teamId: "t1",
        tags: [],
    }) as unknown as TaskTableProps;

const ids = (rows: TaskTableProps[]) => rows.map((r) => r.id);

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

type Props = { projectId: number | null; teamId?: string; currentTeamId?: string };

/** The hook as the workspace builds it: project and team arrive as props. */
const setup = (initial: Props) =>
    renderHook(
        ({ projectId, teamId = "t1", currentTeamId = "t1" }: Props) =>
            useTaskManagement(me(teamId), "token", projectId, { currentTeamId }),
        { initialProps: initial }
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe("fetchProjectTasks — late reads", () => {
    it("lands the rows of the open project", async () => {
        read.mockResolvedValueOnce([row(1, A), row(2, A)]);
        const view = setup({ projectId: A });

        await act(async () => {
            await view.result.current.fetchProjectTasks(A);
        });

        expect(ids(view.result.current.allTasks)).toEqual(["1", "2"]);
        expect(view.result.current.isLoadingTasks).toBe(false);
    });

    it("drops a read for A that lands after the user moved to B", async () => {
        const dA = deferred<TaskTableProps[]>();
        const dB = deferred<TaskTableProps[]>();
        read.mockImplementation(((projectId: number) =>
            projectId === A ? dA.promise : dB.promise) as never);
        const view = setup({ projectId: A });

        act(() => void view.result.current.fetchProjectTasks(A));
        view.rerender({ projectId: B });
        act(() => void view.result.current.fetchProjectTasks(B));

        dB.resolve([row(5, B)]);
        await flush();
        expect(ids(view.result.current.allTasks)).toEqual(["5"]);

        // A's answer arrives late. It must not touch B's table.
        dA.resolve([row(1, A), row(2, A)]);
        await flush();
        expect(ids(view.result.current.allTasks)).toEqual(["5"]);
    });

    it("drops a read for A that lands after the user moved to B, even if B has not been read yet", async () => {
        const dA = deferred<TaskTableProps[]>();
        read.mockImplementation((() => dA.promise) as never);
        const view = setup({ projectId: A });

        act(() => void view.result.current.fetchProjectTasks(A));
        view.rerender({ projectId: B });

        dA.resolve([row(1, A)]);
        await flush();

        expect(view.result.current.allTasks).toEqual([]);
        // Nothing else is reading, so the flag must not stay stuck on.
        expect(view.result.current.isLoadingTasks).toBe(false);
    });

    it("drops a read that lands after the team changed", async () => {
        const d = deferred<TaskTableProps[]>();
        read.mockImplementation((() => d.promise) as never);
        const view = setup({ projectId: A, teamId: "t1", currentTeamId: "t1" });

        act(() => void view.result.current.fetchProjectTasks(A));
        view.rerender({ projectId: A, teamId: "t2", currentTeamId: "t2" });

        d.resolve([row(1, A)]);
        await flush();

        expect(view.result.current.allTasks).toEqual([]);
    });

    it("lets only the newest of two reads for the same project land", async () => {
        const first = deferred<TaskTableProps[]>();
        const second = deferred<TaskTableProps[]>();
        read.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(
            second.promise as never
        );
        const view = setup({ projectId: A });

        act(() => void view.result.current.fetchProjectTasks(A));
        act(() => void view.result.current.fetchProjectTasks(A));

        // The newer answer arrives first, the older one (a staler snapshot) after.
        second.resolve([row(1, A, "2026-11-01 12:00:00", "fresh")]);
        await flush();
        first.resolve([row(1, A, "2026-11-01 10:00:00", "stale")]);
        await flush();

        expect(view.result.current.allTasks.map((r) => r.title)).toEqual(["fresh"]);
    });

    it("an older read landing does not turn the loading flag off while a newer read is in flight", async () => {
        const first = deferred<TaskTableProps[]>();
        const second = deferred<TaskTableProps[]>();
        read.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(
            second.promise as never
        );
        const view = setup({ projectId: A });

        act(() => void view.result.current.fetchProjectTasks(A));
        act(() => void view.result.current.fetchProjectTasks(A));
        expect(view.result.current.isLoadingTasks).toBe(true);

        first.resolve([row(1, A)]);
        await flush();
        // The newer read has not answered: still loading, and the older answer is not shown.
        expect(view.result.current.isLoadingTasks).toBe(true);
        expect(view.result.current.allTasks).toEqual([]);

        second.resolve([row(1, A)]);
        await flush();
        expect(view.result.current.isLoadingTasks).toBe(false);
        expect(ids(view.result.current.allTasks)).toEqual(["1"]);
    });
});

describe("fetchProjectTasks — keeping row identity", () => {
    const load = async (view: ReturnType<typeof setup>, rows: TaskTableProps[]) => {
        read.mockResolvedValueOnce(rows);
        await act(async () => {
            await view.result.current.fetchProjectTasks(A);
        });
    };

    it("an unchanged answer leaves allTasks as the very same array", async () => {
        const view = setup({ projectId: A });
        await load(view, [row(1, A), row(2, A)]);
        const before = view.result.current.allTasks;

        // A fresh read: new objects with the same ids and updatedAt.
        await load(view, [row(1, A), row(2, A)]);

        expect(view.result.current.allTasks).toBe(before);
    });

    it("one changed row is the only new object; the others keep theirs", async () => {
        const view = setup({ projectId: A });
        await load(view, [row(1, A), row(2, A), row(3, A)]);
        const before = view.result.current.allTasks;
        const [r1, r2, r3] = before;

        await load(view, [
            row(1, A),
            row(2, A, "2026-11-01 11:00:00", "edited elsewhere"),
            row(3, A),
        ]);

        const after = view.result.current.allTasks;
        expect(after).not.toBe(before);
        expect(after[0]).toBe(r1);
        expect(after[2]).toBe(r3);
        expect(after[1]).not.toBe(r2);
        expect(after[1].title).toBe("edited elsewhere");
    });

    it("an added row appears and the others keep their objects", async () => {
        const view = setup({ projectId: A });
        await load(view, [row(1, A)]);
        const [r1] = view.result.current.allTasks;

        await load(view, [row(1, A), row(2, A)]);

        const after = view.result.current.allTasks;
        expect(ids(after)).toEqual(["1", "2"]);
        expect(after[0]).toBe(r1);
    });

    it("a removed row disappears (a change made while away)", async () => {
        const view = setup({ projectId: A });
        await load(view, [row(1, A), row(2, A), row(3, A)]);
        const [r1, , r3] = view.result.current.allTasks;

        await load(view, [row(1, A), row(3, A)]);

        const after = view.result.current.allTasks;
        expect(ids(after)).toEqual(["1", "3"]);
        expect(after[0]).toBe(r1);
        expect(after[1]).toBe(r3);
    });

    it("one row swapped for another of the same count is a change, not a match", async () => {
        const view = setup({ projectId: A });
        await load(view, [row(1, A), row(2, A)]);
        const before = view.result.current.allTasks;

        await load(view, [row(1, A), row(3, A)]);

        expect(view.result.current.allTasks).not.toBe(before);
        expect(ids(view.result.current.allTasks)).toEqual(["1", "3"]);
    });
});

describe("mergeProjectRows", () => {
    it("returns prev for the same rows in another order (a status move already changes updatedAt)", () => {
        const prev = [row(1, A), row(2, A)];
        expect(mergeProjectRows(prev, [row(2, A), row(1, A)])).toBe(prev);
    });

    it("duplicates in the answer do not hide a missing row", () => {
        const prev = [row(1, A), row(2, A)];
        const merged = mergeProjectRows(prev, [row(1, A), row(1, A)]);
        expect(merged).not.toBe(prev);
        expect(ids(merged)).toEqual(["1", "1"]);
    });

    it("rows without an id are never matched", () => {
        const noId = { ...row(1, A), id: null } as unknown as TaskTableProps;
        const prev = [noId];
        const merged = mergeProjectRows(prev, [{ ...noId }]);
        expect(merged).not.toBe(prev);
    });

    it("an empty answer for an empty table keeps the same array", () => {
        const prev: TaskTableProps[] = [];
        expect(mergeProjectRows(prev, [])).toBe(prev);
    });
});

describe("fetchProjectTasks — two components asking for the same read", () => {
    it("settles in a bounded number of renders and lands the rows once", async () => {
        read.mockImplementation((async (projectId: number) => [
            row(1, projectId),
            row(2, projectId),
        ]) as never);

        let renders = 0;
        const Probe = ({
            name,
            useTM,
            projectId,
        }: {
            name: string;
            useTM: ReturnType<typeof useTaskManagement>;
            projectId: number;
        }) => {
            renders += 1;
            // Fail fast instead of hanging if the two readers keep re-triggering each other.
            if (renders > 80) throw new Error(`readers are looping (${name})`);
            // What TaskHomeContent and the project effect do: ask for a read
            // when the project id is known.
            useEffect(() => {
                void useTM.fetchProjectTasks(projectId);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [projectId]);
            return <span data-testid={name}>{useTM.allTasks.length}</span>;
        };
        const Host = ({ projectId }: { projectId: number }) => {
            const useTM = useTaskManagement(me("t1"), "token", projectId, { currentTeamId: "t1" });
            return (
                <>
                    <Probe name="tasks" projectId={projectId} useTM={useTM} />
                    <Probe name="other" projectId={projectId} useTM={useTM} />
                </>
            );
        };

        const view = render(<Host projectId={A} />);
        await flush();
        await flush();
        expect(view.getByTestId("tasks").textContent).toBe("2");
        expect(view.getByTestId("other").textContent).toBe("2");
        // Two readers, one project: two reads, only the newest lands.
        expect(read).toHaveBeenCalledTimes(2);
        const afterMount = renders;
        expect(afterMount).toBeLessThan(30);

        view.rerender(<Host projectId={B} />);
        await flush();
        await flush();
        expect(view.getByTestId("tasks").textContent).toBe("2");
        expect(read).toHaveBeenCalledTimes(4);
        expect(renders - afterMount).toBeLessThan(30);
    });
});

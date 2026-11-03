/**
 * Painting a project's rows from memory (MIP-969, step 3).
 *
 * The rows of the last five projects are kept in memory, per team and project.
 * When the open project changes, `allTasks` is set in the SAME render to the
 * cached rows (or to nothing on a miss), so that
 *   - a switch back paints at once, with no empty table in between, and
 *   - no commit ever shows project B with project A's rows (nor the reverse).
 * The read of IndexedDB that follows a switch is the reconcile: it changes only
 * what changed.
 *
 * These tests look at COMMITS (a layout effect records what each commit holds),
 * not at render calls: the swap is a state update during render, so React
 * throws away the render it was made in and renders again, and only the second
 * one is ever committed.
 */
import { StrictMode, useLayoutEffect, useRef } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { popSpecificProjectTasks } from "../../features/tasks/services/popSpecificProjectTasks";
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

const T1 = "2026-11-01 10:00:00";
const T2 = "2026-11-01 11:00:00";

const row = (id: number, projectId: number, updatedAt = T1, teamId = "t1") =>
    ({
        id: String(id),
        title: `T${id}`,
        updatedAt,
        status: "Open",
        projectId,
        teamId,
        tags: [],
    }) as unknown as TaskTableProps;

// What IndexedDB holds, per project. A test changes it to model "a change made
// while away".
let store: Record<number, TaskTableProps[]>;

type Commit = {
    project: number | null;
    ids: string[];
    rowProjects: number[];
    loading: boolean;
    rows: TaskTableProps[];
};
let commits: Commit[];
let live: ReturnType<typeof useTaskManagement>;

type Props = { projectId: number | null; teamId?: string; currentTeamId?: string };

const Host = ({ projectId, teamId = "t1", currentTeamId = "t1" }: Props) => {
    const useTM = useTaskManagement(me(teamId), "token", projectId, { currentTeamId });
    live = useTM;
    useLayoutEffect(() => {
        commits.push({
            project: projectId,
            ids: useTM.allTasks.map((r) => String(r.id)),
            rowProjects: [...new Set(useTM.allTasks.map((r) => Number(r.projectId)))],
            loading: useTM.isLoadingTasks,
            rows: useTM.allTasks,
        });
    });
    return null;
};

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

const mount = (props: Props, strict = false) => {
    const wrap = (p: Props) =>
        strict ? (
            <StrictMode>
                <Host {...p} />
            </StrictMode>
        ) : (
            <Host {...p} />
        );
    const view = render(wrap(props));
    return {
        goto: (next: Props) => view.rerender(wrap(next)),
        unmount: () => view.unmount(),
    };
};

/** Open `projectId` (as the workspace does) and let its read land. */
const visit = async (
    view: ReturnType<typeof mount>,
    projectId: number | null,
    scope: Omit<Props, "projectId"> = {}
) => {
    act(() => view.goto({ projectId, ...scope }));
    if (projectId !== null) {
        await act(async () => {
            await live.fetchProjectTasks(projectId);
        });
    }
    await flush();
};

/** The commits made by `fn` alone. */
const during = async (fn: () => void | Promise<void>) => {
    const from = commits.length;
    await fn();
    return commits.slice(from);
};

const ids = (c: Commit) => c.ids;
const noForeignRows = (list: Commit[]) =>
    list.every((c) => c.rowProjects.every((p) => p === c.project));

beforeEach(() => {
    vi.clearAllMocks();
    commits = [];
    store = {
        10: [row(1, 10), row(2, 10), row(3, 10)],
        20: [row(5, 20), row(6, 20)],
        30: [row(8, 30)],
        40: [row(9, 40)],
        50: [row(11, 50)],
        60: [row(12, 60)],
    };
    read.mockImplementation((async (projectId: number) => store[projectId] ?? []) as never);
});

describe("switching back paints from memory", () => {
    it("A -> B -> A: the first commit after the switch already holds A's rows, and none was empty", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
            await flush();
        });

        // The commit made for the switch itself (before any read could land).
        expect(back[0].project).toBe(10);
        expect(ids(back[0])).toEqual(["1", "2", "3"]);
        // Not one commit of the whole switch showed an empty table or B's rows.
        expect(back.every((c) => c.ids.length === 3)).toBe(true);
        expect(noForeignRows(back)).toBe(true);
    });

    it("under Strict Mode (every render runs twice) a switch back still paints from memory", async () => {
        const view = mount({ projectId: 10 }, true);
        await visit(view, 10);
        await visit(view, 20);
        await visit(view, 30);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });

        expect(ids(back[0])).toEqual(["1", "2", "3"]);
        expect(noForeignRows(back)).toBe(true);
        const toTwenty = await during(async () => {
            act(() => view.goto({ projectId: 20 }));
        });
        expect(ids(toTwenty[0])).toEqual(["5", "6"]);
        expect(noForeignRows(commits)).toBe(true);
    });

    it("the first visit of a project is a miss: an empty table with the spinner, not the old project's rows", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);

        const first = await during(async () => {
            act(() => view.goto({ projectId: 20 }));
        });

        expect(first[0].project).toBe(20);
        expect(first[0].ids).toEqual([]);
        expect(first[0].loading).toBe(true);
    });

    it("no commit ever pairs a project with another project's rows, whatever the route", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        await visit(view, 10);
        await visit(view, 30);
        await visit(view, null);
        await visit(view, 20);
        await visit(view, 10);

        expect(noForeignRows(commits)).toBe(true);
        // ...and the table ended on A's rows.
        expect(ids(commits[commits.length - 1])).toEqual(["1", "2", "3"]);
    });

    it("a switch that never read (Recents, Back/Forward, chat) swaps the rows too", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);

        // The project changes with no read at all.
        const swap = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });
        expect(ids(swap[0])).toEqual(["1", "2", "3"]);
        const swap2 = await during(async () => {
            act(() => view.goto({ projectId: 20 }));
        });
        expect(ids(swap2[0])).toEqual(["5", "6"]);
    });

    it("a project with no tasks is a valid hit: no spinner, no stale rows", async () => {
        store[10] = [];
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });

        expect(back[0].ids).toEqual([]);
        expect(back[0].loading).toBe(false);
    });

    it("rows that were never read are not remembered (a switch before the read landed)", async () => {
        const view = mount({ projectId: 10 });
        // A is opened and left before its read lands; an optimistic row is all it holds.
        act(() => view.goto({ projectId: 10 }));
        act(() => live.setAllTasks([row(99, 10)]));
        await visit(view, 20);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });

        expect(back[0].ids).toEqual([]);
        expect(back[0].loading).toBe(true);
    });

    it("a row of another project in the table is not remembered under this project", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        // loadUpdatedTask can upsert a row of another project.
        act(() => live.setAllTasks((prev) => [...prev, row(77, 99)]));
        await visit(view, 20);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });

        expect(back[0].ids).toEqual(["1", "2", "3"]);
    });

    it("leaving to no project and coming back paints from memory", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);

        const away = await during(async () => {
            act(() => view.goto({ projectId: null }));
        });
        expect(away[0].ids).toEqual([]);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10 }));
        });
        expect(ids(back[0])).toEqual(["1", "2", "3"]);
    });
});

describe("the reconcile after a hit", () => {
    it("an unchanged reconcile leaves the painted array in place", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        act(() => view.goto({ projectId: 10 }));
        const painted = live.allTasks;
        expect(painted.map((r) => r.id)).toEqual(["1", "2", "3"]);

        // IndexedDB holds equal rows (new objects, as every read returns).
        store[10] = [row(1, 10), row(2, 10), row(3, 10)];
        const settle = await during(async () => {
            await act(async () => {
                await live.fetchProjectTasks(10);
            });
        });

        expect(live.allTasks).toBe(painted);
        // The read itself costs at most the loading flag flipping, never a new table.
        expect(settle.every((c) => c.rows === painted)).toBe(true);
    });

    it("a change made while away shows after the reconcile; the others keep their objects", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        act(() => view.goto({ projectId: 10 }));
        const [r1, r2, r3] = live.allTasks;

        // Away, task 2 was edited elsewhere.
        store[10] = [row(1, 10), { ...row(2, 10, T2), title: "edited" }, row(3, 10)];
        await act(async () => {
            await live.fetchProjectTasks(10);
        });

        expect(live.allTasks[0]).toBe(r1);
        expect(live.allTasks[2]).toBe(r3);
        expect(live.allTasks[1]).not.toBe(r2);
        expect(live.allTasks[1].title).toBe("edited");
    });

    it("a row removed while away disappears after the reconcile", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        act(() => view.goto({ projectId: 10 }));
        expect(live.allTasks.map((r) => r.id)).toEqual(["1", "2", "3"]);

        store[10] = [row(1, 10), row(3, 10)];
        await act(async () => {
            await live.fetchProjectTasks(10);
        });

        expect(live.allTasks.map((r) => r.id)).toEqual(["1", "3"]);
    });

    it("a late read for A that lands after the switch to B leaves B's rows alone", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        // Back to A: its reconcile read starts, but the user moves on to B before it lands.
        let land!: (rows: TaskTableProps[]) => void;
        read.mockImplementationOnce(
            (() =>
                new Promise<TaskTableProps[]>((resolve) => {
                    land = resolve;
                })) as never
        );
        act(() => view.goto({ projectId: 10 }));
        act(() => void live.fetchProjectTasks(10));
        act(() => view.goto({ projectId: 20 }));
        expect(live.allTasks.map((r) => r.id)).toEqual(["5", "6"]);

        await act(async () => land([row(1, 10), row(2, 10)]));
        await flush();

        expect(live.allTasks.map((r) => r.id)).toEqual(["5", "6"]);
        expect(noForeignRows(commits)).toBe(true);
    });
});

describe("what is remembered, and for how long", () => {
    it("keeps the last five projects in memory, the open one included: the sixth visit evicts the oldest", async () => {
        const view = mount({ projectId: 10 });
        for (const p of [10, 20, 30, 40, 50, 60]) await visit(view, p);

        // At 60. 20..50 are among the last five; 10 is the oldest of six.
        const toTwenty = await during(async () => act(() => view.goto({ projectId: 20 })));
        expect(toTwenty[0].ids).toEqual(["5", "6"]);
        const toTen = await during(async () => act(() => view.goto({ projectId: 10 })));
        expect(toTen[0].ids).toEqual([]);
    });

    it("a switch back refreshes how recently the project was used", async () => {
        const view = mount({ projectId: 10 });
        for (const p of [10, 20, 30, 40, 50]) await visit(view, p);
        // Touch 10 again (it would be the next to go), then open a sixth.
        await visit(view, 10);
        await visit(view, 60);

        // 20 was the oldest after that; 10 survived.
        const toTen = await during(async () => act(() => view.goto({ projectId: 10 })));
        expect(toTen[0].ids).toEqual(["1", "2", "3"]);
        const toTwenty = await during(async () => act(() => view.goto({ projectId: 20 })));
        expect(toTwenty[0].ids).toEqual([]);
    });

    it("a team switch forgets everything, and stores nothing from the old team", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);

        // The user moves to team 2 while A is still the open project.
        const switched = await during(async () => {
            act(() => view.goto({ projectId: 10, teamId: "t2", currentTeamId: "t2" }));
        });
        expect(switched[0].ids).toEqual([]);

        // Back to team 1: nothing was kept.
        const back = await during(async () => {
            act(() => view.goto({ projectId: 10, teamId: "t1", currentTeamId: "t1" }));
        });
        expect(back[0].ids).toEqual([]);
        await act(async () => view.goto({ projectId: 20, teamId: "t1", currentTeamId: "t1" }));
        expect(live.allTasks).toEqual([]);
    });

    it("either half of the team (myself.teamId, or the workspace's team) changing starts from nothing", async () => {
        for (const change of [{ teamId: "t2" }, { currentTeamId: "t2" }]) {
            commits = [];
            const view = mount({ projectId: 10 });
            await visit(view, 10);
            await visit(view, 20);

            const switched = await during(async () => {
                act(() => view.goto({ projectId: 10, ...change }));
            });
            expect(switched[0].ids).toEqual([]);
            view.unmount();
        }
    });

    it("the same project seen from another team (the guest's view of a shared project) is a miss", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);

        // Same project id, other team scope: another entry, not this one.
        const guest = await during(async () => {
            act(() => view.goto({ projectId: 10, teamId: "g1", currentTeamId: "g1" }));
        });

        expect(guest[0].ids).toEqual([]);
    });

    it("a shared project's host-team rows still paint from memory in the guest's team", async () => {
        store[10] = [row(1, 10, T1, "host"), row(2, 10, T1, "host")];
        const guest = { teamId: "g1", currentTeamId: "g1" };
        const view = mount({ projectId: 10, ...guest });
        await visit(view, 10, guest);
        await visit(view, 20, guest);

        const back = await during(async () => {
            act(() => view.goto({ projectId: 10, ...guest }));
        });

        expect(back[0].ids).toEqual(["1", "2"]);
    });

    it("dropCachedProjectRows forgets one project", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        await visit(view, 30);

        act(() => live.dropCachedProjectRows(10));

        const toTen = await during(async () => act(() => view.goto({ projectId: 10 })));
        expect(toTen[0].ids).toEqual([]);
        const toTwenty = await during(async () => act(() => view.goto({ projectId: 20 })));
        expect(toTwenty[0].ids).toEqual(["5", "6"]);
    });

    it("pruneCachedProjectRows forgets the projects that are no longer listed", async () => {
        const view = mount({ projectId: 10 });
        await visit(view, 10);
        await visit(view, 20);
        await visit(view, 30);

        act(() => live.pruneCachedProjectRows([20, 30]));

        const toTen = await during(async () => act(() => view.goto({ projectId: 10 })));
        expect(toTen[0].ids).toEqual([]);
        const toTwenty = await during(async () => act(() => view.goto({ projectId: 20 })));
        expect(toTwenty[0].ids).toEqual(["5", "6"]);
    });
});

describe("two components asking for the same switch", () => {
    it("settle on the project's rows in one swap and a bounded number of commits", async () => {
        let renders = 0;
        type TM = ReturnType<typeof useTaskManagement>;
        const Probe = ({
            name,
            useTM,
            projectId,
        }: {
            name: string;
            useTM: TM;
            projectId: number;
        }) => {
            renders += 1;
            // Fail fast instead of hanging if the two keep swapping.
            if (renders > 150) throw new Error(`swapping in a loop (${name})`);
            // Both ask for the read of the open project, as the Tasks page and
            // another Home that stays mounted do.
            const asked = useRef<number | null>(null);
            useLayoutEffect(() => {
                if (asked.current === projectId) return;
                asked.current = projectId;
                void useTM.fetchProjectTasks(projectId);
            });
            return <span data-testid={name}>{useTM.allTasks.length}</span>;
        };
        const Two = ({ projectId }: { projectId: number }) => {
            const useTM = useTaskManagement(me("t1"), "token", projectId, { currentTeamId: "t1" });
            live = useTM;
            useLayoutEffect(() => {
                commits.push({
                    project: projectId,
                    ids: useTM.allTasks.map((r) => String(r.id)),
                    rowProjects: [...new Set(useTM.allTasks.map((r) => Number(r.projectId)))],
                    loading: useTM.isLoadingTasks,
                    rows: useTM.allTasks,
                });
            });
            return (
                <>
                    <Probe name="tasks" projectId={projectId} useTM={useTM} />
                    <Probe name="other" projectId={projectId} useTM={useTM} />
                </>
            );
        };

        const view = render(<Two projectId={10} />);
        await flush();
        await flush();
        view.rerender(<Two projectId={20} />);
        await flush();
        await flush();
        const before = renders;
        const from = commits.length;
        view.rerender(<Two projectId={10} />);
        await flush();
        await flush();

        // A -> B -> A: back on A with its rows, no foreign pairing at any commit,
        // and the switch cost a handful of commits.
        expect(view.getByTestId("tasks").textContent).toBe("3");
        expect(view.getByTestId("other").textContent).toBe("3");
        expect(noForeignRows(commits)).toBe(true);
        expect(commits[from].ids).toEqual(["1", "2", "3"]);
        expect(commits.length - from).toBeLessThan(8);
        expect(renders - before).toBeLessThan(40);
    });
});

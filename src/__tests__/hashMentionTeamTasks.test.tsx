/**
 * `#` task suggestions span every project, not just the open one.
 *
 * `useTM.allTasks` is the OPEN project's table data, so before the team
 * list was merged in, a task in any other project was unmentionable — and
 * unlike the note/project staleness, reloading didn't help (the reload
 * restores the same `lastProjectId`).
 *
 * Covered here: the union, the dedupe when a task is in both sources, and
 * the project name on the row — the only thing telling two same-named
 * tasks in different projects apart now that the menu is team-wide.
 */

import { describe, expect, it, vi } from "vitest";

import { HashMentionMenuItems } from "../components/editors/HashMention";
import { HashMentionData } from "../context/HashMentionDataContext";
import { SearchTeamTasksResponse, TaskTableProps } from "../types/tasks";

const openProjectTask = (over: Partial<TaskTableProps>): TaskTableProps =>
    ({
        id: "1",
        projectId: 1,
        displayId: "GEN-1",
        title: "Open project task",
        ...over,
    }) as unknown as TaskTableProps;

const teamTask = (over: Partial<SearchTeamTasksResponse>): SearchTeamTasksResponse =>
    ({
        projectId: 2,
        projectName: "Marketing",
        taskId: 9,
        displayId: "MKT-9",
        title: "Launch post",
        ...over,
    }) as unknown as SearchTeamTasksResponse;

const dataWith = (over: Partial<HashMentionData>): HashMentionData => ({
    tasks: [],
    teamTasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: null,
    refresh: () => {},
    ...over,
});

// A fresh object per call — the builder caches per editor identity.
const newEditor = () => ({ insertInlineContent: vi.fn() });

/** The row label the menu renders lives in `icon`; read its props tree. */
const subtitleOf = (item: { icon?: unknown }): string => {
    const json = JSON.stringify(item.icon ?? {});
    const match = json.match(/"Task · [^"]*"/);
    return match ? match[0].slice(1, -1) : "";
};

describe("HashMentionMenuItems — task sources", () => {
    it("offers tasks from other projects, not just the open one", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                tasks: [openProjectTask({})],
                teamTasks: [teamTask({})],
            })
        );

        expect(items.map((i) => i.title)).toEqual(["GEN-1", "MKT-9"]);
    });

    it("lists a task once when it appears in both sources", () => {
        // The open project's rows are in the team list too — the same task
        // must not show up twice.
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                tasks: [openProjectTask({ id: "1", projectId: 1 })],
                teamTasks: [
                    teamTask({ projectId: 1, taskId: 1, displayId: "GEN-1", title: "stale copy" }),
                    teamTask({}),
                ],
            })
        );

        expect(items).toHaveLength(2);
        // The open-project copy wins: it's the fresher of the two.
        expect(items[0].aliases).toEqual(["Open project task"]);
    });

    it("does not confuse tasks with the same id in different projects", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                tasks: [openProjectTask({ id: "5", projectId: 1, displayId: "GEN-5" })],
                teamTasks: [teamTask({ projectId: 2, taskId: 5, displayId: "MKT-5" })],
            })
        );

        expect(items.map((i) => i.title)).toEqual(["GEN-5", "MKT-5"]);
    });

    it("names the project on each row", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                teamTasks: [teamTask({})],
                projects: [
                    {
                        projectId: 2,
                        projectName: "Marketing",
                    } as unknown as HashMentionData["projects"][number],
                ],
            })
        );

        expect(subtitleOf(items[0])).toBe("Task · MKT-9 · Marketing");
    });

    it("falls back to the name on the search row when the project list lacks it", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({ teamTasks: [teamTask({})], projects: [] })
        );

        expect(subtitleOf(items[0])).toBe("Task · MKT-9 · Marketing");
    });
});

/** The status chip lives in the row's `icon` tree; read its prop. */
const statusOf = (item: { icon?: unknown }): string => {
    const match = JSON.stringify(item.icon ?? {}).match(/"status":"([^"]*)"/);
    return match ? match[1] : "";
};

/**
 * The two task sources carry status in different shapes — the open
 * project's table row as a bare string, the team search as a
 * `TaskStatusProps` object. Both have to reach the same chip, or the
 * status would show for tasks in other projects but not the open one.
 */
describe("HashMentionMenuItems — task status chip", () => {
    it("shows the status of an open-project task (bare string source)", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({ tasks: [openProjectTask({ status: "WIP" })] })
        );

        expect(statusOf(items[0])).toBe("WIP");
    });

    it("shows the status of a team task (TaskStatusProps source)", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                teamTasks: [
                    teamTask({
                        status: {
                            code: 0,
                            status: "Blocked",
                            color: "#e11d48",
                            textColor: "white",
                        },
                    }),
                ],
            })
        );

        expect(statusOf(items[0])).toBe("Blocked");
    });

    it("renders no chip when the status is unknown, rather than a wrong one", () => {
        // `TaskStatusChip` falls back to Open's styling for an
        // unrecognized label, so an absent status must render nothing at
        // all instead of silently claiming the task is Open.
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({ tasks: [openProjectTask({ status: null })] })
        );

        expect(statusOf(items[0])).toBe("");
    });

    it("leaves note / chat / project rows without a status chip", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                projects: [
                    {
                        projectId: 7,
                        projectName: "Ops",
                    } as unknown as HashMentionData["projects"][number],
                ],
            })
        );

        expect(items).toHaveLength(1);
        expect(statusOf(items[0])).toBe("");
    });
});

/** The row subtitle prefix ("Task" vs "Milestone") lives in `icon`. */
const subtitlePrefixOf = (item: { icon?: unknown }): string => {
    const json = JSON.stringify(item.icon ?? {});
    const match = json.match(/"(Task|Milestone) · [^"]*"/);
    return match ? match[1] : "";
};

/**
 * A milestone is a task under the hood (it inserts the same `hashTask`
 * chip), but its suggestion row must READ as a milestone — the subtitle
 * says "Milestone", not "Task". The flag rides on both task sources.
 */
describe("HashMentionMenuItems — milestone rows", () => {
    it("labels an open-project milestone row 'Milestone', not 'Task'", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({ tasks: [openProjectTask({ isMilestone: true })] })
        );

        expect(subtitlePrefixOf(items[0])).toBe("Milestone");
        expect(subtitleOf(items[0])).toBe("");
    });

    it("labels a team-task milestone row 'Milestone' with the project name", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({
                teamTasks: [teamTask({ isMilestone: true })],
                projects: [
                    {
                        projectId: 2,
                        projectName: "Marketing",
                    } as unknown as HashMentionData["projects"][number],
                ],
            })
        );

        const json = JSON.stringify(items[0].icon ?? {});
        expect(json).toContain("Milestone · MKT-9 · Marketing");
        expect(json).not.toContain("Task · MKT-9");
    });

    it("keeps a non-milestone task row labelled 'Task'", () => {
        const items = HashMentionMenuItems(
            newEditor(),
            dataWith({ tasks: [openProjectTask({ isMilestone: false })] })
        );

        expect(subtitlePrefixOf(items[0])).toBe("Task");
    });

    it("still inserts a hashTask chip for a milestone (resolves as a task)", () => {
        const editor = newEditor();
        const items = HashMentionMenuItems(
            editor,
            dataWith({ tasks: [openProjectTask({ id: "3", projectId: 1, isMilestone: true })] })
        );
        items[0].onItemClick?.();
        expect(editor.insertInlineContent).toHaveBeenCalledWith([
            expect.objectContaining({ type: "hashTask" }),
            " ",
        ]);
    });
});

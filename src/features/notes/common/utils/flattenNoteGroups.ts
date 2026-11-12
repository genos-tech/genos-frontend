/**
 * Which rows the Task Notes and Chat Notes families show (MIP-1430).
 *
 * The notes are grouped by the data (project › milestone › task › subtask, chat type › chat),
 * but the sidebar draws fewer levels than the data has: project › task › note, and chat ›
 * note. Two folder levels (the milestone, the kind of chat) cost a click and a row each to say
 * what a hover can. These say what is drawn; `NoteSidebar` draws it.
 */

type MilestoneLike<T> = {
    milestoneId: number;
    directNotes: readonly unknown[];
    tasks: readonly T[];
};

export type ProjectRow<M, T> =
    /** The milestone's own notes (they hang on its backing task). */
    | { kind: "milestone"; milestone: M }
    /** A task. `milestone` is the one it belongs to, for the hover. */
    | { kind: "task"; task: T; milestone?: M };

/**
 * A project's rows, in order: each milestone's own row (only when it has notes of its own),
 * then its tasks, then the tasks with no milestone. A milestone without notes of its own is
 * not drawn: an empty row that holds nothing is noise, and it is only a label on its tasks.
 */
export const projectRows = <M extends MilestoneLike<T>, T>(project: {
    milestones: readonly M[];
    looseTasks: readonly T[];
}): ProjectRow<M, T>[] => [
    ...project.milestones.flatMap((milestone): ProjectRow<M, T>[] => [
        ...(milestone.directNotes.length > 0 ? [{ kind: "milestone" as const, milestone }] : []),
        ...milestone.tasks.map((task) => ({ kind: "task" as const, task, milestone })),
    ]),
    ...project.looseTasks.map((task) => ({ kind: "task" as const, task })),
];

/** Chats of every kind in one list, each with the name of its kind (for the hover). Order
 *  is kept: kinds in the order they were first seen, chats in the order they were grouped. */
export const chatRows = <C>(
    groups: readonly { chatTypeName: string; chats: readonly C[] }[]
): { chat: C; kindName: string }[] =>
    groups.flatMap((group) => group.chats.map((chat) => ({ chat, kindName: group.chatTypeName })));

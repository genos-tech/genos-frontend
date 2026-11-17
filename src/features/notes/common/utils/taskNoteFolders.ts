/**
 * The folders the Task Notes family shows (MIP-1667): project › the task tree › notes.
 *
 * A sub-task's folder sits INSIDE its parent task's folder, at any depth, and a milestone's tasks sit
 * inside the milestone's folder (its backing task is their parent). Until MIP-1667 the sidebar knew
 * only a note's immediate parent: it drew two levels, listed the rest side by side, and (MIP-1430)
 * left the milestone out of the tree altogether, so a task, its sub-tasks and its milestone all sat
 * at one level. Now each note carries every task above its own (`ancestors`, root first), so the
 * tree is the real one.
 *
 * Built as a graph of tasks first and nested after, so that notes of different tasks agree on one
 * tree: a note on B says "A is above me", a note on A says "the milestone is above me", and the
 * folder of A is one folder, in the milestone, holding B. A task that has no parent anywhere in the
 * data is a root.
 */

import type { TaskNoteAncestor } from "../../../../types/notes";
import type { TaskNoteMetaTreeNode } from "../types/noteTypes";

export interface TaskFolder {
    taskId: number;
    // Human-readable id ("QR-12"); null falls back to "#<taskId>" where it is drawn.
    displayId: string | null;
    title: string;
    // A milestone's backing task: drawn with the flag, and the root of its tasks.
    isMilestone: boolean;
    // The notes of THIS task (a note's own child notes ride in the note's `children`).
    notes: TaskNoteMetaTreeNode[];
    // The folders of the tasks directly below it.
    children: TaskFolder[];
}

export interface ProjectFolders {
    projectId: number;
    projectName: string;
    // The project's top folders: milestones first, then the tasks that have no parent.
    folders: TaskFolder[];
}

export interface TaskFolderLabels {
    project: (projectId: number) => string;
    task: (taskId: number) => string;
}

/** The tasks above a note's own, root first. An answer from before `ancestors` (an older API, a
 *  stored list) has only the parent, which still gives the folder one level of its place. */
const ancestorsOf = (note: TaskNoteMetaTreeNode): TaskNoteAncestor[] => {
    if (Array.isArray(note.ancestors)) return note.ancestors;
    if (note.parentTaskId == null) return [];
    return [
        {
            taskId: note.parentTaskId,
            title: note.parentTaskTitle ?? null,
            displayId: note.parentTaskDisplayId ?? null,
            isMilestone: note.parentTaskIsMilestone === true,
        },
    ];
};

// Nesting this deep is not a real tree; it stops a damaged one (the server stops at 64 too).
const MAX_DEPTH = 64;

export const buildTaskFolders = (
    notes: readonly TaskNoteMetaTreeNode[],
    labels: TaskFolderLabels
): ProjectFolders[] => {
    interface Entry {
        projectName: string;
        // task id -> folder, in the order the tasks were first met
        folders: Map<number, TaskFolder>;
        // task id -> its parent's task id, from the first note that says so
        parentOf: Map<number, number>;
    }
    const projects = new Map<number, Entry>();

    const entryOf = (note: TaskNoteMetaTreeNode): Entry => {
        let entry = projects.get(note.projectId);
        if (!entry) {
            entry = {
                projectName: note.projectName || labels.project(note.projectId),
                folders: new Map(),
                parentOf: new Map(),
            };
            projects.set(note.projectId, entry);
        }
        return entry;
    };

    // The folder of a task, made on first sight and filled in as later notes know more of it
    // (a task met as somebody's parent has a title and an id but no notes yet).
    const folderOf = (
        entry: Entry,
        taskId: number,
        title: string | null | undefined,
        displayId: string | null | undefined,
        isMilestone: boolean
    ): TaskFolder => {
        let folder = entry.folders.get(taskId);
        if (!folder) {
            folder = {
                taskId,
                displayId: displayId ?? null,
                title: title || labels.task(taskId),
                isMilestone,
                notes: [],
                children: [],
            };
            entry.folders.set(taskId, folder);
            return folder;
        }
        if (displayId != null && folder.displayId == null) folder.displayId = displayId;
        if (title && folder.title === labels.task(taskId)) folder.title = title;
        if (isMilestone) folder.isMilestone = true;
        return folder;
    };

    // `child` may sit under `parent` unless that would close a loop.
    const link = (entry: Entry, childId: number, parentId: number) => {
        if (childId === parentId || entry.parentOf.has(childId)) return;
        let up: number | undefined = parentId;
        for (let depth = 0; up !== undefined && depth < MAX_DEPTH; depth += 1) {
            if (up === childId) return;
            up = entry.parentOf.get(up);
        }
        entry.parentOf.set(childId, parentId);
    };

    for (const note of notes) {
        const entry = entryOf(note);
        let aboveId: number | null = null;
        for (const ancestor of ancestorsOf(note)) {
            folderOf(
                entry,
                ancestor.taskId,
                ancestor.title,
                ancestor.displayId,
                ancestor.isMilestone
            );
            if (aboveId !== null) link(entry, ancestor.taskId, aboveId);
            aboveId = ancestor.taskId;
        }
        const own = folderOf(
            entry,
            note.taskId,
            note.taskTitle,
            note.displayId,
            note.isMilestone === true
        );
        if (aboveId !== null) link(entry, own.taskId, aboveId);
        own.notes.push(note);
    }

    return Array.from(projects, ([projectId, entry]) => {
        const roots: TaskFolder[] = [];
        for (const folder of entry.folders.values()) {
            const parent = entry.folders.get(entry.parentOf.get(folder.taskId) ?? -1);
            (parent ? parent.children : roots).push(folder);
        }
        // Milestones first (a stable sort keeps the order the rest were met in).
        roots.sort((a, b) => Number(b.isMilestone) - Number(a.isMilestone));
        return { projectId, projectName: entry.projectName, folders: roots };
    });
};

/** Whether the note is in this folder or any folder below it (the path to the open note opens). */
export const folderHoldsNote = (folder: TaskFolder, noteId: number | undefined): boolean =>
    noteId != null &&
    (folder.notes.some((note) => note.noteId === noteId) ||
        folder.children.some((child) => folderHoldsNote(child, noteId)));

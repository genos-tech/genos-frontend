import { TagListProps } from "../../../types/tasks";

// What a quick-add surface (the task table's inline row, the sprint board's
// draft card) hands back on submit. Every field the table can edit inline is
// here plus tags; sprint is absent (not editable there, and a child inherits
// it from the parent chain anyway).
export type QuickAddDraft = {
    title: string;
    assigneeId: string | null;
    status: string;
    priority: string | null;
    effortLevel: string | null;
    // "YYYY-MM-DD"
    dueDate: string | null;
    tags: TagListProps[];
};

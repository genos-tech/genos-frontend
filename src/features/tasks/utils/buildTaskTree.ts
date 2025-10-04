import { TaskMetaProps, TaskMetaTreeNode } from "../../../types/tasks";

// Build a tree structure
export function buildTaskTree(items: TaskMetaProps[]): TaskMetaTreeNode[] {
    const map: Record<number, TaskMetaTreeNode> = {};
    const roots: TaskMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.taskId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentTaskId && map[item.parentTaskId]) {
            map[item.parentTaskId].children.push(map[item.taskId]);
        } else {
            roots.push(map[item.taskId]);
        }
    });

    return roots;
}

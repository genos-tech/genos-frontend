// Agent write tools that change the user's own to-do list. The tool-result
// handlers in useAgentQA / useSpotlight call `emitTodoChanged` for exactly
// this set, and useTodoGroups answers the `todoChanged` window event by
// re-reading the groups, so the chat-side to-do pane catches up without a
// reload. Kept here (next to neither hook) so the two handlers can't drift
// apart, the way NOTE_SIDEBAR_TOOLS and TASK_WRITE_TOOLS do for notes and
// tasks.
//
// `delete_todo_item` is in the set although Spotlight's inline check used to
// name only create and update: the delete removes the row on the server, and
// without a refetch the pane keeps showing it until a reload.
export const TODO_WRITE_TOOLS: ReadonlySet<string> = new Set([
    "create_todo_item",
    "update_todo_item",
    "delete_todo_item",
]);

// The window event the to-do pane listens for.
export const TODO_CHANGED_EVENT = "todoChanged";

// The one place a tool result becomes a `todoChanged` event. Any other tool
// name is a no-op, so callers invoke it for every result.
export const emitTodoChanged = (toolName: string): void => {
    if (!TODO_WRITE_TOOLS.has(toolName)) return;
    window.dispatchEvent(new CustomEvent(TODO_CHANGED_EVENT));
};

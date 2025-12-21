// Original DataGrid-based table (kept for backwards compatibility)
export { ProjectTaskTable } from "./TaskTable";

// New react-beautiful-dnd based draggable table
export { DraggableTaskTable } from "./DraggableTaskTable";
export { DraggableTaskRow } from "./DraggableTaskRow";

// Filter menu (shared between both implementations)
export { TaskFilterMenu } from "./TaskFilterMenu";

// Column definitions and utilities
export { columns, defaultColumns, statusOptions } from "./DraggableTaskTable";
export type { ColumnDef } from "./DraggableTaskTable";

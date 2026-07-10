import { describe, expect, it, vi } from "vitest";

import {
    emitTasksBulkChanged,
    onTasksBulkChanged,
    TASK_WRITE_TOOLS,
} from "../features/tasks/services/taskEvents";

describe("genos:tasks-bulk-changed bus", () => {
    it("delivers the projectId detail to subscribers", () => {
        const cb = vi.fn();
        const off = onTasksBulkChanged(cb);
        emitTasksBulkChanged(42);
        expect(cb).toHaveBeenCalledWith({ projectId: 42 });
        off();
    });

    it("delivers an empty detail when no projectId is known", () => {
        const cb = vi.fn();
        const off = onTasksBulkChanged(cb);
        emitTasksBulkChanged();
        expect(cb).toHaveBeenCalledWith({ projectId: undefined });
        off();
    });

    it("stops delivering after unsubscribe", () => {
        const cb = vi.fn();
        const off = onTasksBulkChanged(cb);
        off();
        emitTasksBulkChanged(1);
        expect(cb).not.toHaveBeenCalled();
    });

    it("covers the agent task-write tool set the emit sites key on", () => {
        // Locks the emit-trigger set: if a new composite task write tool
        // ships without being added here, its approvals won't refresh
        // the task surfaces.
        expect(TASK_WRITE_TOOLS.has("create_task_plan")).toBe(true);
        expect(TASK_WRITE_TOOLS.has("update_tasks_bulk")).toBe(true);
        expect(TASK_WRITE_TOOLS.has("create_task")).toBe(true);
        expect(TASK_WRITE_TOOLS.has("update_task")).toBe(true);
        expect(TASK_WRITE_TOOLS.has("assign_task")).toBe(true);
        // Read/note tools must NOT trigger a project refetch.
        expect(TASK_WRITE_TOOLS.has("list_tasks")).toBe(false);
        expect(TASK_WRITE_TOOLS.has("create_note")).toBe(false);
    });
});

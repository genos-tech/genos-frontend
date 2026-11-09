// @vitest-environment node
/**
 * MIP-1335: a quick-add must not raise `isNewTaskCreated`.
 *
 * That flag drives a reload through `loadProjectsAndTasks(localStorage.lastProjectId)`.
 * `lastProjectId` is shared by every tab (and written by the create form), so when
 * it names another project the reload switched the open project away and back: the
 * table lost the row that was just made, and it stayed gone until the next reload.
 * A quick-add always creates in the project that is open, so it refreshes THAT
 * project's rows instead, through the same signal the agent's bulk writes use.
 *
 * Reads the three quick-add paths as source: rendering the table, the board and the
 * sub-task block whole to watch one call is far more setup than the call is worth.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const QUICK_ADD_PATHS = [
    "features/tasks/components/table/DraggableTaskTable.tsx",
    "features/tasks/components/board/SprintBoard.tsx",
    "features/tasks/components/contents/base/TaskSubTasksBlock.tsx",
];

/** The file without comments, so prose that mentions the call is not a call. */
const code = (file: string) =>
    fs
        .readFileSync(path.join(SRC_ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe.each(QUICK_ADD_PATHS)("%s", (file) => {
    it("does not raise the new-task flag", () => {
        expect(code(file)).not.toMatch(/setIsNewTaskCreated\s*\(\s*true\s*\)/);
    });

    it("refreshes the open project's rows after a quick-add", () => {
        expect(code(file)).toMatch(/emitTasksBulkChanged\s*\(/);
    });
});

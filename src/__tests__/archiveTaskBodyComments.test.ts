/** MIP-1693: the task-body editor gets its project id and closes its comment button in an archived project. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("task-body comment button in an archived project", () => {
    it("BnTaskPreview hides the comment button from the archive state", () => {
        const src = read("components/editors/bnTaskPreview.tsx");
        expect(src).toContain("isNoteCommentingArchived(archiveState, { projectId })");
        expect(src).toContain("hasComments={!!threadStore && !commentsArchived}");
    });

    it("the task and milestone panes pass the project id down", () => {
        expect(read("features/tasks/components/contents/base/TaskBodyBlock.tsx")).toContain(
            "projectId={projectId}"
        );
        const preview = read("features/tasks/components/contents/TaskPreview.tsx");
        expect(preview).toContain("projectId={milestone.projectId}");
        expect(preview).toContain("tmpCurrentTaskContent.project?.projectId");
    });
});

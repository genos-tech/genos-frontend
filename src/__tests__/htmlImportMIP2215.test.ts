// MIP-2215: `.html` import through the folder import. A page is a note only when the plan is built
// for it (the server has HTML notes on); otherwise it stays an asset, exactly as before. The runner
// stores a page through the import endpoint (never parsed into blocks), reports a refusal as that
// page's failure and goes on, and stops sending pages once the plan says it has no HTML notes.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildFolderImportPlan } from "../features/notes/common/services/folderImportPlan";
import { importHtmlNote } from "../features/notes/common/services/importHtmlNote";
import { titleFromFilename } from "../features/notes/common/services/noteMarkdown";
import { runFolderImport } from "../features/notes/common/services/runFolderImport";
import { createEmptyMyNote } from "../features/notes/my-notes/services/createEmptyMyNote";
import { createMyNoteFolder } from "../features/notes/my-notes/services/createMyNoteFolder";
import type { UserProps } from "../types/admin";

vi.mock("../features/notes/common/services/importHtmlNote", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/common/services/importHtmlNote")>()),
    importHtmlNote: vi.fn(),
}));
vi.mock("../features/notes/my-notes/services/createEmptyMyNote", () => ({
    createEmptyMyNote: vi.fn(async () => ({ noteId: 1 })),
}));
vi.mock("../features/notes/my-notes/services/createMyNoteFolder", () => ({
    createMyNoteFolder: vi.fn(async () => ({ folderId: 10 })),
}));
vi.mock("../features/notes/team-notes/services/createTeamNoteFolder", () => ({
    createTeamNoteFolder: vi.fn(async () => ({ folderId: 20 })),
}));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
vi.mock("../features/notes/common/services/noteMarkdown", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/common/services/noteMarkdown")>()),
    markdownToNoteBlocks: vi.fn(async () => []),
}));

const mockImport = vi.mocked(importHtmlNote);
const myself = { userId: "u1", teamId: "t1" } as UserProps;

const at = (path: string, contents = "<!doctype html><title>x</title>"): File => {
    const file = new File([contents], path.split("/").pop() as string);
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    return file;
};

const created = (noteId: number, warnings: { code: string; message: string }[] = []) =>
    ({ status: "created", noteId, noteType: "personal", title: "t", warnings }) as const;

const run = (files: File[], html = true) =>
    runFolderImport({
        plan: buildFolderImportPlan(files, { html }),
        destination: { kind: "personal", parentFolderId: null },
        myself,
        accessToken: "tok",
        uploadLimitBytes: null,
    });

beforeEach(() => {
    mockImport.mockReset();
    vi.mocked(createEmptyMyNote).mockClear();
    vi.mocked(createMyNoteFolder).mockClear();
});

describe("the plan", () => {
    const files = [at("Export/a.md"), at("Export/report.html"), at("Export/sub/page.htm")];

    it("makes a note of a .html page only when HTML notes are on", () => {
        expect(buildFolderImportPlan(files).noteCount).toBe(1);
        const plan = buildFolderImportPlan(files, { html: true });
        expect(plan.noteCount).toBe(3);
        const page = plan.root.notes.find((n) => n.title === "report");
        expect(page?.format).toBe("html");
        expect(plan.root.notes.find((n) => n.title === "a")?.format).toBe("markdown");
        expect(plan.root.folders[0].notes[0]).toMatchObject({ title: "page", format: "html" });
    });

    it("leaves a .html file an asset, as before, while HTML notes are off", () => {
        const plan = buildFolderImportPlan(files);
        expect([...plan.assets.keys()].sort()).toEqual(["report.html", "sub/page.htm"]);
    });

    it("takes a title from the file name without .html or .htm", () => {
        expect(titleFromFilename("Weekly report.html")).toBe("Weekly report");
        expect(titleFromFilename("old.HTM")).toBe("old");
        expect(titleFromFilename("notes.md")).toBe("notes");
    });
});

describe("the run", () => {
    it("stores a page through the import endpoint, not as blocks, and counts it", async () => {
        mockImport.mockResolvedValue(created(5));
        const result = await run([at("Export/report.html", "<p>page</p>")]);
        expect(mockImport).toHaveBeenCalledTimes(1);
        expect(mockImport.mock.calls[0][0]).toMatchObject({
            accessToken: "tok",
            teamId: "t1",
            html: "<p>page</p>",
            title: "report",
            target: { kind: "personal", folderId: null },
        });
        expect(createEmptyMyNote).not.toHaveBeenCalled();
        expect(result.notesCreated).toBe(1);
        expect(result.htmlNotesCreated).toBe(1);
        expect(result.failures).toEqual([]);
    });

    it("files a page in the folder it sits in", async () => {
        mockImport.mockResolvedValue(created(5));
        await run([at("Export/Reports/q1.html")]);
        expect(mockImport.mock.calls[0][0].target).toEqual({ kind: "personal", folderId: 10 });
    });

    it("reports the findings of a page that was stored, and keeps going", async () => {
        mockImport
            .mockResolvedValueOnce(created(5, [{ code: "external_script", message: "m" }]))
            .mockResolvedValueOnce(created(6));
        const result = await run([at("Export/a.html"), at("Export/b.html")]);
        expect(result.htmlNotesCreated).toBe(2);
        expect(result.htmlWarnings).toHaveLength(1);
        expect(result.htmlWarnings?.[0].path).toBe("a");
        expect(result.htmlWarnings?.[0].warnings[0].code).toBe("external_script");
    });

    it("counts a refusal as that page's failure and carries on with the next", async () => {
        mockImport
            .mockResolvedValueOnce({ status: "refused", httpStatus: 400, reason: "Too big." })
            .mockResolvedValueOnce(created(6));
        const result = await run([at("Export/a.html"), at("Export/b.html")]);
        expect(result.failures).toEqual([{ path: "a", reason: "Too big." }]);
        expect(result.notesCreated).toBe(1);
    });

    it("stops sending pages once the plan has no HTML notes, and reports each one", async () => {
        mockImport.mockResolvedValue({ status: "not-on-plan", yourPlan: "free" });
        const result = await run([at("Export/a.html"), at("Export/b.html"), at("Export/c.html")]);
        expect(mockImport).toHaveBeenCalledTimes(1);
        expect(result.failures).toHaveLength(3);
        expect(new Set(result.failures.map((f) => f.reason)).size).toBe(1);
        expect(result.notesCreated).toBe(0);
    });

    it("leaves a markdown note exactly as it was: no HTML fields, no import call", async () => {
        const result = await run([at("Export/a.md", "# hi")], false);
        expect(mockImport).not.toHaveBeenCalled();
        expect(result.notesCreated).toBe(1);
        expect(result.htmlNotesCreated).toBeUndefined();
        expect(result.htmlWarnings).toBeUndefined();
    });
});

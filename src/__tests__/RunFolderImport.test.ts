/**
 * The importer that actually creates the tree.
 *
 * Every service it calls is stubbed, so what's under test is the part
 * that's easy to get wrong and expensive when it is: that a child folder
 * is created against its parent's real id, that a failure part-way
 * through doesn't take the rest of the export with it, and that images
 * are uploaded and written back only after their note exists.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFolderImportPlan } from "../features/notes/common/services/folderImportPlan";
import { runFolderImport } from "../features/notes/common/services/runFolderImport";
import { createEmptyMyNote } from "../features/notes/my-notes/services/createEmptyMyNote";
import { createMyNoteFolder } from "../features/notes/my-notes/services/createMyNoteFolder";
import { createTeamNoteFolder } from "../features/notes/team-notes/services/createTeamNoteFolder";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../features/notes/my-notes/services/createEmptyMyNote", () => ({
    createEmptyMyNote: vi.fn(),
}));
vi.mock("../features/notes/my-notes/services/createMyNoteFolder", () => ({
    createMyNoteFolder: vi.fn(),
}));
vi.mock("../features/notes/team-notes/services/createTeamNoteFolder", () => ({
    createTeamNoteFolder: vi.fn(),
}));
vi.mock("../services/api", () => ({ authApi: vi.fn() }));
// The real one spins up a headless BlockNote editor; the importer only
// cares that markdown becomes blocks, so a paragraph per file is enough.
vi.mock("../features/notes/common/services/noteMarkdown", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/notes/common/services/noteMarkdown")>();
    return {
        ...actual,
        markdownToNoteBlocks: vi.fn(async (md: string) =>
            md.startsWith("!") ? [{ type: "image", props: { url: md.slice(1) } }] : []
        ),
    };
});

const mockCreateNote = vi.mocked(createEmptyMyNote);
const mockCreateFolder = vi.mocked(createMyNoteFolder);
const mockCreateTeamFolder = vi.mocked(createTeamNoteFolder);
const mockAuthApi = vi.mocked(authApi);

const myself = { userId: "u1", teamId: "t1" } as UserProps;

/** A markdown File at `path`. Body "!href" becomes an image block. */
const at = (path: string, contents = "# hi"): File => {
    const file = new File([contents], path.split("/").pop() as string);
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    return file;
};

const run = (files: File[], over: Partial<Parameters<typeof runFolderImport>[0]> = {}) =>
    runFolderImport({
        plan: buildFolderImportPlan(files),
        destination: { kind: "personal", parentFolderId: null },
        myself,
        accessToken: "tok",
        uploadLimitBytes: null,
        ...over,
    });

beforeEach(() => {
    let nextFolderId = 100;
    let nextNoteId = 1;
    mockCreateFolder.mockReset().mockImplementation(async (_m, name, parentFolderId) => ({
        folderId: (nextFolderId += 1),
        parentFolderId: parentFolderId ?? null,
        name,
    }));
    mockCreateTeamFolder.mockReset().mockImplementation(
        async (_m, input) =>
            ({
                folderId: (nextFolderId += 1),
                parentFolderId: input.parentFolderId ?? null,
                name: input.name,
            }) as never
    );
    mockCreateNote.mockReset().mockImplementation(async () => ({ noteId: (nextNoteId += 1) }));
    mockAuthApi
        .mockReset()
        .mockReturnValue({ put: vi.fn().mockResolvedValue({ data: {} }) } as never);
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ noteAttachmentUrl: "/media/notes/personal/2/shot.png" }),
        }))
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("runFolderImport", () => {
    it("creates each folder before what goes in it, against its parent's id", () => {
        return run([at("Export/Projects/Q3/Launch.md")]).then((result) => {
            expect(result.foldersCreated).toBe(2);
            expect(result.notesCreated).toBe(1);

            const [projects, q3] = mockCreateFolder.mock.calls;
            expect(projects[1]).toBe("Projects");
            expect(projects[2]).toBeNull(); // destination root
            expect(q3[1]).toBe("Q3");
            // The id the first call handed back, not a guess.
            expect(q3[2]).toBe(101);

            // And the note lands in the deepest folder.
            expect(mockCreateNote.mock.calls[0][4]).toBe(102);
        });
    });

    it("imports into the destination folder when one was chosen", async () => {
        await run([at("Export/Alpha.md")], {
            destination: { kind: "personal", parentFolderId: 42 },
        });
        expect(mockCreateNote.mock.calls[0][4]).toBe(42);
    });

    it("creates team subfolders that inherit their parent's access", async () => {
        await run([at("Export/Projects/Roadmap.md")], {
            destination: { kind: "team", parentFolderId: 42 },
        });
        expect(mockCreateFolder).not.toHaveBeenCalled();
        // `visibility: null` is what makes the subtree reachable by
        // exactly the people who can already reach the folder it's in.
        expect(mockCreateTeamFolder.mock.calls[0][1]).toEqual({
            name: "Projects",
            parentFolderId: 42,
            visibility: null,
        });
    });

    it("records a failed page and keeps importing the rest", async () => {
        mockCreateNote
            .mockImplementationOnce(async () => undefined)
            .mockImplementationOnce(async () => ({ noteId: 9 }));

        const result = await run([at("Export/Alpha.md"), at("Export/Beta.md")]);

        expect(result.notesCreated).toBe(1);
        expect(result.failures).toEqual([{ path: "Alpha", reason: "note create failed" }]);
    });

    it("skips a subtree whose folder couldn't be created, without dumping it in the parent", async () => {
        mockCreateFolder.mockImplementationOnce(async () => undefined);

        const result = await run([at("Export/Projects/Roadmap.md"), at("Export/Loose.md")]);

        expect(result.failures).toEqual([{ path: "Projects", reason: "folder create failed" }]);
        // Only the note that had a home was created — "Roadmap" did not
        // silently land next to "Loose".
        expect(result.notesCreated).toBe(1);
        expect(mockCreateNote.mock.calls[0][2]).toBe("Loose");
    });

    it("uploads an image against the created note and rewrites the body", async () => {
        const put = vi.fn().mockResolvedValue({ data: {} });
        mockAuthApi.mockReturnValue({ put } as never);

        const result = await run([
            at("Export/Roadmap.md", "!Roadmap/shot.png"),
            at("Export/Roadmap/shot.png"),
        ]);

        expect(result.assetsUploaded).toBe(1);
        expect(result.assetsFailed).toBe(0);

        // The attachment endpoint needs the note id, so the upload can
        // only happen after the note exists — hence the second write.
        const form = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
        expect(form.get("note_id")).toBe("2");
        expect(put).toHaveBeenCalledTimes(1);
        // The stored URL is the absolute one the editors' own uploads
        // produce, so an imported image is indistinguishable from a
        // pasted one — not the export-relative path it started as.
        expect(put.mock.calls[0][1].body).toEqual([
            {
                type: "image",
                props: {
                    url: `${import.meta.env.VITE_DJANGO_URL}/media/notes/personal/2/shot.png`,
                },
            },
        ]);
    });

    it("counts an image that isn't in the picked folder as failed and writes nothing back", async () => {
        const put = vi.fn();
        mockAuthApi.mockReturnValue({ put } as never);

        const result = await run([at("Export/Roadmap.md", "!missing.png")]);

        expect(result.notesCreated).toBe(1);
        expect(result.assetsFailed).toBe(1);
        expect(fetch).not.toHaveBeenCalled();
        // Nothing changed, so the note isn't rewritten for the sake of it.
        expect(put).not.toHaveBeenCalled();
    });

    it("skips an image over the plan's upload ceiling rather than eating a 413", async () => {
        const big = at("Export/Roadmap/shot.png");
        Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 });

        const result = await run([at("Export/Roadmap.md", "!Roadmap/shot.png"), big], {
            uploadLimitBytes: 5 * 1024 * 1024,
        });

        expect(result.assetsFailed).toBe(1);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("reports progress across the whole run", async () => {
        const seen: string[] = [];
        await run([at("Export/Alpha.md"), at("Export/Beta.md")], {
            onProgress: (p) => seen.push(`${p.done}/${p.total}`),
        });
        expect(seen[seen.length - 1]).toBe("2/2");
    });

    it("stops when asked and reports what had already landed", async () => {
        const result = await run(
            [at("Export/Alpha.md"), at("Export/Beta.md"), at("Export/Gamma.md")],
            { shouldCancel: () => true }
        );
        expect(result.cancelled).toBe(true);
        expect(result.notesCreated).toBe(0);
        expect(mockCreateNote).not.toHaveBeenCalled();
    });
});

/**
 * Gathering a folder into a zip.
 *
 * Asserted against the REAL zip the runner produces, read back entry by
 * entry, because every promise this feature makes — the tree layout,
 * images sitting beside their note, links that point at them — is only
 * true inside the archive. A mocked JSZip would let all of it pass while
 * shipping a zip nobody can open.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildFolderExportPlan } from "../features/notes/common/services/folderExportPlan";
import { loadSpecificNote } from "../features/notes/common/services/loadSpecificNote";
import { assetFileName, runFolderExport } from "../features/notes/common/services/runFolderExport";
import { loadAllMyNotes } from "../features/notes/my-notes/services/loadAllMyNotes";
import { MyNoteFolderProps, MyNoteMetaProps } from "../types/notes";

vi.mock("../features/notes/my-notes/services/loadAllMyNotes", () => ({
    loadAllMyNotes: vi.fn(),
}));
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: vi.fn(),
}));
// The real serializer needs a live BlockNote editor. Round-tripping the
// blocks as JSON keeps every rewritten URL visible in the .md, which is
// what these tests are actually checking.
vi.mock("../features/notes/common/services/noteMarkdown", () => ({
    noteBlocksToMarkdown: vi.fn(async (blocks: unknown[]) => JSON.stringify(blocks)),
}));

const mockedBulk = vi.mocked(loadAllMyNotes);
const mockedSingle = vi.mocked(loadSpecificNote);

const myself = { teamId: "team1", userId: "user1" } as never;

const folder = (folderId: number, name: string, parentFolderId: number | null = null) =>
    ({ folderId, name, parentFolderId }) as MyNoteFolderProps;

const meta = (
    noteId: number,
    title: string,
    extra: { folderId?: number | null; parentNoteId?: number | null } = {}
) =>
    ({
        noteId,
        title,
        noteType: 1,
        parentNoteId: extra.parentNoteId ?? null,
        folderId: extra.folderId ?? null,
        tsUpdated: "2026-01-01",
    }) as MyNoteMetaProps;

const image = (url: string) => ({ type: "image", props: { url, name: "shot.png" } });

const planFor = (folders: MyNoteFolderProps[], noteMeta: MyNoteMetaProps[], rootFolderId = 1) =>
    buildFolderExportPlan({
        rootFolderId,
        rootName: folders.find((f) => f.folderId === rootFolderId)?.name ?? "Roadmap",
        folders,
        noteMeta,
    });

/** Read the produced zip back, as a user's unzip tool would. */
const readZip = async (blob: Blob): Promise<Record<string, string>> => {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const out: Record<string, string> = {};
    for (const [path, entry] of Object.entries(zip.files)) {
        if (!entry.dir) out[path] = await entry.async("string");
    }
    return out;
};

const okFetch = () =>
    vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(["png-bytes"]) }));

beforeEach(() => {
    vi.clearAllMocks();
    mockedBulk.mockResolvedValue([]);
    mockedSingle.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", okFetch());
});

describe("runFolderExport", () => {
    it("writes one markdown file per note, at its planned path", async () => {
        mockedBulk.mockResolvedValue([
            { noteId: 10, title: "Launch", body: [{ type: "paragraph" }] },
            { noteId: 11, title: "Risks", body: [] },
        ]);

        const result = await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap"), folder(2, "Q3", 1)],
                [meta(10, "Launch", { folderId: 2 }), meta(11, "Risks", { parentNoteId: 10 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(result.notesExported).toBe(2);
        expect(result.fileName).toBe("Roadmap.zip");
        expect(Object.keys(await readZip(result.blob!)).sort()).toEqual([
            "Roadmap/Q3/Launch.md",
            "Roadmap/Q3/Launch/Risks.md",
        ]);
    });

    it("takes personal bodies from the one bulk call, not one call per note", async () => {
        // The difference between one request and five hundred.
        mockedBulk.mockResolvedValue([
            { noteId: 10, title: "A", body: [] },
            { noteId: 11, title: "B", body: [] },
        ]);

        await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(mockedBulk).toHaveBeenCalledTimes(1);
        expect(mockedSingle).not.toHaveBeenCalled();
    });

    it("fetches team notes individually, since the bulk endpoint omits them", async () => {
        mockedSingle.mockResolvedValue({ noteId: 10, title: "A", body: [] });

        const result = await runFolderExport({
            plan: planFor([folder(1, "Shared")], [meta(10, "A", { folderId: 1 })]),
            source: "team",
            myself,
            accessToken: "tok",
        });

        expect(mockedBulk).not.toHaveBeenCalled();
        expect(mockedSingle).toHaveBeenCalledWith(myself, 1, 10, "tok");
        expect(result.notesExported).toBe(1);
    });

    it("fetches a note the bulk call didn't carry", async () => {
        // Created since the last sync — dropping it silently would be the
        // worst possible failure for a backup.
        mockedBulk.mockResolvedValue([{ noteId: 10, title: "A", body: [] }]);
        mockedSingle.mockResolvedValue({ noteId: 11, title: "B", body: [] });

        const result = await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(mockedSingle).toHaveBeenCalledWith(myself, 1, 11, "tok");
        expect(result.notesExported).toBe(2);
    });

    it("carries images into the zip beside their note and repoints the links", async () => {
        mockedBulk.mockResolvedValue([
            {
                noteId: 10,
                title: "Launch",
                body: [image("https://api.genos.dev/media/notes/personal/10/shot.png")],
            },
        ]);

        const result = await runFolderExport({
            plan: planFor([folder(1, "Roadmap")], [meta(10, "Launch", { folderId: 1 })]),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        const files = await readZip(result.blob!);
        expect(result.imagesIncluded).toBe(1);
        expect(files["Roadmap/Launch/shot.png"]).toBe("png-bytes");
        // Relative to the .md's own directory, which is what makes the
        // zip readable offline and re-importable here.
        expect(files["Roadmap/Launch.md"]).toContain('"url":"Launch/shot.png"');
    });

    it("percent-encodes an image path so the markdown link survives", async () => {
        mockedBulk.mockResolvedValue([
            {
                noteId: 10,
                title: "My Launch",
                body: [image("https://api.genos.dev/media/notes/personal/10/my%20shot.png")],
            },
        ]);

        const result = await runFolderExport({
            plan: planFor([folder(1, "Roadmap")], [meta(10, "My Launch", { folderId: 1 })]),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        const files = await readZip(result.blob!);
        expect(files["Roadmap/My Launch/my shot.png"]).toBe("png-bytes");
        expect(files["Roadmap/My Launch.md"]).toContain('"url":"My%20Launch/my%20shot.png"');
    });

    it("downloads a shared image once however many notes use it", async () => {
        // A Notion database repeats its header image on every page.
        const href = "https://api.genos.dev/media/notes/personal/10/hero.png";
        mockedBulk.mockResolvedValue([
            { noteId: 10, title: "A", body: [image(href)] },
            { noteId: 11, title: "B", body: [image(href)] },
        ]);

        const result = await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        const files = await readZip(result.blob!);
        expect(files["Roadmap/A/hero.png"]).toBe("png-bytes");
        expect(files["Roadmap/B/hero.png"]).toBe("png-bytes");
    });

    it("retries a rejected image over the session cookie before giving up", async () => {
        // Which auth the media host accepts depends on how it's fronted;
        // a zip full of missing images is too high a price for guessing.
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 401 })
            .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(["ok"]) });
        vi.stubGlobal("fetch", fetchMock);
        mockedBulk.mockResolvedValue([
            {
                noteId: 10,
                title: "A",
                body: [image("https://api.genos.dev/media/notes/personal/10/shot.png")],
            },
        ]);

        const result = await runFolderExport({
            plan: planFor([folder(1, "Roadmap")], [meta(10, "A", { folderId: 1 })]),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            headers: { Authorization: "Bearer tok" },
        });
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: "include" });
        expect(result.imagesIncluded).toBe(1);
    });

    it("still exports a note whose image can't be downloaded", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: false, status: 403 }))
        );
        const href = "https://api.genos.dev/media/notes/personal/10/shot.png";
        mockedBulk.mockResolvedValue([{ noteId: 10, title: "A", body: [image(href)] }]);

        const result = await runFolderExport({
            plan: planFor([folder(1, "Roadmap")], [meta(10, "A", { folderId: 1 })]),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(result.imagesFailed).toBe(1);
        expect(result.notesExported).toBe(1);
        // The link is left pointing at Genos, so it still resolves for a
        // signed-in reader rather than becoming a dead relative path.
        expect((await readZip(result.blob!))["Roadmap/A.md"]).toContain(href);
    });

    it("skips a note it can't read and keeps going", async () => {
        mockedBulk.mockResolvedValue([{ noteId: 11, title: "B", body: [] }]);
        mockedSingle.mockResolvedValue({ error: "forbidden" });

        const result = await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
        });

        expect(result.notesExported).toBe(1);
        expect(result.failures).toEqual([{ path: "Roadmap/A", reason: "forbidden" }]);
        expect(Object.keys(await readZip(result.blob!))).toEqual(["Roadmap/B.md"]);
    });

    it("keeps what it gathered when the export is stopped", async () => {
        mockedBulk.mockResolvedValue([
            { noteId: 10, title: "A", body: [] },
            { noteId: 11, title: "B", body: [] },
        ]);
        let seen = 0;

        const result = await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
            shouldCancel: () => {
                seen += 1;
                return seen > 1;
            },
        });

        expect(result.cancelled).toBe(true);
        expect(Object.keys(await readZip(result.blob!))).toEqual(["Roadmap/A.md"]);
    });

    it("reports progress against the note count", async () => {
        mockedBulk.mockResolvedValue([
            { noteId: 10, title: "A", body: [] },
            { noteId: 11, title: "B", body: [] },
        ]);
        const seen: string[] = [];

        await runFolderExport({
            plan: planFor(
                [folder(1, "Roadmap")],
                [meta(10, "A", { folderId: 1 }), meta(11, "B", { folderId: 1 })]
            ),
            source: "personal",
            myself,
            accessToken: "tok",
            onProgress: (p) => seen.push(`${p.done}/${p.total} ${p.label}`),
        });

        expect(seen).toEqual(["0/2 A", "1/2 B", "2/2 "]);
    });

    it("produces no zip at all when nothing could be exported", async () => {
        mockedSingle.mockResolvedValue(undefined);

        const result = await runFolderExport({
            plan: planFor([folder(1, "Roadmap")], [meta(10, "A", { folderId: 1 })]),
            source: "team",
            myself,
            accessToken: "tok",
        });

        expect(result.blob).toBeNull();
        expect(result.failures).toHaveLength(1);
    });
});

describe("assetFileName", () => {
    it("keeps the name the user uploaded", () => {
        expect(assetFileName("https://api.genos.dev/media/notes/personal/10/Screenshot.png")).toBe(
            "Screenshot.png"
        );
    });

    it("decodes the escaping the URL added", () => {
        expect(assetFileName("https://x/media/notes/personal/10/my%20shot.png")).toBe(
            "my shot.png"
        );
    });

    it("drops the query string a signed URL carries", () => {
        expect(assetFileName("https://x/media/a/shot.png?token=abc")).toBe("shot.png");
    });

    it("keeps the extension when a long name has to be cut", () => {
        // Truncating into "reallylongname" would leave a file nothing opens.
        const name = assetFileName(`https://x/media/a/${"n".repeat(200)}.png`);
        expect(name.endsWith(".png")).toBe(true);
        expect(name.length).toBeLessThan(100);
    });

    it("falls back to a usable name rather than an empty one", () => {
        expect(assetFileName("https://x/media/a/")).toBe("a");
        expect(assetFileName("")).toBe("image");
    });
});

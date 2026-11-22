/**
 * MIP-1946: a Google Docs export embeds pictures as `data:` URIs. The
 * importer must upload them as note files and put the URL in the body,
 * so the note stays small.
 */

import { describe, expect, it, vi } from "vitest";

import {
    dataImageWarnings,
    externalizeDataUriImages,
    withoutDataUriImages,
} from "../features/notes/common/services/importDataUriImages";

const PNG_B64 = "iVBORw0KGgo=";
const uri = (b64 = PNG_B64, mime = "image/png") => `data:${mime};base64,${b64}`;
const image = (url: string) => ({ type: "image", props: { url } });
const sizeOf = (blocks: unknown[]) => JSON.stringify(blocks).length;
type B = { props?: { url?: string }; children?: B[] };
const at = (blocks: unknown[], i: number) => blocks[i] as B;

describe("externalizeDataUriImages", () => {
    it("uploads each data: image and rewrites its url", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/a.png");
        const body = [{ type: "paragraph" }, image(uri())];
        const out = await externalizeDataUriImages({ body, uploadLimitBytes: null, upload });
        expect(upload).toHaveBeenCalledTimes(1);
        const file = upload.mock.calls[0][0];
        expect(file.type).toBe("image/png");
        expect(file.size).toBe(8);
        expect(file.name).toBe("image-1.png");
        expect(at(out.body, 1).props?.url).toBe("https://api/media/a.png");
        expect(out.report).toMatchObject({ uploaded: 1, warnings: [] });
    });

    it("finds images nested in children and uploads a repeated image once", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/x.png");
        const body = [{ type: "bulletListItem", children: [image(uri())] }, image(uri())];
        const out = await externalizeDataUriImages({ body, uploadLimitBytes: null, upload });
        expect(upload).toHaveBeenCalledTimes(1);
        expect(at(out.body, 0).children?.[0]?.props?.url).toBe("https://api/media/x.png");
        expect(at(out.body, 1).props?.url).toBe("https://api/media/x.png");
    });

    it("shrinks the body a lot for a multi-MB image", async () => {
        const big = "A".repeat(4 * 1024 * 1024); // ~3 MB decoded
        const body = [image(uri(big))];
        const before = sizeOf(body);
        const out = await externalizeDataUriImages({
            body,
            uploadLimitBytes: null,
            upload: async () => "https://api/media/big.png",
        });
        expect(before).toBeGreaterThan(4_000_000);
        expect(sizeOf(out.body)).toBeLessThan(200);
        expect(out.report.bytesBefore).toBe(before);
        expect(out.report.bytesAfter).toBe(sizeOf(out.body));
    });

    it("skips an image over the upload limit with a per-image warning and a placeholder, not inline", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/ok.png");
        const small = uri();
        const large = uri("A".repeat(4000), "image/jpeg"); // 3000 bytes
        const out = await externalizeDataUriImages({
            body: [image(small), image(large)],
            uploadLimitBytes: 1000,
            upload,
        });
        expect(upload).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(out.body)).not.toContain("data:");
        expect(out.body[1]).toMatchObject({
            type: "paragraph",
            content: [{ type: "text", text: "[Image 2 was not imported]" }],
        });
        expect(out.report.uploaded).toBe(1);
        expect(out.report.warnings).toEqual([
            { index: 2, reason: "too-large", bytes: 3000, mime: "image/jpeg" },
        ]);
    });

    it("replaces the image with a placeholder and warns when the upload fails", async () => {
        const out = await externalizeDataUriImages({
            body: [image(uri())],
            uploadLimitBytes: null,
            upload: async () => {
                throw new Error("boom");
            },
        });
        expect(out.body[0]).toMatchObject({ type: "paragraph" });
        expect(out.report.warnings).toEqual([
            { index: 1, reason: "upload-failed", bytes: 8, mime: "image/png" },
        ]);
    });

    it("warns on an undecodable data URI instead of throwing", async () => {
        const upload = vi.fn(async (_f: File) => "");
        const out = await externalizeDataUriImages({
            body: [image("data:image/png;base64,%%%not-base64%%%")],
            uploadLimitBytes: null,
            upload,
        });
        expect(upload).not.toHaveBeenCalled();
        expect(out.report.warnings[0]).toMatchObject({ index: 1, reason: "undecodable" });
    });

    it("handles percent-encoded (non-base64) svg data URIs", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/s.svg");
        const svg = "data:image/svg+xml;utf8," + encodeURIComponent("<svg/>");
        await externalizeDataUriImages({ body: [image(svg)], uploadLimitBytes: null, upload });
        expect(upload.mock.calls[0][0].name).toBe("image-1.svg");
        expect(upload.mock.calls[0][0].size).toBe(6);
    });

    it("ignores http images, non-image data URIs and returns the same body when nothing to do", async () => {
        const upload = vi.fn(async (_f: File) => "");
        const body = [image("https://x/y.png"), image("data:text/plain;base64,QUJD")];
        const out = await externalizeDataUriImages({ body, uploadLimitBytes: null, upload });
        expect(upload).not.toHaveBeenCalled();
        expect(out.body).toBe(body);
        expect(out.report.uploaded).toBe(0);
    });

    it("withoutDataUriImages blanks the pixels so the create request stays small", () => {
        const big = uri("A".repeat(4 * 1024 * 1024));
        const body = [{ type: "paragraph" }, image(big), image("https://x/y.png")];
        const out = withoutDataUriImages(body);
        expect(sizeOf(out)).toBeLessThan(300);
        expect(at(out, 1).props?.url).toBe("");
        expect(at(out, 2).props?.url).toBe("https://x/y.png");
        expect(withoutDataUriImages([image("https://x/y.png")])).toEqual([
            image("https://x/y.png"),
        ]);
    });

    it("uses the caller's placeholder text, for a nested and repeated failed image", async () => {
        const body = [{ type: "bulletListItem", children: [image(uri())] }, image(uri())];
        const out = await externalizeDataUriImages({
            body,
            uploadLimitBytes: 1,
            upload: async () => "x",
            placeholderText: (n) => `<<${n}>>`,
        });
        const text = JSON.stringify(out.body);
        expect(text.match(/<<1>>/g)).toHaveLength(2);
        expect(text).not.toContain("data:");
    });

    it("decodes wrapped and URL-safe base64 and counts its size without the whitespace", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/w.png");
        const wrapped = "iVBORw0K\nGgo=";
        const urlSafe = "-_-_";
        await externalizeDataUriImages({
            body: [image(uri(wrapped)), image(uri(urlSafe))],
            uploadLimitBytes: null,
            upload,
        });
        expect(upload).toHaveBeenCalledTimes(2);
        expect(upload.mock.calls[0][0].size).toBe(8);
    });

    it("takes a stray % in a non-base64 svg as itself", async () => {
        const upload = vi.fn(async (_f: File) => "https://api/media/s.svg");
        const svg = 'data:image/svg+xml;utf8,<svg width="100%"/>';
        await externalizeDataUriImages({ body: [image(svg)], uploadLimitBytes: null, upload });
        expect(upload).toHaveBeenCalledTimes(1);
    });

    it("dataImageWarnings lists every data: image for a failed write", () => {
        expect(
            dataImageWarnings([image(uri()), image("https://x/y.png")], "upload-failed")
        ).toEqual([{ index: 1, reason: "upload-failed", bytes: 8, mime: "image/png" }]);
    });
});

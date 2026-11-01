/**
 * Reading an uploaded text attachment for "Import as note".
 *
 * `Response.text()` assumes UTF-8, so a Shift-JIS `.txt` (common for
 * Japanese users) turned into garbage. These pin the strict-UTF-8 then
 * Shift-JIS decode, the authenticated fetch, and the extension matching.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isImportableTextFile } from "../features/notes/common/services/importableAttachment";
import { decodeTextBytes } from "../utils/decodeText";
import { fetchMediaText } from "../utils/downloadUtils";
import { setMediaAccessToken } from "../utils/mediaAuth";

// 日本語 in Shift-JIS. Not valid UTF-8 (0x93 is a bare continuation byte).
const SJIS_NIHONGO = new Uint8Array([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);

describe("decodeTextBytes", () => {
    it("decodes UTF-8", () => {
        const bytes = new TextEncoder().encode("# 見出し\nこんにちは");
        expect(decodeTextBytes(bytes)).toBe("# 見出し\nこんにちは");
    });

    it("strips a UTF-8 BOM", () => {
        const body = new TextEncoder().encode("hello");
        const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
        expect(decodeTextBytes(withBom)).toBe("hello");
    });

    it("falls back to Shift-JIS when the bytes are not valid UTF-8", () => {
        expect(decodeTextBytes(SJIS_NIHONGO)).toBe("日本語");
    });

    it("accepts an ArrayBuffer", () => {
        expect(decodeTextBytes(SJIS_NIHONGO.buffer as ArrayBuffer)).toBe("日本語");
    });
});

describe("fetchMediaText", () => {
    const URL_ = "https://api.genosai.dev/media/chats/c/m/abc.txt";

    beforeEach(() => {
        setMediaAccessToken("tok-import");
    });
    afterEach(() => {
        setMediaAccessToken(null);
        vi.unstubAllGlobals();
    });

    const stubFetch = (bytes: Uint8Array, ok = true, status = 200) => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok,
            status,
            arrayBuffer: async () => bytes.buffer,
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    };

    it("fetches with the session credential and decodes UTF-8", async () => {
        const fetchMock = stubFetch(new TextEncoder().encode("# Title\n\nbody"));
        await expect(fetchMediaText(URL_)).resolves.toBe("# Title\n\nbody");
        expect(fetchMock).toHaveBeenCalledWith(
            URL_,
            expect.objectContaining({
                credentials: "include",
                headers: { Authorization: "Bearer tok-import" },
            })
        );
    });

    it("decodes a Shift-JIS file", async () => {
        stubFetch(SJIS_NIHONGO);
        await expect(fetchMediaText(URL_)).resolves.toBe("日本語");
    });

    it("throws on a failed response instead of importing an error page", async () => {
        stubFetch(new TextEncoder().encode('{"detail":"Not found."}'), false, 404);
        await expect(fetchMediaText(URL_)).rejects.toThrow(/404/);
    });

    it("sends no credential to a local blob: URL", async () => {
        const fetchMock = stubFetch(new TextEncoder().encode("local"));
        await fetchMediaText("blob:https://app.genosai.dev/1234");
        expect(fetchMock).toHaveBeenCalledWith("blob:https://app.genosai.dev/1234", undefined);
    });
});

describe("isImportableTextFile", () => {
    it.each(["a.md", "A.MD", "notes.markdown", "todo.txt", "  spaced.txt  ", "日本語.md"])(
        "accepts %s",
        (name) => expect(isImportableTextFile(name)).toBe(true)
    );
    it.each(["a.pdf", "a.mdx", "a.md.bak", "md", ".md", ".txt", "", null, undefined])(
        "rejects %s",
        (name) => expect(isImportableTextFile(name as string)).toBe(false)
    );
});

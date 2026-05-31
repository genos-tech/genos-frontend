import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadFile } from "../utils/downloadUtils";

describe("downloadFile", () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        const mockLink = {
            href: "",
            download: "",
            target: "",
            click: vi.fn(),
        };

        createElementSpy = vi
            .spyOn(document, "createElement")
            .mockReturnValue(mockLink as unknown as HTMLElement);
        appendChildSpy = vi
            .spyOn(document.body, "appendChild")
            .mockReturnValue(mockLink as unknown as HTMLElement);
        removeChildSpy = vi
            .spyOn(document.body, "removeChild")
            .mockReturnValue(mockLink as unknown as HTMLElement);
        createObjectURLSpy = vi
            .spyOn(window.URL, "createObjectURL")
            .mockReturnValue("blob:http://localhost/fake");
        revokeObjectURLSpy = vi.spyOn(window.URL, "revokeObjectURL").mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("downloads a file when fetch succeeds", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(["content"], { type: "text/plain" })),
        });

        await downloadFile("https://example.com/file.txt", "test.txt");

        expect(createElementSpy).toHaveBeenCalledWith("a");
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it("falls back when fetch fails", async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        await downloadFile("https://example.com/file.txt", "fallback.txt");

        expect(createElementSpy).toHaveBeenCalledWith("a");
    });
});

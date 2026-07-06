import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAttachmentPreviews } from "../../features/tasks/hooks/useAttachmentPreviews";
import type { AttachmentFileProps } from "../../types/tasks";

// The hook's URL composition reads VITE_MEDIA_ROOT_DJANGO through
// buildAvatarSrc; vitest exposes the value from .env files, so pin it
// here instead of depending on the runner's env.
vi.mock("../../utils/avatarSrc", () => ({
    buildAvatarSrc: (path: string | null | undefined) => {
        if (!path) return undefined;
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `https://api.example.com/media/${path}`;
    },
}));

const attachment = (overrides: Partial<AttachmentFileProps>): AttachmentFileProps =>
    ({
        attachment_id: 1,
        file: "task_attachments/1/diagram.png",
        type: "image/png",
        name: "diagram.png",
        ...overrides,
    }) as unknown as AttachmentFileProps;

describe("useAttachmentPreviews (meta attachment shape)", () => {
    it("composes an absolute media URL for meta-mode entries", () => {
        const { result } = renderHook(() =>
            useAttachmentPreviews([
                attachment({ file_url: "/media/task_attachments/1/diagram.png" }),
            ])
        );
        const preview = result.current.get(1);
        expect(preview).toEqual({
            url: "https://api.example.com/media/task_attachments/1/diagram.png",
            kind: "image",
            ownsUrl: false,
        });
    });

    it("still decodes base64 entries (stale IDB cache shape)", () => {
        const { result } = renderHook(() =>
            useAttachmentPreviews([
                attachment({
                    // "hi" — content is irrelevant, the branch is what matters.
                    file_base64: "aGk=",
                    file_url: undefined,
                }),
            ])
        );
        const preview = result.current.get(1);
        expect(preview?.ownsUrl).toBe(true);
        expect(preview?.url).toMatch(/^blob:/);
    });

    it("prefers base64 over the meta URL when both are present", () => {
        // A stale IDB entry merged with fresh server data could carry
        // both; the already-decoded bytes win (no network needed).
        const { result } = renderHook(() =>
            useAttachmentPreviews([
                attachment({
                    file_base64: "aGk=",
                    file_url: "/media/task_attachments/1/diagram.png",
                }),
            ])
        );
        expect(result.current.get(1)?.ownsUrl).toBe(true);
    });

    it("keeps the raw-string fallback for post-save upload shapes", () => {
        const { result } = renderHook(() =>
            useAttachmentPreviews([
                attachment({
                    file: "https://api.example.com/media/task_attachments/1/x.pdf" as never,
                    type: "application/pdf",
                }),
            ])
        );
        expect(result.current.get(1)).toEqual({
            url: "https://api.example.com/media/task_attachments/1/x.pdf",
            kind: "file",
            ownsUrl: false,
        });
    });
});

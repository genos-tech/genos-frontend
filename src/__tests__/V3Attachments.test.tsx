/**
 * Attachment-surface tests.
 *
 * Covers:
 *   - `MessageAttachments` empty state, chip rendering, filename
 *     extraction, image-mime preview thumbnail.
 *   - `formatSize` byte → human-readable string formatting.
 *   - `MessagesPaneV3` integration: rows with attachments render the
 *     strip; rows without attachments don't.
 */

import { render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatSize, MessageAttachments } from "../features/channel/components/MessageAttachments";
import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message, type MessageAttachment } from "../types/channel";
import { setMediaAccessToken } from "../utils/mediaAuth";

const API_HOST = "https://api.genosai.dev";
const CHANNEL_UUID = "11111111-2222-3333-4444-555555555555";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function fakeAttachment(
    id: string,
    fileUrl: string,
    mime: string,
    sizeBytes: number,
    uploaderName = "Alice"
): MessageAttachment {
    return {
        id,
        fileUrl,
        mime,
        sizeBytes,
        uploader: {
            userId: `u-${uploaderName.toLowerCase()}`,
            userName: uploaderName,
            userEmail: `${uploaderName}@x`,
            avatarImgPath: null,
            isSystemUser: false,
        },
        tsCreated: "2026-01-01T00:00:00Z",
    };
}

function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function fakeMessage(id: string, channelId: string, overrides: Partial<Message> = {}): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: "u-alice",
            userName: "Alice",
            userEmail: "alice@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: "msg",
        parentId: null,
        threadRootId: null,
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
        ...overrides,
    };
}

async function resetService() {
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    await channelService.hydrateFromIDB();
}

describe("formatSize", () => {
    it("renders 0 B for zero / negative / NaN", () => {
        expect(formatSize(0)).toBe("0 B");
        expect(formatSize(-1)).toBe("0 B");
        expect(formatSize(Number.NaN)).toBe("0 B");
    });

    it("renders bytes without decimals", () => {
        expect(formatSize(512)).toBe("512 B");
    });

    it("renders KB with up to one decimal", () => {
        expect(formatSize(1024)).toBe("1 KB");
        expect(formatSize(1536)).toBe("1.5 KB");
    });

    it("renders MB and beyond", () => {
        expect(formatSize(1024 * 1024)).toBe("1 MB");
        expect(formatSize(5_242_880)).toBe("5 MB");
        expect(formatSize(3_145_728_000)).toBe("2.9 GB");
    });
});

describe("MessageAttachments", () => {
    it("renders nothing for an empty list", () => {
        const { container } = render(<MessageAttachments attachments={[]} messageId="m-1" />);
        expect(container.firstChild).toBeNull();
    });

    it("renders one chip per attachment with filename + size", () => {
        const atts: MessageAttachment[] = [
            fakeAttachment(
                "a-1",
                "https://cdn.example.com/chats/c/m/spec.pdf",
                "application/pdf",
                2048
            ),
            fakeAttachment(
                "a-2",
                "https://cdn.example.com/chats/c/m/notes.txt",
                "text/plain",
                512
            ),
        ];
        render(<MessageAttachments attachments={atts} messageId="m-1" />);
        const strip = screen.getByTestId("message-attachments-m-1");
        expect(strip).toBeInTheDocument();
        const linkA = screen.getByTestId("message-attachment-link-a-1");
        expect(linkA).toHaveTextContent("spec.pdf");
        expect(linkA).toHaveTextContent("2 KB");
        expect(linkA).toHaveAttribute("href", "https://cdn.example.com/chats/c/m/spec.pdf");
        const linkB = screen.getByTestId("message-attachment-link-a-2");
        expect(linkB).toHaveTextContent("notes.txt");
        expect(linkB).toHaveTextContent("512 B");
    });

    it("renders an inline preview thumbnail for image-mime attachments", () => {
        const atts: MessageAttachment[] = [
            fakeAttachment(
                "a-img",
                "https://cdn.example.com/chats/c/m/screenshot.png",
                "image/png",
                4096
            ),
            fakeAttachment(
                "a-pdf",
                "https://cdn.example.com/chats/c/m/report.pdf",
                "application/pdf",
                4096
            ),
        ];
        render(<MessageAttachments attachments={atts} messageId="m-1" />);
        const preview = screen.getByTestId("message-attachment-preview-a-img");
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute("src", "https://cdn.example.com/chats/c/m/screenshot.png");
        expect(screen.queryByTestId("message-attachment-preview-a-pdf")).toBeNull();
    });

    // The reported bug: the recipient saw a broken image captioned with
    // the filename, and `{"detail": "Not found."}` in the console — the
    // per-file media ACL refusing the request, because an <img> can only
    // offer the browser's `refresh` cookie and that cookie identified
    // someone who wasn't in the conversation.
    describe("protected /media/ thumbnails", () => {
        const PROTECTED = `${API_HOST}/media/chats/${CHANNEL_UUID}/messages/9/screenshot.png`;

        beforeEach(() => {
            vi.stubGlobal(
                "URL",
                Object.assign(URL, {
                    createObjectURL: vi.fn(() => "blob:authed-image"),
                    revokeObjectURL: vi.fn(),
                })
            );
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => ({
                    ok: true,
                    blob: async () => ({ size: 32, type: "image/png" }) as unknown as Blob,
                }))
            );
        });

        afterEach(() => {
            setMediaAccessToken(null);
            vi.unstubAllGlobals();
        });

        it("renders the session-authenticated blob, never the raw URL", async () => {
            setMediaAccessToken("tok-att");
            const atts = [fakeAttachment("a-img", PROTECTED, "image/png", 32)];
            render(<MessageAttachments attachments={atts} messageId="m-1" />);

            // Crucially it does not paint the protected URL first: that
            // request would be made by the browser with the cookie, and
            // its failure is what the user saw.
            expect(screen.queryByTestId("message-attachment-preview-a-img")).toBeNull();

            const preview = await screen.findByTestId("message-attachment-preview-a-img");
            expect(preview).toHaveAttribute("src", "blob:authed-image");
            expect(fetch).toHaveBeenCalledWith(
                PROTECTED,
                expect.objectContaining({ headers: { Authorization: "Bearer tok-att" } })
            );
        });

        it("still shows the picture when the fetch fails", async () => {
            // Falling back to the plain URL keeps the browser's cookie
            // attempt, i.e. exactly today's behaviour — this change can
            // fix a broken image but must never break a working one.
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => ({ ok: false, status: 404 }))
            );
            setMediaAccessToken("tok-att");
            render(
                <MessageAttachments
                    attachments={[fakeAttachment("a-img", PROTECTED, "image/png", 32)]}
                    messageId="m-1"
                />
            );
            const preview = await screen.findByTestId("message-attachment-preview-a-img");
            expect(preview).toHaveAttribute("src", PROTECTED);
        });

        it("downloads the chip through the token instead of navigating", async () => {
            setMediaAccessToken("tok-att");
            render(
                <MessageAttachments
                    attachments={[fakeAttachment("a-img", PROTECTED, "image/png", 32)]}
                    messageId="m-1"
                />
            );
            const link = screen.getByTestId("message-attachment-link-a-img");
            // href is retained for copy-link / middle-click, but a plain
            // navigation would land on the API's JSON error page.
            expect(link).toHaveAttribute("href", PROTECTED);

            const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
            link.dispatchEvent(clickEvent);
            expect(clickEvent.defaultPrevented).toBe(true);
            await vi.waitFor(() =>
                expect(fetch).toHaveBeenCalledWith(
                    PROTECTED,
                    expect.objectContaining({ headers: { Authorization: "Bearer tok-att" } })
                )
            );
        });
    });

    it("falls back to 'attachment' when the URL has no filename", () => {
        const atts: MessageAttachment[] = [
            fakeAttachment("a-noname", "", "application/octet-stream", 16),
        ];
        render(<MessageAttachments attachments={atts} messageId="m-1" />);
        expect(screen.getByTestId("message-attachment-link-a-noname")).toHaveTextContent(
            "attachment"
        );
    });

    it("decodes URL-encoded filenames", () => {
        const atts: MessageAttachment[] = [
            fakeAttachment(
                "a-utf",
                "https://cdn.example.com/chats/c/m/%E5%AD%97%20file.txt",
                "text/plain",
                100
            ),
        ];
        render(<MessageAttachments attachments={atts} messageId="m-1" />);
        expect(screen.getByTestId("message-attachment-link-a-utf")).toHaveTextContent(
            "字 file.txt"
        );
    });
});

describe("MessagesPaneV3 attachments integration", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("renders the attachment strip on rows that have attachments", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                bodyText: "see attached",
                attachments: [
                    fakeAttachment(
                        "a-1",
                        "https://cdn.example.com/chats/c/m/spec.pdf",
                        "application/pdf",
                        2048
                    ),
                ],
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-attachments-m-1")).toBeInTheDocument();
        expect(screen.getByTestId("message-attachment-link-a-1")).toHaveTextContent("spec.pdf");
    });

    it("does NOT render the strip on rows without attachments", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", { bodyText: "plain message" })
        );
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-attachments-m-1")).toBeNull();
    });

    it("does NOT render the strip on deleted rows", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                bodyText: "gone",
                deletedAt: "2026-01-02T00:00:00Z",
                attachments: [
                    fakeAttachment(
                        "a-1",
                        "https://cdn.example.com/chats/c/m/spec.pdf",
                        "application/pdf",
                        2048
                    ),
                ],
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-attachments-m-1")).toBeNull();
    });
});

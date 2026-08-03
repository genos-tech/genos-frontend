/**
 * Attachment-upload tests.
 *
 * Covers:
 *   - `useAttachmentDraft` add / remove / size-guard / uploadAll
 *     (success + partial failure)
 *   - `channelService.uploadAttachment` posts multipart to the v3 path
 *     with the right shape
 *   - `channelService.handleAttachmentAdded` splices into the store
 *   - `MessagesPaneV3` composer integration: attach button reveals
 *     pending chips, send pipelines upload via `uploadAttachment`,
 *     successful uploads land on the row via the store
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { useAttachmentDraft } from "../features/channel/hooks/useAttachmentDraft";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message, type MessageAttachment } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

// The composer's size guard is the user's TIER limit now, resolved from
// `/agent/features/`. Both the token and the resolver are stubbed so the
// tests state the limit outright instead of inheriting a constant — the
// flat 25 MiB they used to assert against was itself the bug (it sat
// ABOVE free's 5 MB server cap, so a free user's 20 MB file uploaded in
// full before being rejected).
vi.mock("../context/AuthContext", () => ({
    useOptionalAccessToken: () => "test-token",
}));

const FREE_LIMIT = 5 * 1024 * 1024;

/** Flush the hook's async limit resolution. Staging a file before this
 *  is a real state the hook handles (see the re-flag test), so it is
 *  awaited explicitly rather than hidden in a global setup. */
const waitForLimit = async (result: { current: { limitBytes: number | null } }) =>
    waitFor(() => expect(result.current.limitBytes).toBe(FREE_LIMIT));

vi.mock("../services/uploadLimit", () => ({
    resolveUploadLimitBytes: () => Promise.resolve(5 * 1024 * 1024),
    invalidateUploadLimit: vi.fn(),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

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
            userId: "u-me",
            userName: "Me",
            userEmail: "me@x",
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

function fakeAttachment(
    id: string,
    fileUrl: string,
    mime: string,
    sizeBytes: number
): MessageAttachment {
    return {
        id,
        fileUrl,
        mime,
        sizeBytes,
        uploader: {
            userId: "u-me",
            userName: "Me",
            userEmail: "me@x",
            avatarImgPath: null,
            isSystemUser: false,
        },
        tsCreated: "2026-01-01T00:00:02Z",
    };
}

function makeFile(name: string, size: number, type = "application/pdf"): File {
    // Stub a File where `size` reflects the chosen byte count without
    // actually allocating the buffer. The File constructor recomputes
    // `size` from the parts at construction time, so we override on the
    // instance afterwards.
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size, configurable: true });
    return file;
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

describe("useAttachmentDraft", () => {
    beforeEach(() => {
        localStorage.setItem("userId", "u-me");
    });

    it("addFiles appends each picked file", () => {
        const { result } = renderHook(() => useAttachmentDraft());
        const a = makeFile("a.pdf", 100);
        const b = makeFile("b.txt", 200);
        act(() => result.current.addFiles([a, b]));
        expect(result.current.pending).toHaveLength(2);
        expect(result.current.pending[0].file).toBe(a);
        expect(result.current.pending[0].error).toBeNull();
        expect(result.current.pending[1].file).toBe(b);
    });

    it("flags files larger than the user's tier limit with an error", async () => {
        const { result } = renderHook(() => useAttachmentDraft());
        await waitForLimit(result);
        const big = makeFile("big.bin", FREE_LIMIT + 1);
        act(() => result.current.addFiles([big]));
        expect(result.current.pending[0].error).toMatch(/exceeds/);
        expect(result.current.pending[0].error).toContain("5 MB");
    });

    it("re-flags a file staged before the tier limit had resolved", async () => {
        // The limit arrives a tick after mount, so a file picked
        // immediately is staged against the permissive default. It must
        // not stay unflagged — otherwise it sits in the strip looking
        // fine until the server rejects it mid-send.
        const { result } = renderHook(() => useAttachmentDraft());
        const big = makeFile("big.bin", FREE_LIMIT + 1);
        act(() => result.current.addFiles([big]));
        expect(result.current.pending[0].error).toBeNull(); // permissive, pre-resolve
        await waitForLimit(result);
        expect(result.current.pending[0].error).toMatch(/exceeds/);
    });

    it("removeAt drops the matching entry", () => {
        const { result } = renderHook(() => useAttachmentDraft());
        const a = makeFile("a.pdf", 10);
        const b = makeFile("b.pdf", 20);
        act(() => result.current.addFiles([a, b]));
        const firstId = result.current.pending[0].localId;
        act(() => result.current.removeAt(firstId));
        expect(result.current.pending).toHaveLength(1);
        expect(result.current.pending[0].file).toBe(b);
    });

    it("uploadAll calls channelService.uploadAttachment per file and drops successes", async () => {
        const { result } = renderHook(() => useAttachmentDraft());
        const a = makeFile("a.pdf", 10);
        const b = makeFile("b.pdf", 20);
        act(() => result.current.addFiles([a, b]));
        const spy = vi
            .spyOn(channelService, "uploadAttachment")
            .mockResolvedValueOnce(fakeAttachment("att-1", "/a.pdf", "application/pdf", 10))
            .mockResolvedValueOnce(fakeAttachment("att-2", "/b.pdf", "application/pdf", 20));
        const splice = vi.spyOn(channelService, "handleAttachmentAdded");

        // Definite-assignment `!` tells TS the variable is set inside
        // the callback. Without it, the flow analyzer keeps the type
        // pinned to `null` after the await (callback mutation isn't
        // tracked) and accessors below narrow to `never`.
        let report!: Awaited<ReturnType<typeof result.current.uploadAll>>;
        await act(async () => {
            report = await result.current.uploadAll("c-1", "m-1");
        });

        expect(spy).toHaveBeenCalledTimes(2);
        expect(splice).toHaveBeenCalledTimes(2);
        expect(report.succeeded).toBe(2);
        expect(report.failed).toHaveLength(0);
        expect(result.current.pending).toHaveLength(0);
        spy.mockRestore();
        splice.mockRestore();
    });

    it("uploadAll keeps failures in the pending list and reports them", async () => {
        const { result } = renderHook(() => useAttachmentDraft());
        const a = makeFile("a.pdf", 10);
        const b = makeFile("b.pdf", 20);
        act(() => result.current.addFiles([a, b]));
        const spy = vi
            .spyOn(channelService, "uploadAttachment")
            .mockResolvedValueOnce(fakeAttachment("att-1", "/a.pdf", "application/pdf", 10))
            .mockRejectedValueOnce(new Error("boom"));

        // Definite-assignment `!` tells TS the variable is set inside
        // the callback. Without it, the flow analyzer keeps the type
        // pinned to `null` after the await (callback mutation isn't
        // tracked) and accessors below narrow to `never`.
        let report!: Awaited<ReturnType<typeof result.current.uploadAll>>;
        await act(async () => {
            report = await result.current.uploadAll("c-1", "m-1");
        });

        expect(report.succeeded).toBe(1);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].error).toBe("boom");
        // The failed file stays — user can retry or remove.
        expect(result.current.pending).toHaveLength(1);
        expect(result.current.pending[0].file.name).toBe("b.pdf");
        spy.mockRestore();
    });

    it("uploadAll skips entries that already have a client-side error", async () => {
        const { result } = renderHook(() => useAttachmentDraft());
        await waitForLimit(result);
        const ok = makeFile("ok.pdf", 10);
        const big = makeFile("big.bin", FREE_LIMIT + 1);
        act(() => result.current.addFiles([ok, big]));
        const spy = vi
            .spyOn(channelService, "uploadAttachment")
            .mockResolvedValue(fakeAttachment("att-1", "/ok.pdf", "application/pdf", 10));

        // Definite-assignment `!` tells TS the variable is set inside
        // the callback. Without it, the flow analyzer keeps the type
        // pinned to `null` after the await (callback mutation isn't
        // tracked) and accessors below narrow to `never`.
        let report!: Awaited<ReturnType<typeof result.current.uploadAll>>;
        await act(async () => {
            report = await result.current.uploadAll("c-1", "m-1");
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(report.succeeded).toBe(1);
        // The errored file remains since uploadAll never touched it.
        expect(result.current.pending).toHaveLength(1);
        expect(result.current.pending[0].file.name).toBe("big.bin");
        spy.mockRestore();
    });
});

describe("channelService.handleAttachmentAdded", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("appends the attachment to the matching message", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        const att = fakeAttachment("att-1", "/a.pdf", "application/pdf", 10);

        channelService.handleAttachmentAdded("c-1", "m-1", att);

        const snap = channelService.getSnapshot();
        const msgs = snap.messagesByChannel.get("c-1") ?? [];
        const target = msgs.find((m) => m.id === "m-1");
        expect(target?.attachments).toHaveLength(1);
        expect(target?.attachments[0].id).toBe("att-1");
    });

    it("dedupes by attachment id (idempotent)", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1"));
        const att = fakeAttachment("att-1", "/a.pdf", "application/pdf", 10);

        channelService.handleAttachmentAdded("c-1", "m-1", att);
        channelService.handleAttachmentAdded("c-1", "m-1", att);

        const snap = channelService.getSnapshot();
        const target = (snap.messagesByChannel.get("c-1") ?? []).find((m) => m.id === "m-1");
        expect(target?.attachments).toHaveLength(1);
    });
});

describe("MessagesPaneV3 attach + send integration", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("the attach button reveals pending chips after picking files", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);

        const fileInput = screen.getByTestId("messages-pane-v3-file-input") as HTMLInputElement;
        const f = makeFile("notes.pdf", 1024);
        fireEvent.change(fileInput, { target: { files: [f] } });

        expect(screen.getByTestId("messages-pane-v3-pending-strip")).toBeInTheDocument();
        const strip = screen.getByTestId("messages-pane-v3-pending-strip");
        expect(strip).toHaveTextContent("notes.pdf");
        expect(strip).toHaveTextContent("1 KB");
    });

    it("send pipelines an upload via channelService.uploadAttachment", async () => {
        // BlockNote replaced the plain `<input>` in the composer, so we
        // can't type body text via fireEvent.change here. The pipeline
        // (file → send → uploadAttachment) is what this test guards;
        // the empty-body case is exactly the "attachment-only" path we
        // already exercise in the next test, so the pipeline coverage
        // stays unchanged.
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const created = fakeMessage("m-new", "c-1", { bodyText: "" });
        const sendSpy = vi.spyOn(channelService, "send").mockResolvedValue(created);
        const uploadSpy = vi
            .spyOn(channelService, "uploadAttachment")
            .mockResolvedValue(fakeAttachment("att-1", "/notes.pdf", "application/pdf", 1024));

        render(<MessagesPaneV3 channelId="c-1" />);

        // Pick a file.
        const fileInput = screen.getByTestId("messages-pane-v3-file-input") as HTMLInputElement;
        const f = makeFile("notes.pdf", 1024);
        fireEvent.change(fileInput, { target: { files: [f] } });

        // Hit send.
        fireEvent.click(screen.getByTestId("messages-pane-v3-send"));

        await waitFor(() => {
            expect(sendSpy).toHaveBeenCalled();
            expect(uploadSpy).toHaveBeenCalledWith("m-new", f);
        });

        sendSpy.mockRestore();
        uploadSpy.mockRestore();
    });

    it("send is enabled with only an attachment (no text)", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);

        const sendBtn = screen.getByTestId("messages-pane-v3-send") as HTMLButtonElement;
        expect(sendBtn.disabled).toBe(true);

        const fileInput = screen.getByTestId("messages-pane-v3-file-input") as HTMLInputElement;
        const f = makeFile("a.pdf", 100);
        fireEvent.change(fileInput, { target: { files: [f] } });

        expect(sendBtn.disabled).toBe(false);
    });

    it("send is disabled when only an oversized attachment is staged", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);

        const fileInput = screen.getByTestId("messages-pane-v3-file-input") as HTMLInputElement;
        const big = makeFile("big.bin", FREE_LIMIT + 1);
        fireEvent.change(fileInput, { target: { files: [big] } });

        const sendBtn = screen.getByTestId("messages-pane-v3-send") as HTMLButtonElement;
        // `waitFor`, not a bare assertion: the tier limit resolves
        // asynchronously, and the re-check that flags the file runs when
        // it lands.
        await waitFor(() => expect(sendBtn.disabled).toBe(true));
    });

    it("remove × on a pending chip drops it from the strip", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);

        const fileInput = screen.getByTestId("messages-pane-v3-file-input") as HTMLInputElement;
        const f = makeFile("notes.pdf", 100);
        fireEvent.change(fileInput, { target: { files: [f] } });
        expect(screen.getByTestId("messages-pane-v3-pending-strip")).toBeInTheDocument();

        // The localId is generated dynamically; find the remove button by
        // its testid prefix.
        const removeBtn = screen
            .getByTestId("messages-pane-v3-pending-strip")
            .querySelector(
                '[data-testid^="messages-pane-v3-pending-remove-"]'
            ) as HTMLButtonElement;
        expect(removeBtn).not.toBeNull();
        fireEvent.click(removeBtn);

        expect(screen.queryByTestId("messages-pane-v3-pending-strip")).toBeNull();
    });
});

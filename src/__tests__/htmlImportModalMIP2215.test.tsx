// MIP-2215: `.html` in the existing import dialog. Offered only while the server has HTML notes on;
// a page is stored through the import endpoint (never parsed as markdown) and opened; a Free member
// and a page over the plan's size are told before anything is sent; what the scan found is shown in
// the dialog instead of closing it; a markdown file is untouched.
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalImportMarkdown } from "../features/notes/common/components/ModalImportMarkdown";
import { importHtmlNote } from "../features/notes/common/services/importHtmlNote";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

const limit = vi.hoisted(() => ({
    value: { enabled: true, maxBytes: 524288 } as
        | { enabled: false }
        | { enabled: true; maxBytes: number | null },
}));
vi.mock("../services/htmlNoteLimits", () => ({
    resolveHtmlNoteLimit: vi.fn(async () => limit.value),
}));
vi.mock("../services/uploadLimit", () => ({ resolveUploadLimitBytes: vi.fn(async () => null) }));
vi.mock("../context/authState", () => ({ useOptionalAccessToken: () => "tok" }));
vi.mock("../features/notes/common/services/importHtmlNote", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/common/services/importHtmlNote")>()),
    importHtmlNote: vi.fn(),
}));
vi.mock("../features/notes/common/services/noteMarkdown", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/common/services/noteMarkdown")>()),
    markdownToNoteBlocks: vi.fn(async () => []),
}));

const mockImport = vi.mocked(importHtmlNote);
const myself = { userId: "u1", teamId: "t1" } as UserProps;
const PAGE =
    "<!doctype html><html><head><title>Sprint burndown</title></head><body>x</body></html>";

const useNM = {
    myNoteFolders: [],
    teamNoteFolders: [],
    taskNoteMeta: [],
    chatNoteMeta: [],
    handleCreateNewMyNote: vi.fn(async () => true),
    getMyNoteMeta: vi.fn(async () => true),
    getTeamNoteMeta: vi.fn(async () => true),
    getTaskNoteMeta: vi.fn(async () => true),
    getChatNoteMeta: vi.fn(async () => true),
    setCurrentNoteType: vi.fn(),
    loadNote: vi.fn(async () => undefined),
} as unknown as NoteManagementState;

const onClose = vi.fn();
const renderModal = () =>
    render(
        <CssVarsProvider>
            <ModalImportMarkdown
                context={{ kind: "my" }}
                myself={myself}
                useNM={useNM}
                open
                onClose={onClose}
            />
        </CssVarsProvider>
    );

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pick = async (name: string, text: string) => {
    const file = new File([text], name);
    // jsdom's File has no arrayBuffer in some versions: give it one the dialog can read.
    if (!file.arrayBuffer) {
        Object.defineProperty(file, "arrayBuffer", {
            value: async () => new TextEncoder().encode(text).buffer,
        });
    }
    await act(async () => {
        fireEvent.change(fileInput(), { target: { files: [file] } });
    });
};
const importButton = () => screen.getByRole("button", { name: "Import" }) as HTMLButtonElement;

beforeEach(() => {
    limit.value = { enabled: true, maxBytes: 524288 };
    mockImport.mockReset();
    onClose.mockClear();
    vi.mocked(useNM.handleCreateNewMyNote).mockClear();
    vi.mocked(useNM.loadNote).mockClear();
    vi.mocked(useNM.setCurrentNoteType).mockClear();
});
afterEach(cleanup);

describe("what the dialog offers", () => {
    it("offers .html while HTML notes are on, and says so on the chooser", async () => {
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        expect(fileInput().accept).toContain(".htm");
        expect(screen.getByText(/\.md or \.html/)).toBeTruthy();
    });

    it("offers only markdown while HTML notes are off", async () => {
        limit.value = { enabled: false };
        renderModal();
        await act(async () => void (await Promise.resolve()));
        expect(fileInput().accept).toBe(".md,.markdown,.txt");
        expect(screen.queryByText(/\.md or \.html/)).toBeNull();
    });
});

describe("importing a page", () => {
    it("takes the title from the page, sends it as a page, opens the note and closes", async () => {
        mockImport.mockResolvedValue({
            status: "created",
            noteId: 33,
            noteType: "personal",
            title: "Sprint burndown",
            warnings: [],
        });
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("report.html", PAGE);
        expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Sprint burndown");

        await act(async () => void fireEvent.click(importButton()));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mockImport).toHaveBeenCalledTimes(1);
        expect(mockImport.mock.calls[0][0]).toMatchObject({
            accessToken: "tok",
            teamId: "t1",
            html: PAGE,
            title: "Sprint burndown",
            target: { kind: "personal", folderId: null },
        });
        expect(useNM.handleCreateNewMyNote).not.toHaveBeenCalled();
        expect(useNM.setCurrentNoteType).toHaveBeenCalledWith(1);
        expect(useNM.loadNote).toHaveBeenCalledWith(1, 33, -1);
    });

    it("falls back to the file name when the page has no title", async () => {
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("Weekly report.html", "<p>no title</p>");
        expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Weekly report");
    });

    it("shows what the scan found, in words, instead of closing", async () => {
        mockImport.mockResolvedValue({
            status: "created",
            noteId: 34,
            noteType: "personal",
            title: "t",
            warnings: [
                { code: "external_script", message: "English from the server", count: 2 },
                { code: "a_code_this_client_does_not_know", message: "x" },
            ],
        });
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("a.html", PAGE);
        await act(async () => void fireEvent.click(importButton()));
        await screen.findByText(/Imported as an HTML page/);
        expect(
            screen.getByText(/Scripts loaded from another address won't run \(2\)/)
        ).toBeTruthy();
        expect(screen.getByText(/Part of the page won't show in the sandbox/)).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
        expect(useNM.loadNote).toHaveBeenCalledWith(1, 34, -1);
    });

    it("shows the server's refusal as written and stays open", async () => {
        mockImport.mockResolvedValue({
            status: "refused",
            httpStatus: 400,
            reason: "You have saved 30 HTML pages this hour, which is your plan's limit.",
        });
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("a.html", PAGE);
        await act(async () => void fireEvent.click(importButton()));
        await screen.findByText(/saved 30 HTML pages this hour/);
        expect(onClose).not.toHaveBeenCalled();
        expect(useNM.loadNote).not.toHaveBeenCalled();
    });
});

describe("what the plan allows, said before anything is sent", () => {
    it("tells a Free member HTML pages are Core and up, and does not offer Import", async () => {
        limit.value = { enabled: true, maxBytes: null };
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("a.html", PAGE);
        expect(screen.getByRole("alert").textContent).toMatch(/Core plan and up/);
        expect(importButton().disabled).toBe(true);
        expect(mockImport).not.toHaveBeenCalled();
    });

    it("tells a member their page is over the limit, with both sizes", async () => {
        limit.value = { enabled: true, maxBytes: 100 };
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("big.html", PAGE + "x".repeat(500));
        expect(screen.getByRole("alert").textContent).toMatch(/over your plan's/);
        expect(importButton().disabled).toBe(true);
    });
});

describe("a markdown file", () => {
    it("is imported as before, even while HTML notes are on", async () => {
        renderModal();
        await waitFor(() => expect(fileInput().accept).toContain(".html"));
        await pick("notes.md", "# hello");
        await act(async () => void fireEvent.click(importButton()));
        await waitFor(() => expect(useNM.handleCreateNewMyNote).toHaveBeenCalled());
        expect(mockImport).not.toHaveBeenCalled();
    });
});

/**
 * MIP-1836: the owner's "Import from Slack" dialog.
 *
 * Pins: only the owner is offered it; choosing a ZIP shows the server's preview (nothing is
 * imported yet); the import sends the chosen channels only; the result offers an undo with a
 * confirm; a server refusal is worded in the dialog.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SlackImportPanel } from "../features/admin/components/team/SlackImportPanel";
import { SlackImportError } from "../features/admin/services/slackImportApi";

const preview = vi.fn();
const commit = vi.fn();
const undoPlan = vi.fn();
const undo = vi.fn();
const refreshChannels = vi.fn();

vi.mock("../features/admin/services/slackImportApi", async (orig) => {
    const real = await orig<typeof import("../features/admin/services/slackImportApi")>();
    return {
        ...real,
        previewSlackImport: (...a: unknown[]) => preview(...a),
        commitSlackImport: (...a: unknown[]) => commit(...a),
        previewUndoSlackImport: (...a: unknown[]) => undoPlan(...a),
        undoSlackImport: (...a: unknown[]) => undo(...a),
    };
});
vi.mock("../services/channel/channelService", () => ({
    channelService: { refreshChannels: (...a: unknown[]) => refreshChannels(...a) },
}));
vi.mock("../context/authState", () => ({
    useOptionalAccessToken: () => "token-1",
    useAuth: () => ({ accessToken: "token-1" }),
}));

const TEAM = "11111111-1111-1111-1111-111111111111";

const channel = (id: string, name: string, over = {}) => ({
    slack_id: id,
    name,
    is_private: false,
    is_archived: false,
    is_general: false,
    message_count: 3,
    already_imported: 0,
    target: { action: "create", title: name },
    member_count: 2,
    warnings: [],
    ...over,
});

const PREVIEW = {
    file_sha256: "x",
    limits: { max_zip_mb: 50, max_channels: 50, max_messages: 20000 },
    counts: {
        channels: 2,
        to_create: 2,
        existing: 0,
        messages: 6,
        already_imported: 0,
        replies: 1,
        threads: 1,
        reactions: 0,
        files: 1,
    },
    warnings: [{ code: "file_links_need_slack_login", count: 1 }],
    users: [
        {
            slack_id: "U1",
            name: "Ann Example",
            email: "ann@example.com",
            status: "matched",
            genos_user: { id: "u", username: "ann" },
            message_count: 4,
        },
        {
            slack_id: "U3",
            name: "Cy Outsider",
            email: "cy@elsewhere.test",
            status: "unmatched",
            genos_user: null,
            message_count: 2,
        },
    ],
    channels: [channel("C1", "general"), channel("C2", "random")],
};

const renderPanel = (isOwner = true) =>
    render(
        <CssVarsProvider>
            <SlackImportPanel isOwner={isOwner} teamId={TEAM} zIndex={1300} />
        </CssVarsProvider>
    );

const pick = async () => {
    fireEvent.click(screen.getByTestId("slack-import-open"));
    const input = await screen.findByTestId("slack-import-file");
    const file = new File(["zip"], "export.zip", { type: "application/zip" });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByTestId("slack-import-summary");
};

describe("SlackImportPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        preview.mockResolvedValue(PREVIEW);
        commit.mockResolvedValue({
            run_id: "run-1",
            channels_created: 1,
            messages_created: 3,
            skipped: 0,
            failed: 0,
            report: [],
        });
        undoPlan.mockResolvedValue({ will_remove_messages: 3, will_delete_channels: 1, kept: 0 });
        undo.mockResolvedValue({ removed_messages: 3, deleted_channels: 1, kept: 0 });
    });

    it("renders nothing for anyone but the owner", () => {
        renderPanel(false);
        expect(screen.queryByTestId("slack-import-open")).toBeNull();
    });

    it("previews first, names the file warning and the unmatched person, imports nothing yet", async () => {
        renderPanel();
        await pick();
        expect(preview).toHaveBeenCalledWith("token-1", TEAM, expect.any(File));
        expect(commit).not.toHaveBeenCalled();
        expect(screen.getByText(/Files become links to Slack/)).toBeTruthy();
        expect(screen.getByText("Not a team member")).toBeTruthy();
        expect(screen.getByText("Matched to ann")).toBeTruthy();
    });

    it("imports only the channels left ticked, then offers an undo with a confirm", async () => {
        renderPanel();
        await pick();
        fireEvent.click(screen.getByLabelText("random"));
        fireEvent.click(screen.getByTestId("slack-import-go"));
        await screen.findByTestId("slack-import-result");
        expect(commit).toHaveBeenCalledWith("token-1", TEAM, expect.any(File), ["C1"]);
        expect(refreshChannels).toHaveBeenCalled();
        fireEvent.click(screen.getByText("Undo this import…"));
        await screen.findByText(/This removes 3 messages and 1 chats/);
        expect(undo).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Remove them"));
        await screen.findByTestId("slack-import-undone");
        expect(undo).toHaveBeenCalledWith("token-1", TEAM, "run-1");
    });

    it("words a refusal in the dialog", async () => {
        preview.mockRejectedValue(new SlackImportError("not_a_zip"));
        renderPanel();
        fireEvent.click(screen.getByTestId("slack-import-open"));
        const input = await screen.findByTestId("slack-import-file");
        fireEvent.change(input, { target: { files: [new File(["x"], "x.zip")] } });
        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toMatch(/Slack export ZIP/)
        );
    });
});

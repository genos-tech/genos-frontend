/**
 * MIP-1706: the team owner's "Remove sample data" entry.
 *
 * What matters: only the owner is offered it; the dialog lists exactly what the server's preview
 * returned (what goes, and what stays and why); confirming calls the removal for THIS team and
 * refreshes the chat list (`refreshChannels`, which evicts, never `listChannels`); a failure is
 * shown and keeps the dialog open; and the empty states say so instead of offering a removal.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SampleDataPanel } from "../features/admin/components/team/SampleDataPanel";
import type { SampleDataPreview, SampleDataResult } from "../features/admin/services/sampleData";

const loadPreview = vi.fn();
const remove = vi.fn();
const refreshChannels = vi.fn();
const listChannels = vi.fn();

vi.mock("../features/admin/services/sampleData", () => ({
    loadSampleDataPreview: (...args: unknown[]) => loadPreview(...args),
    removeSampleData: (...args: unknown[]) => remove(...args),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: {
        refreshChannels: (...args: unknown[]) => refreshChannels(...args),
        listChannels: (...args: unknown[]) => listChannels(...args),
    },
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token-1" }),
}));

const TEAM = "11111111-1111-1111-1111-111111111111";

const preview = (over: Partial<SampleDataPreview> = {}): SampleDataPreview => ({
    recorded: true,
    nothingToRemove: false,
    remove: [
        { type: "project", id: "1", name: "Getting started with Genos" },
        { type: "project", id: "2", name: "Sample dept: Website refresh" },
        { type: "channel", id: "c1", name: "sample-dept · general" },
        { type: "note_folder", id: "5", name: "Sample dept" },
        { type: "todo_item", id: "9", name: "Look through the sample dept" },
    ],
    keep: [
        {
            type: "project",
            id: "3",
            name: "Sample dept: Hiring plan (private)",
            reason: "project_changed",
            detail: { tasks: 1 },
        },
    ],
    counts: { project: 2, channel: 1, note_folder: 1, todo_item: 1 },
    contents: { tasks: 31, milestones: 5 },
    alreadyGone: 0,
    ...over,
});

const result = (over: Partial<SampleDataResult> = {}): SampleDataResult => ({
    recorded: true,
    nothingToRemove: false,
    complete: true,
    removed: preview().remove,
    kept: preview().keep,
    failed: [],
    counts: {},
    contents: {},
    alreadyGone: 0,
    ...over,
});

const renderPanel = (isOwner = true) =>
    render(
        <CssVarsProvider>
            <SampleDataPanel isOwner={isOwner} teamId={TEAM} zIndex={1300} />
        </CssVarsProvider>
    );

const openDialog = async () => {
    fireEvent.click(screen.getByTestId("sample-data-open"));
    await screen.findByText("Remove the sample data?");
};

describe("SampleDataPanel", () => {
    const assign = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        loadPreview.mockResolvedValue(preview());
        remove.mockResolvedValue(result());
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...window.location, assign },
        });
    });

    it("offers the entry to the owner only", () => {
        renderPanel(false);
        expect(screen.queryByTestId("sample-data-open")).toBeNull();
        expect(screen.queryByText("Sample data")).toBeNull();
        renderPanel(true);
        expect(screen.getByTestId("sample-data-open")).toBeTruthy();
    });

    it("asks for the preview of this team only when opened, and lists what it returned", async () => {
        renderPanel();
        expect(loadPreview).not.toHaveBeenCalled();
        await openDialog();
        await screen.findByText("Getting started with Genos");
        expect(loadPreview).toHaveBeenCalledWith("token-1", TEAM);
        // By type, with counts and the names.
        expect(screen.getByText("2 projects")).toBeTruthy();
        expect(screen.getByText("1 group chat")).toBeTruthy();
        expect(screen.getByText("1 team folder")).toBeTruthy();
        expect(screen.getByText("Sample dept: Website refresh")).toBeTruthy();
        expect(screen.getByText("sample-dept · general")).toBeTruthy();
        expect(screen.getByText(/31 tasks and 5 milestones/)).toBeTruthy();
        // What stays, and why.
        expect(screen.getByText("Will stay")).toBeTruthy();
        expect(screen.getByText("Sample dept: Hiring plan (private)")).toBeTruthy();
        expect(screen.getByText(/You added or changed something in it\./)).toBeTruthy();
    });

    it("removes nothing until confirmed, and cancel closes without calling the API", async () => {
        renderPanel();
        await openDialog();
        await screen.findByText("Getting started with Genos");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(remove).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByText("Remove the sample data?")).toBeNull());
    });

    it("confirming removes for this team, refreshes the chats and then reloads the app", async () => {
        renderPanel();
        await openDialog();
        await screen.findByText("Getting started with Genos");
        fireEvent.click(screen.getByRole("button", { name: "Remove sample data" }));

        await screen.findByText("Sample data removed");
        expect(remove).toHaveBeenCalledWith("token-1", TEAM);
        // `refreshChannels` evicts what the server dropped; `listChannels` only returns the list.
        expect(refreshChannels).toHaveBeenCalledTimes(1);
        expect(listChannels).not.toHaveBeenCalled();
        expect(screen.getByText(/5 items were removed/)).toBeTruthy();
        expect(screen.getByText(/1 item stays/)).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Reload" }));
        expect(assign).toHaveBeenCalledWith("/workspace");
    });

    it("names what could not be removed", async () => {
        remove.mockResolvedValue(
            result({
                complete: false,
                failed: [
                    {
                        type: "project",
                        id: "1",
                        name: "Getting started with Genos",
                        reason: "RuntimeError",
                    },
                ],
            })
        );
        renderPanel();
        await openDialog();
        await screen.findByText("Getting started with Genos");
        fireEvent.click(screen.getByRole("button", { name: "Remove sample data" }));
        await screen.findByText(/could not be removed: Getting started with Genos/);
    });

    it("shows the server's reason and stays open when the removal fails", async () => {
        remove.mockRejectedValue(new Error("Only the team owner can remove the sample data."));
        renderPanel();
        await openDialog();
        await screen.findByText("Getting started with Genos");
        fireEvent.click(screen.getByRole("button", { name: "Remove sample data" }));
        await screen.findByText("Only the team owner can remove the sample data.");
        expect(screen.getByText("Remove the sample data?")).toBeTruthy();
        expect(refreshChannels).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
    });

    it("shows a failed preview with a way to try again, and offers no removal meanwhile", async () => {
        loadPreview.mockRejectedValueOnce(
            new Error("Couldn't check the sample data. Please try again.")
        );
        renderPanel();
        await openDialog();
        await screen.findByText("Couldn't check the sample data. Please try again.");
        expect(
            screen.getByRole("button", { name: "Remove sample data" }).hasAttribute("disabled")
        ).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await screen.findByText("Getting started with Genos");
        expect(loadPreview).toHaveBeenCalledTimes(2);
    });

    it("says so when the team has no recorded sample data", async () => {
        loadPreview.mockResolvedValue(
            preview({
                recorded: false,
                nothingToRemove: true,
                remove: [],
                keep: [],
                counts: {},
                contents: {},
            })
        );
        renderPanel();
        await openDialog();
        await screen.findByText(/no recorded sample data/i);
        expect(screen.getByText(/one at a time/i)).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Remove sample data" }).hasAttribute("disabled")
        ).toBe(true);
    });

    it("says so when nothing is left to remove, and still shows what stays", async () => {
        loadPreview.mockResolvedValue(
            preview({ nothingToRemove: true, remove: [], counts: {}, contents: {} })
        );
        renderPanel();
        await openDialog();
        await screen.findByText(/There is nothing to remove/);
        expect(screen.getByText("Sample dept: Hiring plan (private)")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Remove sample data" }).hasAttribute("disabled")
        ).toBe(true);
    });
});

describe("the team profile", () => {
    const source = readFileSync(
        resolve(__dirname, "../features/admin/components/modals/ModalTeamProfile.tsx"),
        "utf8"
    );

    it("hands the panel the owner flag, never a manager flag", () => {
        expect(source).toMatch(
            /<SampleDataPanel[\s\S]{0,200}isOwner=\{isTeamOwner && !teamProfile\.isGuest\}/
        );
        expect(source).not.toMatch(/<SampleDataPanel[\s\S]{0,200}canManage/);
    });
});

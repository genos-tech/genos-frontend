// The folder field of the milestone create form / preview (MIP-847).

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MilestoneFolderPicker } from "../features/tasks/sprint-milestone/components/MilestoneFolderPicker";
import type { MilestoneFolder } from "../features/tasks/sprint-milestone/types";

const folder = (folderId: number, name: string, sortOrder = folderId): MilestoneFolder => ({
    folderId,
    projectId: 1,
    name,
    sortOrder,
    tsCreatedAt: "",
    tsUpdatedAt: "",
});

const setup = (opts: {
    folderId: number | null;
    projectFolders: Record<number, MilestoneFolder[]>;
    projectId?: number;
}) => {
    const onChangeFolder = vi.fn();
    const loadFoldersForProject = vi.fn().mockResolvedValue([]);
    const useSM = { projectFolders: opts.projectFolders, loadFoldersForProject };
    render(
        <CssVarsProvider>
            <MilestoneFolderPicker
                folderId={opts.folderId}
                projectId={opts.projectId ?? 1}
                useSM={useSM as never}
                onChangeFolder={onChangeFolder}
            />
        </CssVarsProvider>
    );
    return { onChangeFolder, loadFoldersForProject };
};

beforeEach(() => vi.clearAllMocks());

describe("MilestoneFolderPicker", () => {
    it("shows the current folder", () => {
        setup({ folderId: 2, projectFolders: { 1: [folder(1, "Launch"), folder(2, "Growth")] } });
        expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Growth");
    });

    it("shows No folder when unfiled", () => {
        setup({ folderId: null, projectFolders: { 1: [folder(1, "Launch")] } });
        expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("No folder");
    });

    it("reads a folder this project does not have as No folder", () => {
        setup({ folderId: 99, projectFolders: { 1: [folder(1, "Launch")] } });
        expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("No folder");
    });

    it("offers No folder first, then the folders in saved order, and reports the pick", async () => {
        const { onChangeFolder } = setup({
            folderId: null,
            projectFolders: { 1: [folder(2, "B", 2), folder(1, "A", 1)] },
        });
        fireEvent.mouseDown(screen.getByRole("combobox"));
        const options = await screen.findAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual(["No folder", "A", "B"]);
        fireEvent.click(options[2]);
        expect(onChangeFolder).toHaveBeenCalledWith(2);
    });

    it("can clear back to No folder", async () => {
        const { onChangeFolder } = setup({
            folderId: 1,
            projectFolders: { 1: [folder(1, "A")] },
        });
        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.click((await screen.findAllByRole("option"))[0]);
        expect(onChangeFolder).toHaveBeenCalledWith(null);
    });

    it("loads the project's folders once when it has none yet", () => {
        const { loadFoldersForProject } = setup({ folderId: null, projectFolders: {} });
        expect(loadFoldersForProject).toHaveBeenCalledTimes(1);
        expect(loadFoldersForProject).toHaveBeenCalledWith(1);
    });

    it("does not reload folders it already has", () => {
        const { loadFoldersForProject } = setup({ folderId: null, projectFolders: { 1: [] } });
        expect(loadFoldersForProject).not.toHaveBeenCalled();
    });
});

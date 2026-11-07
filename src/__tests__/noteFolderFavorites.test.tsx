/**
 * MIP-747 part 2: star a note folder, find it in Favorites, jump to it.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NAV_KEEP_CLASS } from "../components/ui/nav/navStyles";
import { FavoriteFolderItem } from "../features/notes/common/components/FavoriteFolderItem";
import { FolderFavoriteStar } from "../features/notes/common/components/FolderFavoriteStar";
import { folderChain } from "../features/notes/common/utils/folderChain";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";

const nm = (favorited: number[] = []) =>
    ({
        isFolderFavorited: (id: number) => favorited.includes(id),
        toggleFolderFavorite: vi.fn(async () => {}),
        revealFolder: vi.fn(),
    }) as unknown as NoteManagementState;

describe("folder favorite star", () => {
    it("stars and unstars without opening the folder", () => {
        const useNM = nm();
        const rowClick = vi.fn();
        render(
            <div onClick={rowClick}>
                <FolderFavoriteStar folderId={7} useNM={useNM} />
            </div>
        );
        fireEvent.click(screen.getByTestId("folder-favorite-7"));
        expect(useNM.toggleFolderFavorite).toHaveBeenCalledWith(7);
        expect(rowClick).not.toHaveBeenCalled();
    });

    it("stays visible once starred (opts out of the row's action fade), fades otherwise", () => {
        const { rerender } = render(<FolderFavoriteStar folderId={7} useNM={nm()} />);
        expect(screen.getByTestId("folder-favorite-7").className).not.toContain(NAV_KEEP_CLASS);
        rerender(<FolderFavoriteStar folderId={7} useNM={nm([7])} />);
        expect(screen.getByTestId("folder-favorite-7").className).toContain(NAV_KEEP_CLASS);
    });
});

describe("favorite folder row", () => {
    it.each([
        ["personal", "my"],
        ["team", "team"],
    ] as const)("a %s folder jumps to the %s tree", (scope, space) => {
        const useNM = nm([3]);
        render(
            <FavoriteFolderItem
                spaceLabel="Team Notes"
                useNM={useNM}
                folder={{
                    folderId: 3,
                    name: "Specs",
                    scope,
                    parentFolderId: 1,
                    isExternal: false,
                }}
            />
        );
        fireEvent.click(screen.getByTestId("favorite-folder-3"));
        expect(useNM.revealFolder).toHaveBeenCalledWith(3, space);
    });
});

describe("folderChain", () => {
    const folders = [
        { folderId: 1, parentFolderId: null },
        { folderId: 2, parentFolderId: 1 },
        { folderId: 3, parentFolderId: 2 },
    ];
    it("lists the folder and its ancestors", () => {
        expect(folderChain(3, folders)).toEqual([3, 2, 1]);
        expect(folderChain(9, folders)).toEqual([9]);
    });
    it("survives a parent loop", () => {
        expect(
            folderChain(1, [
                { folderId: 1, parentFolderId: 2 },
                { folderId: 2, parentFolderId: 1 },
            ])
        ).toEqual([1, 2]);
    });
});

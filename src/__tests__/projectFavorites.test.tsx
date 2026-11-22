/**
 * Starred projects in the Tasks sidebar (MIP-1695).
 *
 * Pinned here:
 *  - `readFavoriteProjectIds` keeps only finite, de-duplicated numbers.
 *  - `partitionFavoriteProjects` pins starred joined projects above the
 *    groups, sorted by name, and never returns a starred id the person has
 *    left (it is not in the joined list).
 *  - `useFavoriteProjects` persists a flat id list under
 *    `favoriteProjectIds` in the cross-device store, and deletes the key when
 *    the last star is removed.
 */

import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/authState";
import { partitionFavoriteProjects } from "../features/tasks/components/sidebar/projectSidebarOrder";
import { readFavoriteProjectIds, useFavoriteProjects } from "../hooks/common/useFavoriteProjects";
import { UiSettingsProvider } from "../hooks/common/useUiSettings";
import { authApi } from "../services/api";
import type { ProjectProps } from "../types/tasks";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

vi.mock("../context/authState", () => ({
    useAuth: vi.fn(),
}));

const project = (projectId: number, projectName: string): ProjectProps =>
    ({ projectId, projectName, projectTags: [], projectLabels: [] }) as ProjectProps;

describe("readFavoriteProjectIds", () => {
    it("returns [] for anything that is not an array", () => {
        expect(readFavoriteProjectIds(undefined)).toEqual([]);
        expect(readFavoriteProjectIds(null)).toEqual([]);
        expect(readFavoriteProjectIds({ 1: true })).toEqual([]);
        expect(readFavoriteProjectIds("1,2")).toEqual([]);
    });

    it("drops non-numbers and duplicates, keeps order", () => {
        expect(readFavoriteProjectIds([3, "4", 1, 3, NaN, null, 2, Infinity])).toEqual([3, 1, 2]);
    });
});

describe("partitionFavoriteProjects", () => {
    const joined = [
        project(1, "Web"),
        project(2, "Finance"),
        project(3, "Mobile"),
        project(4, "Ops"),
    ];

    it("pins starred projects first, sorted by name, and leaves the rest in order", () => {
        const { favorites, rest } = partitionFavoriteProjects(joined, new Set([1, 3]));
        expect(favorites.map((p) => p.projectName)).toEqual(["Mobile", "Web"]);
        expect(rest.map((p) => p.projectName)).toEqual(["Finance", "Ops"]);
    });

    it("never returns a starred project the person has left", () => {
        // Project 99 was starred, then the person left it: it is not in the
        // joined list, so it must not reappear as a row.
        const { favorites, rest } = partitionFavoriteProjects(joined, new Set([99, 2]));
        expect(favorites.map((p) => p.projectId)).toEqual([2]);
        expect([...favorites, ...rest].map((p) => p.projectId)).not.toContain(99);
    });

    it("returns everything in rest when nothing is starred", () => {
        const { favorites, rest } = partitionFavoriteProjects(joined, new Set());
        expect(favorites).toEqual([]);
        expect(rest).toEqual(joined);
    });
});

describe("useFavoriteProjects", () => {
    let patch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        patch = vi.fn().mockResolvedValue({ data: { ui_settings: {} } });
        const get = vi.fn().mockResolvedValue({ data: { ui_settings: {} } });
        (authApi as ReturnType<typeof vi.fn>).mockImplementation((token: unknown) =>
            token ? { get, patch } : null
        );
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ accessToken: "t" });
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <UiSettingsProvider>{children}</UiSettingsProvider>
    );

    it("stars and unstars, persisting the flat id list under favoriteProjectIds", () => {
        const { result } = renderHook(() => useFavoriteProjects(), { wrapper });
        expect(result.current.ids).toEqual([]);

        act(() => result.current.setFavorite(7, true));
        act(() => result.current.setFavorite(9, true));
        expect(result.current.ids).toEqual([7, 9]);
        expect(result.current.idSet.has(7)).toBe(true);
        expect(patch).toHaveBeenLastCalledWith("/user/preferences/ui-settings/", {
            favoriteProjectIds: [7, 9],
        });

        act(() => result.current.setFavorite(7, false));
        expect(result.current.ids).toEqual([9]);
        expect(patch).toHaveBeenLastCalledWith("/user/preferences/ui-settings/", {
            favoriteProjectIds: [9],
        });
    });

    it("deletes the key when the last star is removed", () => {
        const { result } = renderHook(() => useFavoriteProjects(), { wrapper });
        act(() => result.current.setFavorite(7, true));
        act(() => result.current.setFavorite(7, false));
        expect(result.current.ids).toEqual([]);
        expect(patch).toHaveBeenLastCalledWith("/user/preferences/ui-settings/", {
            favoriteProjectIds: null,
        });
    });

    it("is a no-op when the state already matches", () => {
        const { result } = renderHook(() => useFavoriteProjects(), { wrapper });
        act(() => result.current.setFavorite(7, true));
        patch.mockClear();
        act(() => result.current.setFavorite(7, true));
        expect(patch).not.toHaveBeenCalled();
    });
});

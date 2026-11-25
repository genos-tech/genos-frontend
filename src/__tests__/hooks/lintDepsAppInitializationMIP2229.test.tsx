import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppInitialization } from "../../hooks/common/useAppInitialization";
import type { UserProps } from "../../types/admin";

// MIP-2229 (exhaustive-deps): the team-switch effect in useAppInitialization
// runs on a `myself` change only, and reads the managers of that render.

const h = vi.hoisted(() => ({
    useMyself: vi.fn(),
    teamManager: vi.fn(),
    uiManager: vi.fn(),
    clearTeamScopedStores: vi.fn(),
}));

vi.mock("../../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../../hooks/common/useAuth", () => ({ useMyself: h.useMyself }));
vi.mock("../../hooks/common/useMentionGroups", () => ({ useMentionGroups: () => ({}) }));
vi.mock("../../hooks/common/useTeamEmoji", () => ({ useTeamEmoji: () => ({}) }));
vi.mock("../../hooks/common/useTeamManagement", () => ({ useTeamManagement: h.teamManager }));
vi.mock("../../hooks/common/useUIStateManagement", () => ({ useUIStateManagement: h.uiManager }));
vi.mock("../../db/config/schema", () => ({ initDB: vi.fn() }));
vi.mock("../../db/utils/database", () => ({
    DatabaseUtils: { clearTeamScopedStores: h.clearTeamScopedStores },
}));
vi.mock("../../services/hydrationState", () => ({ clearTeamHydrated: vi.fn() }));
vi.mock("../../services/syncStatus", () => ({ syncStatus: { reset: vi.fn() } }));

const user = (teamId: string) => ({ userId: "u1", teamId }) as UserProps;

describe("useAppInitialization team-switch effect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.clearTeamScopedStores.mockResolvedValue(undefined);
    });

    it("runs once per myself, and uses the managers of the render that changed it", async () => {
        // A new manager object every render, as the real hooks return.
        const uisms: { setIsLoading: ReturnType<typeof vi.fn> }[] = [];
        h.uiManager.mockImplementation(() => {
            const m = { setIsLoading: vi.fn() };
            uisms.push(m);
            return m;
        });
        h.teamManager.mockImplementation(() => ({
            currentTeamId: "",
            setCurrentTeamId: vi.fn(),
        }));
        const me1 = user("t1");
        h.useMyself.mockReturnValue({ myself: me1, setMyself: vi.fn() });

        const { rerender } = renderHook(() => useAppInitialization());
        const calls = () => uisms.reduce((n, m) => n + m.setIsLoading.mock.calls.length, 0);
        expect(calls()).toBe(1);

        rerender();
        rerender();
        expect(calls()).toBe(1);

        h.useMyself.mockReturnValue({ myself: user("t2"), setMyself: vi.fn() });
        rerender();
        await waitFor(() => expect(calls()).toBe(2));
        // The call came from the latest render's manager, not the first one.
        expect(uisms[uisms.length - 1].setIsLoading).toHaveBeenCalledTimes(1);
    });
});

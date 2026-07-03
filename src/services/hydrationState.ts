// Single-key marker recording which team's data is currently hydrated in
// IndexedDB. IDB holds one team's team-scoped stores at a time — they're
// wiped on a team switch (see `useAppInitialization` →
// `DatabaseUtils.clearTeamScopedStores`) — so one key holding the hydrated
// team id is enough to answer "is the local cache warm for this team?".
//
// Used by the boot gate (`loadInitialData`): a WARM cache renders the shell
// from IDB immediately and refreshes from the network in the background; a
// COLD/cleared cache (first-ever login, or just after a team switch) holds
// the spinner until the first background refresh lands, so the user never
// sees an empty shell flash.

const HYDRATED_TEAM_KEY = "genos.hydrated.v1";

// True once this team's data has been successfully hydrated into IDB at
// least once and hasn't been wiped since.
export const isTeamHydrated = (teamId: string): boolean =>
    !!teamId && localStorage.getItem(HYDRATED_TEAM_KEY) === teamId;

export const markTeamHydrated = (teamId: string): void => {
    if (teamId) localStorage.setItem(HYDRATED_TEAM_KEY, teamId);
};

// Called when the team-scoped IDB stores are wiped (team switch) so the
// next boot for that team is treated as cold.
export const clearTeamHydrated = (): void => {
    localStorage.removeItem(HYDRATED_TEAM_KEY);
};

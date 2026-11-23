/**
 * The team the person is working in, as the rest of the app reads it (`localStorage.teamId`).
 *
 * The GitHub App is linked per team (MIP-2090): the connect call names the team the installation
 * goes into, and the Connections list asks which installations THAT team has. Both read it here,
 * so the cards on one screen never disagree. Null when nothing is stored (or storage is blocked):
 * the server then falls back to the person's only team.
 */
export const activeTeamId = (): string | null => {
    try {
        return localStorage.getItem("teamId") || null;
    } catch {
        return null;
    }
};

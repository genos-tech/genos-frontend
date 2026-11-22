// The `team_email` the app sends when it creates a team (MIP-1834).
//
// The API needs an address (the field is required and must pass Django's EmailField), but
// nobody types one: the team name is not an address. Building it from the raw name broke for
// any space, Japanese character or symbol. So the address is a readable ASCII slug of the name
// plus a short random suffix:
//   "Docs Walk Lab" -> docs-walk-lab-x7k2qp@teams.genosai.dev
//   "営業部"         -> team-x7k2qp@teams.genosai.dev          (no ASCII in the name)
// The suffix keeps names that slug to the same text ("Acme" and "acme") from colliding on the
// API's unique address. Display-only in the app (join-team lists); nothing reads it as a name.

const DOMAIN = "teams.genosai.dev";
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;
const SLUG_MAX = 40;

const randomSuffix = (): string => {
    const bytes = new Uint8Array(SUFFIX_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => SUFFIX_CHARS[b % SUFFIX_CHARS.length]).join("");
};

export const teamSlug = (teamName: string): string =>
    teamName
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, SLUG_MAX)
        .replace(/-+$/g, "");

export const teamEmailFor = (teamName: string, suffix: string = randomSuffix()): string => {
    const slug = teamSlug(teamName) || "team";
    return `${slug}-${suffix}@${DOMAIN}`;
};

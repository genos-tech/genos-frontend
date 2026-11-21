import entriesJson from "./entries.json";

/**
 * The dated changelog entries (MIP-1257), newest first. Data lives in
 * `entries.json` so the page and the build-time RSS generator read one source.
 * `prs` names the merged PRs each entry is tied to; the PR body carries the
 * same list.
 */

export interface ChangelogLangText {
    title: string;
    body: string;
}

export interface ChangelogEntry {
    id: string;
    /** `YYYY-MM-DD`: the day the change was merged and went live. */
    date: string;
    /** Merged PRs, as `<repo>#<number>`. */
    prs: string[];
    en: ChangelogLangText;
    ja: ChangelogLangText;
    /** Internal note for Ken on the copy. Never rendered. */
    todo?: string;
}

export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = entriesJson as ChangelogEntry[];

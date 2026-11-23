/**
 * Genos Skills over REST (MIP-2041; genos-api `views/common/skill_views.py`, MIP-2040):
 *
 *   GET    /skills/?team_id=&tab=mine|team      the list of one tab (+ plan limit and count)
 *   POST   /skills/                             create one (`team_id` in the body)
 *   GET    /skills/<id>/                        one skill with its text
 *   PATCH  /skills/<id>/                        save the owner's draft (readers keep the published version)
 *   DELETE /skills/<id>/                        delete it with its body note (the owner)
 *   POST   /skills/<id>/publish/                cut a new version from the draft (readers get it)
 *   GET    /skills/<id>/versions/               the versions
 *   POST   /skills/<id>/editors/ {userId}       invite a teammate to edit (the owner); DELETE
 *                                               /skills/<id>/editors/<user>/ removes one (or leaves)
 *   POST   /skills/<id>/hide/                   the team owner hides a team skill; DELETE shows it
 *   POST   /skills/<id>/report/                 report a skill the member can read (MIP-2044)
 *   GET    /skills/hub/?q=&tag=&sort=&offset=   the public directory (MIP-2047; 404 until the server's
 *                                               `GENOS_SKILLS_PUBLIC` switch is on)
 *   GET    /skills/hub/tags/                    the directory's tags with counts
 *   POST   /skills/<id>/star/                   star a skill (DELETE removes the star)
 *   GET    /skills/<id>/publish-check/          the publish checklist, ticked off (the owner)
 *   GET    /skills/profile/ , PUT               my public handle (chosen once) and display name
 *
 * The whole API answers 404 while the server's `GENOS_SKILLS` switch is off: the list call then
 * resolves `{ ok: false, reason: "off" }` and the settings card is not drawn at all.
 *
 * Every body is read as untrusted: a string is a string or "", a count a plain integer or 0, an
 * unknown shape is dropped. Refusals are values, not throws; the server's sentence (`error`) is
 * kept as `message` and shown as written, because it names the field and the limit.
 */

import { authApi } from "../../../services/api";

/** "specific" = shared with the people and groups the owner chose (MIP-2212). */
export type SkillVisibility = "private" | "team" | "specific";
export type ToolLevel = "read" | "act";
export type SkillEffort = "" | "low" | "medium" | "high";
export type SkillTab = "mine" | "team";

/** The order of the directory: most starred, most recently published, most used (distinct runners
 *  in 30 days). */
export type HubSort = "stars" | "recent" | "uses";

/** The limits the server enforces, so the form can count and stop before it asks. */
export const SKILL_LIMITS = {
    slugMin: 2,
    slugMax: 40,
    titleMax: 120,
    descriptionMax: 280,
    tagsMax: 5,
    tagMax: 24,
    argumentHintMax: 120,
    bodyMax: 12_000,
    sharesMax: 50,
} as const;

export type SkillRole = "owner" | "editor" | "reader";

export type SkillPerson = { id: string; username: string };

/** One chosen reader of a "specific" skill: a person, or a LIVE link to a mention group, a group
 *  chat or a project (who is in it is asked every time the skill is read or run). */
export type SkillShareKind = "user" | "mentionGroup" | "groupChat" | "project";
export type SkillShare = {
    kind: SkillShareKind;
    /** A user id or chat id (text), or a mention group or project id as text. */
    id: string;
    /** "" when the owner can no longer see it (a chat they left): `available` is false then. */
    name: string;
    /** People in the group now; null for a person. */
    memberCount: number | null;
    available: boolean;
};
export const SHARE_KINDS: readonly SkillShareKind[] = [
    "user",
    "mentionGroup",
    "groupChat",
    "project",
];
/** What a save sends: only the identity of each share (the server re-checks every new one). */
export type SkillShareInput = { kind: SkillShareKind; id: string };

/** The public byline of a public skill: the author's chosen handle, never the account name. */
export type SkillAuthor = { handle: string; displayName: string };

/** Where a copy came from. `available: false` = the original is private or gone for this
 *  reader: the server names nothing then, and neither does the page. */
export type SkillOrigin = {
    available: boolean;
    id: string;
    title: string;
    ownerName: string;
    /** The original's public handle when it is a public skill (MIP-2047). */
    author: SkillAuthor | null;
    versionNo: number;
};

/** A tag as a chip on a skill. */
export type SkillTagChip = { name: string; color: string; textColor: string };

/** One tag of a member's catalog (MIP-2211): picked in the editor, managed in Manage tags. */
export type SkillTag = SkillTagChip & { tagId: number };

export type SkillTagCatalog = {
    tags: SkillTag[];
    /** Only the skill's owner changes the catalog; a co-editor picks from it. */
    editable: boolean;
};

export type SkillRow = {
    id: string;
    teamId: string;
    slug: string;
    title: string;
    description: string;
    tags: string[];
    /** The tags as chips (MIP-2211): the colour the owner gave each name. Grey for a name the owner
     *  no longer has, and for every tag of a public skill read by anyone but its owner or an editor.
     *  Absent from a server that predates the catalog: draw `tags` in grey then. */
    tagChips?: SkillTagChip[];
    icon: string;
    argumentHint: string;
    toolLevel: ToolLevel;
    effort: SkillEffort;
    /** "public" is read as such, but this page never sets it. */
    visibility: SkillVisibility | "public";
    status: string;
    /** An operator's sentence about a held, hidden or taken-down skill; the owner's own rows only. */
    moderationReason: string;
    currentVersionNo: number;
    publishedVersionNo: number;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
    mine: boolean;
    /** What this member is on the skill (MIP-2043): its owner, a co-editor the owner invited, or a
     *  reader (a teammate who can run it, or the team owner looking at it). */
    role: SkillRole;
    /** Owner or co-editor: may change the text and details and publish. */
    canEdit: boolean;
    /** Owner only: rename, change who can use it, delete, choose the editors. */
    canManage: boolean;
    /** The team owner, on a team skill someone else wrote: may hide it from the team. */
    canHide: boolean;
    /** The team owner hid it: teammates cannot see or run it. */
    hiddenByTeam: boolean;
    /** A teammate's account name; empty for a skill the server does not name. */
    ownerName: string;
    /** A PUBLIC skill's byline (MIP-2047); null while its author has no handle (an official skill). */
    author: SkillAuthor | null;
    /** The Hub's numbers. `starCount` counts stars from aged, verified accounts only. */
    starCount: number;
    /** Distinct accounts that ran it in the last 30 days. */
    runCount30d: number;
    copyCount: number;
    isOfficial: boolean;
    /** Whether this member starred it (the directory and the detail answer; false elsewhere). */
    starred: boolean;
    /** Detail answer only, for the owner and the co-editors: who edits it with the owner. */
    editors: SkillPerson[];
    /** Detail and save answer, the owner only: who a "specific" skill is shared with. */
    shares: SkillShare[];
    /** Detail answer only, on a copy: where it came from (null = not a copy). */
    forkedFrom: SkillOrigin | null;
    /** The body note, sent to the owner only. */
    noteId: number | null;
    /** The owner's detail answer only (MIP-2177): the draft differs from the published version a
     *  team skill's readers get. `unpublishedChanges` names what differs (the keys a PATCH
     *  takes; the text is `bodyMarkdown`). Always false / empty elsewhere. */
    hasUnpublishedChanges: boolean;
    unpublishedChanges: string[];
    /** Present on the detail answer only. */
    bodyMarkdown?: string;
};

export type SkillList = {
    skills: SkillRow[];
    /** The plan's count of skills (null = unlimited) and how many this member owns. */
    limit: number | null;
    used: number;
    /** The server's `GENOS_SKILLS_PUBLIC` switch: the Hub tab and "Publish to the Hub" exist only
     *  while it is on. */
    publicEnabled: boolean;
};

/** One page of the directory. */
export type HubPage = { skills: SkillRow[]; hasMore: boolean };

export type HubTag = { tag: string; count: number };

/** One row of the publish checklist; `text` is the server's own words. */
export type PublishCheck = { key: string; ok: boolean; text: string };

export type PublicProfile = {
    handle: string | null;
    displayName: string;
    publicSkills: number;
    limits: { publishesPerDay: number; publicSkillsMax: number; starsPerDay: number };
};

export type PublishCheckResult = {
    checks: PublishCheck[];
    ready: boolean;
    profile: PublicProfile;
};

/** What making a skill public carries besides the visibility itself. */
export type PublishPublicInput = {
    acceptTerms: boolean;
    /** Only while the author has no public handle yet. */
    handle?: string;
    displayName?: string;
};

export type SkillVersion = {
    versionNo: number;
    title: string;
    changelog: string;
    createdAt: string | null;
};

/** The fields a create or a change may carry (camelCase, as on the wire). */
export type SkillInput = {
    title?: string;
    slug?: string;
    description?: string;
    tags?: string[];
    icon?: string;
    argumentHint?: string;
    toolLevel?: ToolLevel;
    effort?: SkillEffort;
    visibility?: SkillVisibility | "public";
    /** The whole list of who a "specific" skill is shared with (replaces the saved one). */
    shares?: SkillShareInput[];
    bodyMarkdown?: string;
    acceptTerms?: boolean;
    handle?: string;
    displayName?: string;
};

/** The reasons a report may give, in the order the dialog lists them (the server's own words). */
export const REPORT_REASONS = [
    "harmful",
    "spam",
    "copyright",
    "personal_data",
    "offensive",
    "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 1000;

/** The states an operator or the publish-time check puts a skill in (nobody but the owner reads it). */
export const isModerated = (status: string): boolean =>
    status === "in_review" || status === "reported_hidden" || status === "taken_down";

export type Failure = {
    ok: false;
    /** `off` = 404 (switch off or not yours), `conflict` = 409 (a name taken, or nothing new to
     *  publish), `limit` = 429 `plan_limit`, `bad_input` = 400/403 with a sentence, `error`. */
    reason: "off" | "conflict" | "limit" | "report_limit" | "bad_input" | "error";
    /** The server's own sentence, or "". */
    message: string;
    /** The server's machine code when it sent one (`name_taken`: a 400 about the name, MIP-2210). */
    code?: string;
    limit?: number;
    used?: number;
    /** A refused publish lists every problem together (400 `problems`). */
    problems?: string[];
};
export type Result<T> = { ok: true; data: T } | Failure;

const OPTIONS = { suppressErrorToast: true } as const;

// ---------- parsing ----------

const rec = (v: unknown): Record<string, unknown> | null =>
    v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;

const str = (v: unknown, limit = 20_000): string =>
    typeof v === "string" ? v.slice(0, limit) : "";

const int = (v: unknown): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000_000 ? v : 0;

const when = (v: unknown): string | null => {
    const s = str(v, 40);
    return s !== "" && !Number.isNaN(new Date(s).getTime()) ? s : null;
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const parsePeople = (raw: unknown): SkillPerson[] =>
    (Array.isArray(raw) ? raw : []).flatMap((row) => {
        const p = rec(row);
        const id = str(p?.id, 64);
        return p && id !== "" ? [{ id, username: str(p.username, 120) }] : [];
    });

const parseShares = (raw: unknown): SkillShare[] =>
    (Array.isArray(raw) ? raw : []).flatMap((row) => {
        const s = rec(row);
        const id = str(s?.id, 64);
        const kind = oneOf<SkillShareKind | "">(s?.kind, SHARE_KINDS, "");
        if (!s || id === "" || kind === "") return [];
        const count = s.memberCount;
        return [
            {
                kind,
                id,
                name: str(s.name, 255),
                memberCount: typeof count === "number" && count >= 0 ? Math.floor(count) : null,
                available: s.available === true,
            },
        ];
    });

const parseAuthor = (raw: unknown): SkillAuthor | null => {
    const a = rec(raw);
    const handle = str(a?.handle, 60);
    return a && handle !== "" ? { handle, displayName: str(a.displayName, 120) } : null;
};

const parseOrigin = (raw: unknown): SkillOrigin | null => {
    const o = rec(raw);
    if (!o) return null;
    const available = o.available === true;
    return {
        available,
        // Nothing of an original the reader cannot see is kept, even if a server sent it.
        id: available ? str(o.id, 64) : "",
        title: available ? str(o.title, 300) : "",
        ownerName: available ? str(o.ownerName, 120) : "",
        author: available ? parseAuthor(o.author) : null,
        versionNo: int(o.versionNo),
    };
};

const HEX = /^#[0-9a-fA-F]{6}$/;
// A tag with no colour of its own: the chip draws its neutral dot for an empty colour.
const NEUTRAL_TAG = "";

const parseTagChips = (raw: unknown[]): SkillTagChip[] =>
    raw.flatMap((row) => {
        const c = rec(row);
        const name = str(c?.name, 60);
        if (!c || name === "") return [];
        const color = str(c.color, 10);
        return [
            {
                name,
                color: HEX.test(color) ? color : NEUTRAL_TAG,
                textColor: str(c.textColor, 10) || "white",
            },
        ];
    });

export const parseSkillTag = (raw: unknown): SkillTag | null => {
    const r = rec(raw);
    const id = r?.tagId;
    if (!r || typeof id !== "number" || !Number.isSafeInteger(id)) return null;
    const [chip] = parseTagChips([r]);
    return chip ? { ...chip, tagId: id } : null;
};

export const parseSkillTagCatalog = (raw: unknown): SkillTagCatalog | null => {
    const r = rec(raw);
    if (!r || !Array.isArray(r.tags)) return null;
    return {
        tags: r.tags.flatMap((row) => {
            const tag = parseSkillTag(row);
            return tag ? [tag] : [];
        }),
        editable: r.editable === true,
    };
};

/** A skill's tags as chips: the server's, else every name in grey. */
export const chipsOf = (skill: Pick<SkillRow, "tags" | "tagChips">): SkillTagChip[] =>
    skill.tagChips ?? skill.tags.map((name) => ({ name, color: NEUTRAL_TAG, textColor: "white" }));

export const parseSkill = (raw: unknown): SkillRow | null => {
    const r = rec(raw);
    const id = str(r?.id, 64);
    if (!r || id === "") return null;
    const note = r.noteId;
    return {
        id,
        teamId: str(r.teamId, 64),
        slug: str(r.slug, 80),
        title: str(r.title, 300),
        description: str(r.description, 600),
        tags: (Array.isArray(r.tags) ? r.tags : [])
            .map((t) => str(t, 60))
            .filter((t) => t !== "")
            .slice(0, 10),
        tagChips: Array.isArray(r.tagChips) ? parseTagChips(r.tagChips) : undefined,
        icon: str(r.icon, 16),
        argumentHint: str(r.argumentHint, 300),
        toolLevel: oneOf(r.toolLevel, ["read", "act"] as const, "read"),
        effort: oneOf(r.effort, ["", "low", "medium", "high"] as const, ""),
        visibility: oneOf(
            r.visibility,
            ["private", "team", "specific", "public"] as const,
            "private"
        ),
        status: str(r.status, 40),
        moderationReason: str(r.moderationReason, 600),
        currentVersionNo: int(r.currentVersionNo),
        publishedVersionNo: int(r.publishedVersionNo),
        createdAt: when(r.createdAt),
        updatedAt: when(r.updatedAt),
        publishedAt: when(r.publishedAt),
        mine: r.mine === true,
        role: oneOf(
            r.role,
            ["owner", "editor", "reader"] as const,
            r.mine === true ? "owner" : "reader"
        ),
        canEdit: r.canEdit === true,
        canManage: r.canManage === true,
        canHide: r.canHide === true,
        hiddenByTeam: r.hiddenByTeam === true,
        ownerName: str(r.ownerName, 120),
        author: parseAuthor(r.author),
        starCount: int(r.starCount),
        runCount30d: int(r.runCount30d),
        copyCount: int(r.copyCount),
        isOfficial: r.isOfficial === true,
        starred: r.starred === true,
        editors: parsePeople(r.editors),
        shares: parseShares(r.shares),
        forkedFrom: parseOrigin(r.forkedFrom),
        noteId: typeof note === "number" && Number.isSafeInteger(note) && note > 0 ? note : null,
        hasUnpublishedChanges: r.hasUnpublishedChanges === true,
        unpublishedChanges: (Array.isArray(r.unpublishedChanges) ? r.unpublishedChanges : [])
            .map((k) => str(k, 40))
            .filter((k) => k !== "")
            .slice(0, 20),
        bodyMarkdown: typeof r.bodyMarkdown === "string" ? r.bodyMarkdown : undefined,
    };
};

export const parseSkillList = (raw: unknown): SkillList | null => {
    const r = rec(raw);
    if (!r || !Array.isArray(r.skills)) return null;
    const limit = typeof r.limit === "number" && r.limit >= 0 ? Math.floor(r.limit) : null;
    return {
        skills: r.skills.flatMap((row) => {
            const s = parseSkill(row);
            return s ? [s] : [];
        }),
        limit,
        used: int(r.used),
        publicEnabled: r.publicEnabled === true,
    };
};

const parseRows = (raw: unknown): SkillRow[] =>
    (Array.isArray(raw) ? raw : []).flatMap((row) => {
        const s = parseSkill(row);
        return s ? [s] : [];
    });

const parseProfile = (raw: unknown): PublicProfile => {
    const p = rec(raw);
    const limits = rec(p?.limits);
    const handle = str(p?.handle, 60);
    return {
        handle: handle === "" ? null : handle,
        displayName: str(p?.displayName, 120),
        publicSkills: int(p?.publicSkills),
        limits: {
            publishesPerDay: int(limits?.publishesPerDay),
            publicSkillsMax: int(limits?.publicSkillsMax),
            starsPerDay: int(limits?.starsPerDay),
        },
    };
};

const parseVersions = (raw: unknown): SkillVersion[] => {
    const r = rec(raw);
    if (!r || !Array.isArray(r.versions)) return [];
    return r.versions.flatMap((row) => {
        const v = rec(row);
        const versionNo = int(v?.versionNo);
        if (!v || versionNo === 0) return [];
        return [
            {
                versionNo,
                title: str(v.title, 300),
                changelog: str(v.changelog, 1000),
                createdAt: when(v.createdAt),
            },
        ];
    });
};

const failure = (error: unknown): Failure => {
    const res = (error as { response?: { status?: number; data?: unknown } })?.response;
    const body = rec(res?.data);
    const message = str(body?.error, 400);
    const code = str(body?.code, 40);
    const base = { ok: false as const, message, ...(code ? { code } : {}) };
    if (res?.status === 404) return { ...base, reason: "off" };
    if (res?.status === 409) return { ...base, reason: "conflict" };
    if (res?.status === 429 && body?.code === "plan_limit") {
        return { ...base, reason: "limit", limit: int(body.limit), used: int(body.used) };
    }
    if (res?.status === 429 && body?.code === "report_limit")
        return { ...base, reason: "report_limit" };
    if (res?.status === 400 || res?.status === 403 || res?.status === 429) {
        // The publish and star limits (429) and a refused publish (400 with every `problems`
        // sentence) are the server's own words, shown as written.
        const problems = (Array.isArray(body?.problems) ? body.problems : [])
            .map((p) => str(p, 300))
            .filter((p) => p !== "")
            .slice(0, 12);
        return { ...base, reason: "bad_input", ...(problems.length ? { problems } : {}) };
    }
    return { ...base, reason: "error" };
};

// ---------- requests ----------

const NO_API: Failure = { ok: false, reason: "error", message: "" };

/** A skill the `/` menu offers (`GET /skills/?tab=runnable`): metadata only, never the text. */
export type RunnableSkill = {
    id: string;
    slug: string;
    title: string;
    description: string;
    /** Resolution order of a typed name: mine, then team, then installed, then official. */
    group: "mine" | "team" | "installed" | "official";
    /** A teammate's account name (team and own skills); "" otherwise. */
    ownerName: string;
    /** The version a schedule would run (MIP-2045); 0 = none (a skill never published), so it
     *  cannot be scheduled. A server that predates it sends none: read as 0. */
    publishedVersionNo: number;
};

export const parseRunnableSkills = (raw: unknown): RunnableSkill[] | null => {
    const r = rec(raw);
    if (!r || !Array.isArray(r.skills)) return null;
    return r.skills.flatMap((row) => {
        const s = rec(row);
        const id = str(s?.id, 64);
        const slug = str(s?.slug, 80);
        if (!s || id === "" || slug === "") return [];
        return [
            {
                id,
                slug,
                title: str(s.title, 300),
                description: str(s.description, 600),
                group: oneOf(s.group, ["mine", "team", "installed", "official"] as const, "mine"),
                ownerName: str(s.ownerName, 120),
                publishedVersionNo: int(s.publishedVersionNo),
            },
        ];
    });
};

/** What this member may run from the `/` menu in this team. `{ ok: false, reason: "off" }` (the
 *  server's 404) while Skills is switched off: the menu then does not exist at all. */
export const fetchRunnableSkills = async (
    accessToken: string | null,
    teamId: string
): Promise<Result<RunnableSkill[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get("/skills/", {
            ...OPTIONS,
            params: { team_id: teamId, tab: "runnable" },
        });
        const data = parseRunnableSkills(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

/** The answer to "is this name free where the skill is shared?" (MIP-2210). `slug` is the name as
 *  the server reads it (trimmed, lower case); `message` is the sentence to show when it is not free. */
export type NameCheck = { slug: string; available: boolean; message: string };

export const fetchNameCheck = async (
    accessToken: string | null,
    q: {
        teamId: string;
        slug: string;
        visibility: "private" | "team" | "specific" | "public";
        skillId?: string;
    }
): Promise<Result<NameCheck>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get("/skills/name-check/", {
            ...OPTIONS,
            params: {
                team_id: q.teamId,
                slug: q.slug,
                visibility: q.visibility,
                ...(q.skillId ? { skill_id: q.skillId } : {}),
            },
        });
        const body = rec(res.data);
        if (!body || typeof body.available !== "boolean") return NO_API;
        return {
            ok: true,
            data: {
                slug: str(body.slug, 80),
                available: body.available,
                message: str(body.message, 400),
            },
        };
    } catch (error) {
        return failure(error);
    }
};

/** One effort level as this member's plan sees it (MIP-2198). `relativeCost` is a guide next to the
 *  choice, 1 = what a Low run costs; null when the server has no rate for the level's model. */
export type EffortLevelRow = {
    level: Exclude<SkillEffort, "">;
    relativeCost: number | null;
    /** Above the member's plan: the run uses the plan's top level instead. */
    locked: boolean;
};

export const parseEffortLevels = (raw: unknown): EffortLevelRow[] | null => {
    const r = rec(raw);
    if (!r) return null;
    if (r.enabled !== true || !Array.isArray(r.levels)) return [];
    return r.levels.flatMap((row) => {
        const s = rec(row);
        if (!s || (s.level !== "low" && s.level !== "medium" && s.level !== "high")) return [];
        const cost =
            typeof s.relativeCost === "number" && s.relativeCost > 0 ? s.relativeCost : null;
        return [{ level: s.level, relativeCost: cost, locked: s.locked === true }];
    });
};

/** The effort levels and what each costs next to the others, for the editor's choice. `[]` while
 *  the server's agent is not on effort levels (a skill's level changes nothing then). */
export const fetchEffortLevels = async (
    accessToken: string | null
): Promise<Result<EffortLevelRow[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get("/skills/effort-levels/", OPTIONS);
        const data = parseEffortLevels(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const fetchSkills = async (
    accessToken: string | null,
    teamId: string,
    tab: SkillTab
): Promise<Result<SkillList>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get("/skills/", { ...OPTIONS, params: { team_id: teamId, tab } });
        const data = parseSkillList(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const fetchSkill = async (
    accessToken: string | null,
    skillId: string
): Promise<Result<SkillRow>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get(`/skills/${encodeURIComponent(skillId)}/`, OPTIONS);
        const data = parseSkill(rec(res.data)?.skill);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const createSkill = async (
    accessToken: string | null,
    teamId: string,
    input: SkillInput
): Promise<Result<SkillRow>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post("/skills/", { team_id: teamId, ...input }, OPTIONS);
        const data = parseSkill(rec(res.data)?.skill);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const updateSkill = async (
    accessToken: string | null,
    skillId: string,
    input: SkillInput
): Promise<Result<SkillRow>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.patch(`/skills/${encodeURIComponent(skillId)}/`, input, OPTIONS);
        const data = parseSkill(rec(res.data)?.skill);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

/** The tag catalog a skill's tags come from: its owner's. Without a skill id, the caller's own in a
 *  team. */
export const fetchSkillTags = async (
    accessToken: string | null,
    scope: { skillId: string } | { teamId: string }
): Promise<Result<SkillTagCatalog>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const params =
            "skillId" in scope ? { skill_id: scope.skillId } : { team_id: scope.teamId };
        const res = await api.get("/skills/tags/", { ...OPTIONS, params });
        const data = parseSkillTagCatalog(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const createSkillTag = async (
    accessToken: string | null,
    teamId: string,
    input: { name: string; color?: string; textColor?: string }
): Promise<Result<SkillTag>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post("/skills/tags/", { team_id: teamId, ...input }, OPTIONS);
        const data = parseSkillTag(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const updateSkillTag = async (
    accessToken: string | null,
    tagId: number,
    patch: { name?: string; color?: string; textColor?: string }
): Promise<Result<SkillTag>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.patch(`/skills/tags/${tagId}/`, patch, OPTIONS);
        const data = parseSkillTag(res.data);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const deleteSkillTag = async (
    accessToken: string | null,
    tagId: number
): Promise<Result<null>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        await api.delete(`/skills/tags/${tagId}/`, OPTIONS);
        return { ok: true, data: null };
    } catch (error) {
        return failure(error);
    }
};

/** Copy a skill the member can read into their own (private) skills. */
export const copySkill = async (
    accessToken: string | null,
    skillId: string,
    teamId: string
): Promise<Result<SkillRow>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post(
            `/skills/${encodeURIComponent(skillId)}/copy/`,
            { team_id: teamId },
            OPTIONS
        );
        const data = parseSkill(rec(res.data)?.skill);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

export const deleteSkill = async (
    accessToken: string | null,
    skillId: string
): Promise<Result<null>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        await api.delete(`/skills/${encodeURIComponent(skillId)}/`, OPTIONS);
        return { ok: true, data: null };
    } catch (error) {
        return failure(error);
    }
};

/** Cut a new version from the live text. A 409 ("nothing changed") reads as `conflict`. */
export const publishSkill = async (
    accessToken: string | null,
    skillId: string,
    changelog = ""
): Promise<Result<{ versionNo: number }>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post(
            `/skills/${encodeURIComponent(skillId)}/publish/`,
            { changelog },
            OPTIONS
        );
        return { ok: true, data: { versionNo: int(rec(rec(res.data)?.version)?.versionNo) } };
    } catch (error) {
        return failure(error);
    }
};

export const fetchSkillVersions = async (
    accessToken: string | null,
    skillId: string
): Promise<Result<SkillVersion[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get(`/skills/${encodeURIComponent(skillId)}/versions/`, OPTIONS);
        return { ok: true, data: parseVersions(res.data) };
    } catch (error) {
        return failure(error);
    }
};

/** Invite a teammate to edit the skill (the owner). Resolves the editors as they now are. */
export const addSkillEditor = async (
    accessToken: string | null,
    skillId: string,
    userId: string
): Promise<Result<SkillPerson[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post(
            `/skills/${encodeURIComponent(skillId)}/editors/`,
            { userId },
            OPTIONS
        );
        return { ok: true, data: parsePeople(rec(res.data)?.editors) };
    } catch (error) {
        return failure(error);
    }
};

/** Take an editor away (the owner), or leave the skill (an editor removing themself). */
export const removeSkillEditor = async (
    accessToken: string | null,
    skillId: string,
    userId: string
): Promise<Result<SkillPerson[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.delete(
            `/skills/${encodeURIComponent(skillId)}/editors/${encodeURIComponent(userId)}/`,
            OPTIONS
        );
        return { ok: true, data: parsePeople(rec(res.data)?.editors) };
    } catch (error) {
        return failure(error);
    }
};

/** The team owner hides a team skill from the team (`hidden`), or shows it again. */
export const setSkillHidden = async (
    accessToken: string | null,
    skillId: string,
    hidden: boolean
): Promise<Result<SkillRow>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const url = `/skills/${encodeURIComponent(skillId)}/hide/`;
        const res = hidden ? await api.post(url, {}, OPTIONS) : await api.delete(url, OPTIONS);
        const data = parseSkill(rec(res.data)?.skill);
        return data ? { ok: true, data } : NO_API;
    } catch (error) {
        return failure(error);
    }
};

/** Report a skill the member can read, from the skill's own page or its list row. Sending the
 *  same report twice is the same report (the server answers 200 the second time). */
export const reportSkill = async (
    accessToken: string | null,
    skillId: string,
    reason: ReportReason,
    note: string
): Promise<Result<{ created: boolean }>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.post(
            `/skills/${encodeURIComponent(skillId)}/report/`,
            { reason, note: note.trim().slice(0, REPORT_NOTE_MAX) },
            OPTIONS
        );
        return { ok: true, data: { created: res.status === 201 } };
    } catch (error) {
        return failure(error);
    }
};

// ---------- the Hub (MIP-2047) ----------

export type HubQuery = {
    q?: string;
    tag?: string;
    sort?: HubSort;
    offset?: number;
    limit?: number;
};

/** One page of the public directory. `{ ok: false, reason: "off" }` while the Hub is switched off. */
export const fetchHub = async (
    accessToken: string | null,
    query: HubQuery
): Promise<Result<HubPage>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const params: Record<string, string | number> = {};
        if (query.q?.trim()) params.q = query.q.trim().slice(0, 80);
        if (query.tag) params.tag = query.tag;
        if (query.sort && query.sort !== "stars") params.sort = query.sort;
        if (query.offset) params.offset = query.offset;
        if (query.limit) params.limit = query.limit;
        const res = await api.get("/skills/hub/", { ...OPTIONS, params });
        const r = rec(res.data);
        if (!r || !Array.isArray(r.skills)) return NO_API;
        return { ok: true, data: { skills: parseRows(r.skills), hasMore: r.hasMore === true } };
    } catch (error) {
        return failure(error);
    }
};

export const fetchHubTags = async (accessToken: string | null): Promise<Result<HubTag[]>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get("/skills/hub/tags/", OPTIONS);
        const raw = rec(res.data)?.tags;
        const tags = (Array.isArray(raw) ? raw : []).flatMap((row) => {
            const t = rec(row);
            const tag = str(t?.tag, 60);
            return t && tag !== "" ? [{ tag, count: int(t.count) }] : [];
        });
        return { ok: true, data: tags };
    } catch (error) {
        return failure(error);
    }
};

/** Star a skill, or take the star back. One per account; the server keeps the total. */
export const setSkillStar = async (
    accessToken: string | null,
    skillId: string,
    starred: boolean
): Promise<Result<null>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const url = `/skills/${encodeURIComponent(skillId)}/star/`;
        if (starred) await api.post(url, {}, OPTIONS);
        else await api.delete(url, OPTIONS);
        return { ok: true, data: null };
    } catch (error) {
        return failure(error);
    }
};

export const fetchPublishCheck = async (
    accessToken: string | null,
    skillId: string
): Promise<Result<PublishCheckResult>> => {
    const api = authApi(accessToken);
    if (!api) return NO_API;
    try {
        const res = await api.get(
            `/skills/${encodeURIComponent(skillId)}/publish-check/`,
            OPTIONS
        );
        const r = rec(res.data);
        if (!r || !Array.isArray(r.checks)) return NO_API;
        const checks = r.checks.flatMap((row) => {
            const c = rec(row);
            const key = str(c?.key, 40);
            return c && key !== "" ? [{ key, ok: c.ok === true, text: str(c.text, 400) }] : [];
        });
        return {
            ok: true,
            data: { checks, ready: r.ready === true, profile: parseProfile(r.profile) },
        };
    } catch (error) {
        return failure(error);
    }
};

/** Make the skill public: the PATCH that sets the visibility, with the author's confirmation of the
 *  content terms and, the first time, the public handle. The server refuses with EVERY problem
 *  listed (`problems`) and changes nothing. */
export const publishToHub = async (
    accessToken: string | null,
    skillId: string,
    input: PublishPublicInput
): Promise<Result<SkillRow>> =>
    updateSkill(accessToken, skillId, {
        visibility: "public",
        acceptTerms: input.acceptTerms,
        ...(input.handle ? { handle: input.handle } : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
    });

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
 *   POST   /skills/<id>/report/                 report a skill the member can read (MIP-2044)
 *   POST   /skills/<id>/editors/ {userId}       invite a teammate to edit (the owner); DELETE
 *                                               /skills/<id>/editors/<user>/ removes one (or leaves)
 *   POST   /skills/<id>/hide/                   the team owner hides a team skill; DELETE shows it
 *
 * The whole API answers 404 while the server's `GENOS_SKILLS` switch is off: the list call then
 * resolves `{ ok: false, reason: "off" }` and the settings card is not drawn at all.
 *
 * Every body is read as untrusted: a string is a string or "", a count a plain integer or 0, an
 * unknown shape is dropped. Refusals are values, not throws; the server's sentence (`error`) is
 * kept as `message` and shown as written, because it names the field and the limit.
 */

import { authApi } from "../../../services/api";

export type SkillVisibility = "private" | "team";
export type ToolLevel = "read" | "act";
export type SkillEffort = "" | "low" | "medium" | "high";
export type SkillTab = "mine" | "team";

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
} as const;

export type SkillRole = "owner" | "editor" | "reader";

export type SkillPerson = { id: string; username: string };

/** Where a copy came from. `available: false` = the original is private or gone for this
 *  reader: the server names nothing then, and neither does the page. */
export type SkillOrigin = {
    available: boolean;
    id: string;
    title: string;
    ownerName: string;
    versionNo: number;
};

export type SkillRow = {
    id: string;
    teamId: string;
    slug: string;
    title: string;
    description: string;
    tags: string[];
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
    /** Detail answer only, for the owner and the co-editors: who edits it with the owner. */
    editors: SkillPerson[];
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
    visibility?: SkillVisibility;
    bodyMarkdown?: string;
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
    limit?: number;
    used?: number;
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
        versionNo: int(o.versionNo),
    };
};

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
        icon: str(r.icon, 16),
        argumentHint: str(r.argumentHint, 300),
        toolLevel: oneOf(r.toolLevel, ["read", "act"] as const, "read"),
        effort: oneOf(r.effort, ["", "low", "medium", "high"] as const, ""),
        visibility: oneOf(r.visibility, ["private", "team", "public"] as const, "private"),
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
        editors: parsePeople(r.editors),
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
    const base = { ok: false as const, message };
    if (res?.status === 404) return { ...base, reason: "off" };
    if (res?.status === 409) return { ...base, reason: "conflict" };
    if (res?.status === 429 && body?.code === "plan_limit") {
        return { ...base, reason: "limit", limit: int(body.limit), used: int(body.used) };
    }
    if (res?.status === 429 && body?.code === "report_limit")
        return { ...base, reason: "report_limit" };
    if (res?.status === 400 || res?.status === 403) return { ...base, reason: "bad_input" };
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

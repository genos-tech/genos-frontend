/**
 * The member's memory controls over REST (MIP-1088; genos-api `views/common/memory_views.py`):
 *
 *   GET    /user/memory/?team_id=                   the whole page in one cheap request
 *   GET    /user/memory/top/?team_id=&limit=        what Genos noticed (ranks tasks: lazy)
 *   PUT    /user/memory/marks/<task_id>/?team_id=   {mark}
 *   DELETE /user/memory/marks/<task_id>/?team_id=   clear it
 *   PATCH  /user/memory/tuning/?team_id=            {weights: {signal: level}}
 *   DELETE /user/memory/tuning/?team_id=            every signal back to normal
 *   DELETE /user/memory/<what>/                     importance | summaries | events | everything
 *
 * Pausing is NOT here: it is the existing member-events switch (`useMemberEventsPreference`).
 *
 * Every body is read as untrusted: a number is a plain non-negative integer or it is 0, a string
 * is a string or "", an unknown shape is dropped rather than drawn. Titles are the server's
 * (already access-checked) and are only ever rendered as plain text.
 *
 * Failures are values, not throws: `{ ok: false, reason }`, where `reason` is the one thing the
 * page branches on (`recording_off` = 409, `not_found` = 404, `bad_input` = 400).
 */

import { authApi } from "../../../services/api";

export const SIGNALS = [
    "others",
    "mine",
    "chat",
    "notes",
    "prs",
    "spread",
    "trend",
    "hints",
] as const;
export type SignalKey = (typeof SIGNALS)[number];

export const LEVELS = ["off", "low", "normal", "high"] as const;
export type LevelKey = (typeof LEVELS)[number];

export const MARKS = ["not_important", "priority_is_right"] as const;
export type MarkKey = (typeof MARKS)[number];

export type ForgetWhat = "importance" | "summaries" | "events" | "everything";

export type Stored = {
    ledger: {
        entries: number;
        aiApp: number;
        ownChanges: number;
        from: string | null;
        to: string | null;
        keptDays: number;
    };
    summaries: {
        rows: number;
        items: number;
        from: string | null;
        to: string | null;
        keptDays: number;
    };
    importance: { marks: number; tunedSignals: number };
};

/** A signal and its level. `name` / `means` are the server's English: a fallback only. */
export type TuningRow = { signal: string; level: string; name: string; means: string };
export type MarkRow = { taskId: number; displayId: string; title: string; mark: string };
export type CatalogEntry = { key: string; name: string; means: string };

export type Overview = {
    recording: boolean;
    stored: Stored;
    tuning: TuningRow[];
    marks: MarkRow[];
    marksLimit: number;
    catalog: { levels: CatalogEntry[]; marks: CatalogEntry[] };
};

/** Why an item ranks where it does, as numbers the page says in the member's language. */
export type Why = {
    counts: Partial<Record<"others" | "mine" | "chat" | "notes" | "prs", number>>;
    days: number;
    trend: string;
    people: number;
};

export type TopItem = {
    taskId: number;
    displayId: string;
    title: string;
    project: string;
    score: number;
    /** The server's English sentences: shown only when `why` is missing. */
    reasons: string[];
    why: Why | null;
};

export type Suggestion = {
    kind: string;
    taskId: number;
    displayId: string;
    title: string;
    priority: string;
    /** English; shown only for a `kind` this page has no words for. */
    text: string;
};

export type TopView =
    | { enabled: false }
    | { enabled: true; history: string; top: TopItem[]; suggestions: Suggestion[] };

export type Failure = { ok: false; reason: "recording_off" | "not_found" | "bad_input" | "error" };
export type Result<T> = { ok: true; data: T } | Failure;

// ---------- parsing ----------

const rec = (v: unknown): Record<string, unknown> | null =>
    v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;

const int = (v: unknown): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000_000 ? v : 0;

const str = (v: unknown, limit = 300): string => (typeof v === "string" ? v.slice(0, limit) : "");

const when = (v: unknown): string | null => {
    const s = str(v, 40);
    return s !== "" && !Number.isNaN(new Date(s).getTime()) ? s : null;
};

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const parseTuning = (raw: unknown): TuningRow[] =>
    list(raw).flatMap((row) => {
        const r = rec(row);
        const signal = str(r?.signal, 40);
        if (!r || signal === "") return [];
        return [{ signal, level: str(r.level, 20), name: str(r.name, 80), means: str(r.means) }];
    });

const parseCatalog = (raw: unknown): CatalogEntry[] =>
    list(raw).flatMap((row) => {
        const r = rec(row);
        const key = str(r?.key, 40);
        return r && key !== "" ? [{ key, name: str(r.name, 80), means: str(r.means) }] : [];
    });

export const parseOverview = (raw: unknown): Overview | null => {
    const r = rec(raw);
    const stored = rec(r?.stored);
    const ledger = rec(stored?.ledger);
    const summaries = rec(stored?.summaries);
    const importance = rec(stored?.importance);
    if (!r || !stored || !ledger || !summaries || !importance) return null;
    const recording = rec(r.recording)?.enabled;
    if (typeof recording !== "boolean") return null;
    const catalog = rec(r.catalog);
    return {
        recording,
        stored: parseStored(stored),
        tuning: parseTuning(r.tuning),
        marks: list(r.marks).flatMap((row) => {
            const m = rec(row);
            const taskId = int(m?.taskId);
            if (!m || taskId === 0) return [];
            return [
                {
                    taskId,
                    displayId: str(m.displayId, 40),
                    title: str(m.title),
                    mark: str(m.mark, 40),
                },
            ];
        }),
        marksLimit: int(r.marksLimit),
        catalog: { levels: parseCatalog(catalog?.levels), marks: parseCatalog(catalog?.marks) },
    };
};

export const parseStored = (stored: Record<string, unknown> | null): Stored => {
    const ledger = rec(stored?.ledger);
    const summaries = rec(stored?.summaries);
    const importance = rec(stored?.importance);
    return {
        ledger: {
            entries: int(ledger?.entries),
            aiApp: int(ledger?.aiApp),
            ownChanges: int(ledger?.ownChanges),
            from: when(ledger?.from),
            to: when(ledger?.to),
            keptDays: int(ledger?.keptDays),
        },
        summaries: {
            rows: int(summaries?.rows),
            items: int(summaries?.items),
            from: when(summaries?.from),
            to: when(summaries?.to),
            keptDays: int(summaries?.keptDays),
        },
        importance: {
            marks: int(importance?.marks),
            tunedSignals: int(importance?.tunedSignals),
        },
    };
};

const COUNT_KEYS = ["others", "mine", "chat", "notes", "prs"] as const;

const parseWhy = (raw: unknown): Why | null => {
    const w = rec(raw);
    if (!w) return null;
    const counts: Why["counts"] = {};
    for (const key of COUNT_KEYS) counts[key] = int(w[key]);
    return { counts, days: int(w.days), trend: str(w.trend, 20), people: int(w.people) };
};

export const parseTop = (raw: unknown): TopView | null => {
    const r = rec(raw);
    if (!r || typeof r.enabled !== "boolean") return null;
    if (!r.enabled) return { enabled: false };
    return {
        enabled: true,
        history: str(r.history, 20),
        top: list(r.top).flatMap((row) => {
            const t = rec(row);
            const taskId = int(t?.taskId);
            if (!t || taskId === 0) return [];
            return [
                {
                    taskId,
                    displayId: str(t.displayId, 40),
                    title: str(t.title),
                    project: str(t.project, 120),
                    score: int(t.score),
                    reasons: list(t.reasons)
                        .map((x) => str(x))
                        .filter((x) => x !== ""),
                    why: parseWhy(t.why),
                },
            ];
        }),
        suggestions: list(r.suggestions).flatMap((row) => {
            const s = rec(row);
            const taskId = int(s?.taskId);
            if (!s || taskId === 0) return [];
            return [
                {
                    kind: str(s.kind, 40),
                    taskId,
                    displayId: str(s.displayId, 40),
                    title: str(s.title),
                    priority: str(s.priority, 40),
                    text: str(s.suggestion),
                },
            ];
        }),
    };
};

// ---------- requests ----------

const failure = (error: unknown): Failure => {
    const res = (error as { response?: { status?: number; data?: unknown } })?.response;
    const code = rec(res?.data)?.code;
    if (res?.status === 409 && code === "recording_off") {
        return { ok: false, reason: "recording_off" };
    }
    if (res?.status === 404) return { ok: false, reason: "not_found" };
    if (res?.status === 400) return { ok: false, reason: "bad_input" };
    return { ok: false, reason: "error" };
};

const OPTIONS = { suppressErrorToast: true } as const;

export const fetchOverview = async (
    accessToken: string | null,
    teamId: string
): Promise<Result<Overview>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error" };
    try {
        const res = await api.get("/user/memory/", { ...OPTIONS, params: { team_id: teamId } });
        const data = parseOverview(res.data);
        return data ? { ok: true, data } : { ok: false, reason: "error" };
    } catch (error) {
        return failure(error);
    }
};

/** How many items the list asks for (the server's own cap is 10). */
export const TOP_LIMIT = 8;

export const fetchTop = async (
    accessToken: string | null,
    teamId: string
): Promise<Result<TopView>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error" };
    try {
        const res = await api.get("/user/memory/top/", {
            ...OPTIONS,
            params: { team_id: teamId, limit: TOP_LIMIT },
        });
        const data = parseTop(res.data);
        return data ? { ok: true, data } : { ok: false, reason: "error" };
    } catch (error) {
        return failure(error);
    }
};

/** Set (`mark`) or clear (`null`) the member's mark on one task. */
export const writeMark = async (
    accessToken: string | null,
    teamId: string,
    taskId: number,
    mark: MarkKey | null
): Promise<Result<null>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error" };
    const url = `/user/memory/marks/${taskId}/`;
    try {
        if (mark === null) await api.delete(url, { ...OPTIONS, params: { team_id: teamId } });
        else await api.put(url, { mark }, { ...OPTIONS, params: { team_id: teamId } });
        return { ok: true, data: null };
    } catch (error) {
        return failure(error);
    }
};

/** Change one signal's level, or (`null`) put every signal back to normal. Resolves to the
 *  eight rows the server now has. */
export const writeTuning = async (
    accessToken: string | null,
    teamId: string,
    change: { signal: SignalKey; level: LevelKey } | null
): Promise<Result<TuningRow[]>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error" };
    try {
        const res =
            change === null
                ? await api.delete("/user/memory/tuning/", {
                      ...OPTIONS,
                      params: { team_id: teamId },
                  })
                : await api.patch(
                      "/user/memory/tuning/",
                      { weights: { [change.signal]: change.level } },
                      { ...OPTIONS, params: { team_id: teamId } }
                  );
        const tuning = parseTuning(rec(res.data)?.tuning);
        return tuning.length > 0 ? { ok: true, data: tuning } : { ok: false, reason: "error" };
    } catch (error) {
        return failure(error);
    }
};

/** What a delete took away, as the server counted it. */
export type Deleted = { events: number; summaries: number; marks: number; tunedSignals: number };
export type Forgotten = { what: ForgetWhat; deleted: Deleted; stored: Stored };

export const forget = async (
    accessToken: string | null,
    what: ForgetWhat
): Promise<Result<Forgotten>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error" };
    try {
        const res = await api.delete(`/user/memory/${what}/`, OPTIONS);
        const body = rec(res.data);
        const deleted = rec(body?.deleted);
        const left = rec(body?.stored);
        // Without what is left, the page cannot say what is stored: that is a failure, not "nothing".
        if (!body || !deleted || !left) return { ok: false, reason: "error" };
        return {
            ok: true,
            data: {
                what,
                deleted: {
                    events: int(deleted.events),
                    summaries: int(deleted.summaries),
                    marks: int(deleted.marks),
                    tunedSignals: int(deleted.tunedSignals),
                },
                stored: parseStored(left),
            },
        };
    } catch (error) {
        return failure(error);
    }
};

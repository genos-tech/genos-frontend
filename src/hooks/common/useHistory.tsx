import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

// Browser-history-style activity log of opened entities. Tracks
// navigations (which chat / thread / task / milestone / note the user
// opened); does NOT track message reads or content edits. Storage is
// per-team localStorage so the history follows the team — switching
// teams scopes to a different list, switching back restores it.

// Chat-side ids (`chatId`, `threadId`) are v3 UUID STRINGS. They were
// typed `number` from the legacy per-type-IntegerField contract, and the
// tracker cast UUIDs through that slot — which round-tripped fine in
// memory but was rejected by the read-side check below, silently emptying
// the Chats tab on every reload. Persisted ids are therefore normalized
// to `string` on the way in (see `readId`): one canonical shape, whatever
// era the row was written in. Ids that are genuinely numeric enums
// (`chatType`) or numeric elsewhere in the app (`taskId`, `noteId`,
// `messageId` seq) stay numbers.
export type ChatHistoryEntry = {
    kind: "chat";
    chatType: number;
    chatId: string;
    // When the URL the row was recorded from carried `/message/:id`,
    // we persist that id plus the first line of the targeted message
    // so the row deep-links straight back to that bubble. Different
    // messageIds within the same chat are separate rows (see
    // `keyForEntry`).
    messageId?: number | null;
    messageText?: string | null;
    label: string;
    openedAt: number;
};

export type ThreadHistoryEntry = {
    kind: "thread";
    chatType: number;
    chatId: string;
    // The parent message's UUID post-v3 (it addresses the message the
    // thread hangs off of, not a row in a threads table).
    threadId: string;
    // When the thread URL carried `/message/:id`, we persist the id
    // plus the first line of the targeted in-thread message. Different
    // in-thread messageIds are separate rows.
    messageId?: number | null;
    messageText?: string | null;
    // First line of the parent message's plain-text content (the
    // bubble the thread hangs off of). Captured at open time so the
    // history row can show what the conversation was about — the
    // raw threadId on its own ("#4") is uninformative. Optional: old
    // entries written before this field existed will fall back to
    // just the parent chat name.
    parentMessageText?: string | null;
    label: string;
    openedAt: number;
};

export type TaskHistoryEntry = {
    kind: "task";
    taskId: number;
    projectId: number | null;
    // Project display name, captured at open time for the row's
    // subtitle. Live task status is looked up at render time from
    // useTM.allTasks (it can change between opens), so we don't
    // persist that.
    projectName?: string | null;
    label: string;
    openedAt: number;
};

export type MilestoneHistoryEntry = {
    kind: "milestone";
    milestoneId: number;
    projectId: number | null;
    projectName?: string | null;
    label: string;
    openedAt: number;
};

export type NoteHistoryEntry = {
    kind: "note";
    // The sidebar BUCKET, not the backend type: 1 my, 2 task, 3 chat,
    // 4 shared, 8 team. My / Shared / Team are all note_type 1 on the
    // server, so recording the backend type would collapse them into
    // one indistinguishable "My note" row.
    noteType: number;
    noteId: number;
    // Team notes only — the containing folder, shown as the row's
    // subtitle the way a task note shows its project.
    folderName?: string | null;
    // Coordinates needed to deep-link back to the note. Filled in for
    // task notes (projectId + taskId) and chat notes (chatType + chatId
    // + threadId); empty for personal "My Notes".
    projectId?: number | null;
    taskId?: number | null;
    chatType?: number | null;
    // Chat coordinates follow the same v3 string shape as the chat/thread
    // entries above. Note rows were never dropped on reload (their guard
    // keys off `noteId`), but they carried the same number-typed lie, and
    // these two feed the chat-note deep link.
    chatId?: string | null;
    threadId?: string | null;
    isThread?: boolean | null;
    // Context labels for the row's subtitle — project name for task
    // notes, chat name for chat notes. Personal notes have no
    // subtitle. Captured at open time so a renamed project doesn't
    // mutate old history rows.
    projectName?: string | null;
    taskTitle?: string | null;
    chatName?: string | null;
    label: string;
    openedAt: number;
};

export type HistoryEntry =
    | ChatHistoryEntry
    | ThreadHistoryEntry
    | TaskHistoryEntry
    | MilestoneHistoryEntry
    | NoteHistoryEntry;

// Per-kind cap. Each tab in the modal can hold up to MAX_PER_KIND rows
// (Chats merges chat + thread; Tasks merges task + milestone — the cap
// is applied to each kind independently before merging, so a heavy
// thread-user doesn't drown out their plain chats and vice versa).
const MAX_PER_KIND = 20;
const STORAGE_KEY_PREFIX = "genos.history.v1.";

const keyForEntry = (e: HistoryEntry): string => {
    switch (e.kind) {
        case "chat":
            // A deep-link open of a specific message (`/message/:id`)
            // is its own row, separate from the plain chat open and
            // from other messages within the same chat — that's how
            // the user navigates back to a particular bubble.
            return `chat:${e.chatType}:${e.chatId}:${e.messageId ?? 0}`;
        case "thread":
            return `thread:${e.chatType}:${e.chatId}:${e.threadId}:${e.messageId ?? 0}`;
        case "task":
            return `task:${e.taskId}`;
        case "milestone":
            return `milestone:${e.milestoneId}`;
        case "note":
            return `note:${e.noteType}:${e.noteId}`;
    }
};

// Read one persisted chat-side id, normalizing to the canonical string
// shape. Accepts the number a pre-v3 row was written with — those rows
// are already in users' localStorage, so rejecting them would trade one
// silent drop for another. `null` means "unusable", which callers treat
// as a reason to drop the row (an empty id deep-links nowhere: `""` is
// the v3 uninitialized-chat sentinel).
const readId = (v: unknown): string | null => {
    if (typeof v === "string") return v || null;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return null;
};

// Parse-and-normalize, NOT a type guard. A guard could only narrow, and
// the chat-side ids need converting (legacy number -> canonical string),
// so the read path has to be able to return a rewritten entry. Returns
// null for anything unusable, which the caller filters out.
const reviveEntry = (v: unknown): HistoryEntry | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.label !== "string" || typeof o.openedAt !== "number") return null;
    switch (o.kind) {
        case "chat": {
            if (typeof o.chatType !== "number") return null;
            const chatId = readId(o.chatId);
            return chatId ? ({ ...o, chatId } as ChatHistoryEntry) : null;
        }
        case "thread": {
            if (typeof o.chatType !== "number") return null;
            const chatId = readId(o.chatId);
            const threadId = readId(o.threadId);
            return chatId && threadId ? ({ ...o, chatId, threadId } as ThreadHistoryEntry) : null;
        }
        case "task":
            return typeof o.taskId === "number" ? (o as unknown as TaskHistoryEntry) : null;
        case "milestone":
            return typeof o.milestoneId === "number"
                ? (o as unknown as MilestoneHistoryEntry)
                : null;
        case "note": {
            if (typeof o.noteType !== "number" || typeof o.noteId !== "number") return null;
            // Optional coordinates: absent stays absent (a personal note
            // has none), present gets normalized like a chat row's.
            const note = { ...o } as unknown as NoteHistoryEntry;
            if (o.chatId != null) note.chatId = readId(o.chatId);
            if (o.threadId != null) note.threadId = readId(o.threadId);
            return note;
        }
        default:
            return null;
    }
};

const readFromStorage = (teamId: string | null | undefined): HistoryEntry[] => {
    if (!teamId || typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + teamId);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const valid = parsed.map(reviveEntry).filter((e): e is HistoryEntry => e !== null);
        // Collapse any duplicates that may have been written under an
        // older keying scheme (e.g. per-(chat, messageId)) — now also the
        // pre-v3/post-v3 pair for one chat, which normalization above
        // makes identical. Entries are stored newest-first, so the first
        // occurrence of each key is the one we keep.
        const seen = new Set<string>();
        const deduped: HistoryEntry[] = [];
        for (const e of valid) {
            const k = keyForEntry(e);
            if (seen.has(k)) continue;
            seen.add(k);
            deduped.push(e);
        }
        return deduped;
    } catch {
        // Corrupted JSON — treat as empty rather than crashing the app.
        return [];
    }
};

const writeToStorage = (teamId: string | null | undefined, entries: HistoryEntry[]) => {
    if (!teamId || typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY_PREFIX + teamId, JSON.stringify(entries));
    } catch {
        // Quota exceeded or storage unavailable — silently drop. Cache
        // is best-effort; in-memory state remains authoritative.
    }
};

// Dedup-on-reopen: move existing entry to the top with the new timestamp
// + label, drop any older copy. Then prune each kind to MAX_PER_KIND so
// a power-user opening 200 tasks doesn't push their chats out of the
// other tabs.
const mergeAndCap = (existing: HistoryEntry[], next: HistoryEntry): HistoryEntry[] => {
    const k = keyForEntry(next);
    const filtered = existing.filter((e) => keyForEntry(e) !== k);
    const merged: HistoryEntry[] = [next, ...filtered];

    const byKindCounts = new Map<HistoryEntry["kind"], number>();
    const pruned: HistoryEntry[] = [];
    for (const e of merged) {
        const c = byKindCounts.get(e.kind) ?? 0;
        if (c >= MAX_PER_KIND) continue;
        byKindCounts.set(e.kind, c + 1);
        pruned.push(e);
    }
    return pruned;
};

interface HistoryContextValue {
    entries: HistoryEntry[];
    // Chats tab: chat + thread entries newest-first.
    chatsEntries: (ChatHistoryEntry | ThreadHistoryEntry)[];
    // Tasks tab: task + milestone entries newest-first.
    tasksEntries: (TaskHistoryEntry | MilestoneHistoryEntry)[];
    // Notes tab.
    notesEntries: NoteHistoryEntry[];
    record: (entry: HistoryEntry) => void;
    clear: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export const HistoryProvider = ({
    children,
    teamId,
}: {
    children: ReactNode;
    teamId: string | null | undefined;
}) => {
    const [entries, setEntries] = useState<HistoryEntry[]>(() => readFromStorage(teamId));

    // Re-load when the active team changes. Each team carries its own
    // localStorage bucket so switching back surfaces the previous team's
    // history intact.
    useEffect(() => {
        setEntries(readFromStorage(teamId));
    }, [teamId]);

    const record = useCallback(
        (entry: HistoryEntry) => {
            // Compute + persist inside the state updater so the write
            // sees the freshly-merged array — NOT a ref that's only
            // populated by a [entries] effect a render later. A
            // setItem of a 50-row JSON is sub-millisecond; the previous
            // microtask coalescing wasn't worth the lost-write hazard.
            setEntries((prev) => {
                const next = mergeAndCap(prev, entry);
                writeToStorage(teamId, next);
                return next;
            });
        },
        [teamId]
    );

    const clear = useCallback(() => {
        setEntries([]);
        if (teamId && typeof window !== "undefined") {
            try {
                window.localStorage.removeItem(STORAGE_KEY_PREFIX + teamId);
            } catch {
                // ignore
            }
        }
    }, [teamId]);

    const chatsEntries = useMemo(
        () =>
            entries.filter(
                (e): e is ChatHistoryEntry | ThreadHistoryEntry =>
                    e.kind === "chat" || e.kind === "thread"
            ),
        [entries]
    );
    const tasksEntries = useMemo(
        () =>
            entries.filter(
                (e): e is TaskHistoryEntry | MilestoneHistoryEntry =>
                    e.kind === "task" || e.kind === "milestone"
            ),
        [entries]
    );
    const notesEntries = useMemo(
        () => entries.filter((e): e is NoteHistoryEntry => e.kind === "note"),
        [entries]
    );

    const value = useMemo<HistoryContextValue>(
        () => ({ entries, chatsEntries, tasksEntries, notesEntries, record, clear }),
        [entries, chatsEntries, tasksEntries, notesEntries, record, clear]
    );

    return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

export const useHistory = (): HistoryContextValue => {
    const ctx = useContext(HistoryContext);
    if (!ctx) {
        // No provider mounted (rendering outside the auth shell, or in a
        // test). Return a no-op stub so consumers don't crash.
        return {
            entries: [],
            chatsEntries: [],
            tasksEntries: [],
            notesEntries: [],
            record: () => {},
            clear: () => {},
        };
    }
    return ctx;
};

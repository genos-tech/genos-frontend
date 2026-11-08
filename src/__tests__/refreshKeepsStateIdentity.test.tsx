/**
 * An unchanged background refresh must not hand React a new reference.
 *
 * The `#`-mention refresh (every 60 s while the tab is visible, plus focus /
 * visibility) re-fetches the note metadata and the project list, and the
 * team roster has its own 60 s read. Each wrote a brand-new array into state
 * even when the answer was identical, so every `useMemo`, `memo` comparator
 * and effect downstream re-ran once a minute — measured at ~400,000
 * component renders over two idle minutes.
 *
 * Each setter is checked both ways, because the failure modes are opposite:
 *
 *   - an UNCHANGED answer keeps the exact same reference (and so the same
 *     derived tree);
 *   - a CHANGED answer — an edit, an addition, a removal — still lands as a
 *     new reference, so the UI is never left stale.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usersChannel } from "../db/workers/channels";
import { findTeam } from "../features/admin/services/findTeam";
import { loadMyTeams } from "../features/admin/services/loadMyTeams";
import { loadChatNoteMeta } from "../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadSharedNotesMeta } from "../features/notes/common/services/loadSharedNotesMeta";
import { loadMyNoteMeta } from "../features/notes/my-notes/services/loadMyNoteMeta";
import { loadTaskNoteMeta } from "../features/notes/task-notes/services/loadTaskNoteMeta";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { loadTeamProjects } from "../features/tasks/services/loadTeamProjects";
import { useProjectManagement } from "../hooks/common/useProjectManagement";
import { useTeamManagement } from "../hooks/common/useTeamManagement";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";
import type { ProjectProps } from "../types/tasks";

// Every loader the hooks call on mount is mocked: a real one goes to axios,
// and a failure that lands after the test has finished is an unhandled error
// that fails the whole run (see AgentNoteSidebarRefresh.test.tsx).
vi.mock("../features/notes/my-notes/services/loadMyNoteMeta", () => ({
    loadMyNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/task-notes/services/loadTaskNoteMeta", () => ({
    loadTaskNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/chat-notes/services/loadChatNoteMeta", () => ({
    loadChatNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/loadSharedNotesMeta", () => ({
    loadSharedNotesMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNotesMeta", () => ({
    loadTeamNotesMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNoteFolders", () => ({
    loadTeamNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/my-notes/services/loadMyNoteFolders", () => ({
    loadMyNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/favorite-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/favorite-notes/services")>()),
    loadFavoriteNotesMeta: vi.fn(async () => ({
        personalNotes: [],
        taskNotes: [],
        chatNotes: [],
        folders: [],
    })),
}));

vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => undefined),
}));
vi.mock("../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: vi.fn(async () => undefined),
}));

vi.mock("../db/workers/channels", () => ({
    usersChannel: { request: vi.fn() },
}));
vi.mock("../features/admin/services/findTeam", () => ({
    findTeam: vi.fn(async () => ({ exist: false })),
}));
vi.mock("../features/admin/services/loadMyTeams", () => ({
    loadMyTeams: vi.fn(async () => []),
}));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn(async () => []),
}));

// Deep clone: what a second fetch of the same data looks like — equal
// content, nothing shared with the first answer.
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

describe("note metadata refresh", () => {
    // One `myself` for the whole file: the hooks' effects key off it.
    const myself = { teamId: "team-1", userId: "user-1" } as UserProps;

    const myRows = () => [
        {
            noteType: 1,
            noteId: 1,
            parentNoteId: null,
            folderId: null,
            title: "Alpha",
            tsUpdated: "2026-11-03 10:00:00",
        },
        {
            noteType: 1,
            noteId: 2,
            parentNoteId: 1,
            folderId: null,
            title: "Alpha child",
            tsUpdated: "2026-11-03 10:05:00",
        },
    ];
    const taskRows = () => [
        {
            noteType: 2,
            noteId: 10,
            parentNoteId: null,
            projectId: 1,
            taskId: 5,
            title: "Task note",
            tsUpdated: "2026-11-03 10:00:00",
        },
    ];
    const chatRows = () => [
        {
            noteType: 3,
            noteId: 20,
            parentNoteId: null,
            chatType: 2,
            chatId: 3,
            isThread: false,
            threadId: 0,
            title: "Chat note",
            tsUpdated: "2026-11-03 10:00:00",
        },
    ];
    const sharedRows = () => [
        {
            noteType: 1,
            noteId: 30,
            parentNoteId: null,
            folderId: null,
            title: "Shared note",
            tsUpdated: "2026-11-03 10:00:00",
            ownerId: "user-2",
            ownerName: "Sam",
            roleId: 2,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // [label, loader, rows, getter, state key, derived tree key, field to edit]
    const cases = [
        ["my", loadMyNoteMeta, myRows, "getMyNoteMeta", "myNoteMeta", "myNoteMetaTree"],
        [
            "task",
            loadTaskNoteMeta,
            taskRows,
            "getTaskNoteMeta",
            "taskNoteMeta",
            "taskNoteMetaTree",
        ],
        [
            "chat",
            loadChatNoteMeta,
            chatRows,
            "getChatNoteMeta",
            "chatNoteMeta",
            "chatNoteMetaTree",
        ],
        [
            "shared",
            loadSharedNotesMeta,
            sharedRows,
            "getSharedNoteMeta",
            "sharedNoteMeta",
            "sharedNoteMetaTree",
        ],
    ] as const;

    it.each(cases)(
        "%s notes: an equal answer keeps the array and its tree, a changed one replaces them",
        async (_label, loader, rows, getter, stateKey, treeKey) => {
            const { result } = renderHook(() => useNoteManagement(myself, "test-token"));
            await settle();

            const refresh = async (answer: unknown) => {
                vi.mocked(
                    loader as never as (...a: unknown[]) => Promise<unknown>
                ).mockResolvedValueOnce(answer);
                await act(async () => {
                    await result.current[getter]();
                });
            };
            const read = () => {
                const state = result.current as unknown as Record<string, unknown[]>;
                return { list: state[stateKey], tree: state[treeKey] };
            };

            // First answer populates the list.
            await refresh(rows());
            const first = read();
            expect(first.list).toHaveLength(rows().length);

            // The same data again, as a brand-new array: nothing changes.
            await refresh(clone(rows()));
            const second = read();
            expect(second.list).toBe(first.list);
            expect(second.tree).toBe(first.tree);

            // A real change (a rename) is a new reference all the way down.
            const edited = clone(rows());
            edited[0].title = `${edited[0].title} (renamed)`;
            await refresh(edited);
            const third = read();
            expect(third.list).not.toBe(first.list);
            expect(third.tree).not.toBe(first.tree);
            expect((third.list[0] as { title: string }).title).toContain("(renamed)");

            // So is an addition...
            const grown = clone(edited);
            grown.push({ ...clone(grown[0]), noteId: 999, title: "Brand new" });
            await refresh(grown);
            const fourth = read();
            expect(fourth.list).not.toBe(third.list);
            expect(fourth.list).toHaveLength(grown.length);

            // ...and equal-again-to-the-latest is once more a no-op.
            await refresh(clone(grown));
            expect(read().list).toBe(fourth.list);
            expect(read().tree).toBe(fourth.tree);
        }
    );

    it("my notes: a failed refresh (undefined) still keeps the list it has", async () => {
        const { result } = renderHook(() => useNoteManagement(myself, "test-token"));
        await settle();
        vi.mocked(loadMyNoteMeta).mockResolvedValueOnce(myRows());
        await act(async () => {
            await result.current.getMyNoteMeta();
        });
        const before = result.current.myNoteMeta;

        vi.mocked(loadMyNoteMeta).mockResolvedValueOnce(undefined);
        await act(async () => {
            await result.current.getMyNoteMeta();
        });

        expect(result.current.myNoteMeta).toBe(before);
    });

    it("my notes: an empty answer is a real answer and still empties the list", async () => {
        // Last note deleted elsewhere: the endpoint is a full load, so [] means
        // "no notes". The identity guard must not swallow that.
        const { result } = renderHook(() => useNoteManagement(myself, "test-token"));
        await settle();
        vi.mocked(loadMyNoteMeta).mockResolvedValueOnce(myRows());
        await act(async () => {
            await result.current.getMyNoteMeta();
        });
        expect(result.current.myNoteMeta).toHaveLength(2);

        vi.mocked(loadMyNoteMeta).mockResolvedValueOnce([]);
        await act(async () => {
            await result.current.getMyNoteMeta();
        });

        expect(result.current.myNoteMeta).toEqual([]);
    });

    it("team notes keep their existing guard (now the shared helper)", async () => {
        const { result } = renderHook(() => useNoteManagement(myself, "test-token"));
        await settle();
        const teamRows = () => [
            { ...myRows()[0], ownerId: "user-2", ownerName: "Sam", roleId: 2 },
        ];

        vi.mocked(loadTeamNotesMeta).mockResolvedValueOnce(teamRows());
        await act(async () => {
            await result.current.getTeamNoteMeta();
        });
        const first = result.current.teamNoteMeta;
        expect(first).toHaveLength(1);

        vi.mocked(loadTeamNotesMeta).mockResolvedValueOnce(clone(teamRows()));
        await act(async () => {
            await result.current.getTeamNoteMeta();
        });
        expect(result.current.teamNoteMeta).toBe(first);

        const edited = clone(teamRows());
        edited[0].title = "Renamed";
        vi.mocked(loadTeamNotesMeta).mockResolvedValueOnce(edited);
        await act(async () => {
            await result.current.getTeamNoteMeta();
        });
        expect(result.current.teamNoteMeta).not.toBe(first);
    });
});

describe("project list refresh", () => {
    // No teamId: the hook's own boot-time load is skipped, so only the setter
    // under test writes.
    const myself = { teamId: "", userId: "" } as UserProps;

    const project = (over: Partial<ProjectProps> = {}): ProjectProps =>
        ({
            projectId: 1,
            projectName: "Genos",
            projectTags: [],
            projectLabels: [],
            isPrivate: false,
            isJoined: true,
            ...over,
        }) as unknown as ProjectProps;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the list for an equal answer and replaces it for a real change", () => {
        const { result } = renderHook(() => useProjectManagement(myself, "test-token", ""));

        act(() => result.current.setTeamProjects([project(), project({ projectId: 2 })]));
        const first = result.current.teamProjects;
        expect(first).toHaveLength(2);

        // The refresh in App.tsx: a spread copy of a freshly fetched list.
        act(() =>
            result.current.setTeamProjects([...clone([project(), project({ projectId: 2 })])])
        );
        expect(result.current.teamProjects).toBe(first);

        // Rename.
        act(() =>
            result.current.setTeamProjects([
                project({ projectName: "Renamed" }),
                project({ projectId: 2 }),
            ])
        );
        const renamed = result.current.teamProjects;
        expect(renamed).not.toBe(first);
        expect(renamed[0].projectName).toBe("Renamed");

        // Joined / left.
        act(() =>
            result.current.setTeamProjects([
                project({ projectName: "Renamed" }),
                project({ projectId: 2, isJoined: false }),
            ])
        );
        expect(result.current.teamProjects).not.toBe(renamed);

        // Added, then removed (the create / delete modals).
        const withThree = [
            project({ projectName: "Renamed" }),
            project({ projectId: 2, isJoined: false }),
            project({ projectId: 3 }),
        ];
        act(() => result.current.setTeamProjects(withThree));
        expect(result.current.teamProjects).toHaveLength(3);
        act(() => result.current.setTeamProjects([]));
        expect(result.current.teamProjects).toHaveLength(0);
    });

    it("exposes a setter whose identity is stable across renders", () => {
        const { result, rerender } = renderHook(() =>
            useProjectManagement(myself, "test-token", "")
        );
        const setter = result.current.setTeamProjects;
        act(() => setter([project()]));
        rerender();
        expect(result.current.setTeamProjects).toBe(setter);
    });

    it("the App refresh path (loadTeamProjects then setTeamProjects) is a no-op when nothing changed", async () => {
        const { result } = renderHook(() => useProjectManagement(myself, "test-token", ""));
        const refresh = async () => {
            const projects = await loadTeamProjects(
                { teamId: "team-1", userId: "user-1" } as UserProps,
                "test-token"
            );
            if (projects) result.current.setTeamProjects([...projects]);
        };

        vi.mocked(loadTeamProjects).mockResolvedValueOnce([project()]);
        await act(refresh);
        const first = result.current.teamProjects;

        vi.mocked(loadTeamProjects).mockResolvedValueOnce(clone([project()]));
        await act(refresh);
        expect(result.current.teamProjects).toBe(first);
    });
});

describe("team roster refresh", () => {
    const myself = { teamId: "team-1", userId: "user-1" } as UserProps;

    const member = (userId: string, over: Partial<UserProps> = {}): UserProps =>
        ({
            teamId: "team-1",
            teamName: "Genos",
            userId,
            userName: `User ${userId}`,
            userEmail: `${userId}@example.com`,
            avatarImgPath: "",
            tsLastSeen: "2026-11-03 10:00:00",
            tsJoined: "2026-01-01 00:00:00",
            isOnline: false,
            ...over,
        }) as UserProps;

    const roster = (users: UserProps[]): Record<string, UserProps> =>
        Object.fromEntries(users.map((u) => [u.userId, u]));

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        localStorage.clear();
        vi.mocked(findTeam).mockResolvedValue({ exist: false } as never);
        vi.mocked(loadMyTeams).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const answerWith = (users: UserProps[]) =>
        vi.mocked(usersChannel.request).mockResolvedValue(clone(roster(users)) as never);

    const tick = () =>
        act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });

    it("keeps teamMembers and teamMemberProfiles when the roster is unchanged", async () => {
        const users = [member("user-1", { isOnline: true }), member("user-2"), member("user-3")];
        answerWith(users);
        // `myself` is one constant reference, as in the app: a new object each
        // render would re-run the hook's [myself] effect.
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const members = result.current.teamMembers;
        const profiles = result.current.teamMemberProfiles;
        expect(members).toHaveLength(3);
        expect(Object.keys(profiles)).toHaveLength(3);

        // Three ticks of the 60 s poll, each a freshly built, equal roster.
        for (let i = 0; i < 3; i++) {
            answerWith(users);
            await tick();
        }

        expect(vi.mocked(usersChannel.request).mock.calls.length).toBeGreaterThanOrEqual(4);
        expect(result.current.teamMembers).toBe(members);
        expect(result.current.teamMemberProfiles).toBe(profiles);
    });

    it("keeps them across heartbeats, which only move tsLastSeen", async () => {
        // This is the production case. Every online member beats once a minute
        // and the beat rewrites their stored `tsLastSeen` (to the second), so
        // the roster read differs from the last one on EVERY tick even though
        // nothing visible changed. Nothing renders the timestamp — presence is
        // the `isOnline` flag derived from it — so it must not count.
        const at = (minute: number) => `2026-11-03 10:${String(minute).padStart(2, "0")}:07`;
        const beatAt = (minute: number) => [
            member("user-1", { isOnline: true, tsLastSeen: at(minute) }),
            member("user-2", { isOnline: true, tsLastSeen: at(minute) }),
            member("user-3", { isOnline: false, tsLastSeen: "2026-11-02 08:00:00" }),
        ];
        answerWith(beatAt(0));
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const members = result.current.teamMembers;
        const profiles = result.current.teamMemberProfiles;

        for (let minute = 1; minute <= 3; minute++) {
            answerWith(beatAt(minute));
            await tick();
        }

        expect(result.current.teamMembers).toBe(members);
        expect(result.current.teamMemberProfiles).toBe(profiles);
    });

    it("produces new references when a teammate goes offline, whatever their timestamp does", async () => {
        const online = [
            member("user-1", { isOnline: true, tsLastSeen: "2026-11-03 10:00:07" }),
            member("user-2", { isOnline: true, tsLastSeen: "2026-11-03 10:00:07" }),
        ];
        answerWith(online);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const members = result.current.teamMembers;
        expect(result.current.teamMemberProfiles["user-2"].isOnline).toBe(true);

        // user-2 stops beating: same stored timestamp, but the worker now
        // derives `isOnline: false` for it.
        answerWith([
            member("user-1", { isOnline: true, tsLastSeen: "2026-11-03 10:01:07" }),
            member("user-2", { isOnline: false, tsLastSeen: "2026-11-03 10:00:07" }),
        ]);
        await tick();

        expect(result.current.teamMembers).not.toBe(members);
        expect(result.current.teamMemberProfiles["user-2"].isOnline).toBe(false);
    });

    it("the post-refresh repaint fills teamMemberProfiles, not just teamMembers (MIP-1244)", async () => {
        // Cold start: the two reads the hook makes on mount happen before the
        // roster has been written to IndexedDB, so they come back empty. The
        // boot refresh then writes it and calls `funcSetTeamMembers`; that
        // repaint used to refresh `teamMembers` only, leaving the map every
        // avatar resolves through empty until the next 60 s tick.
        vi.mocked(usersChannel.request).mockResolvedValue({} as never);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(Object.keys(result.current.teamMemberProfiles)).toHaveLength(0);

        answerWith([member("user-1", { isOnline: true }), member("user-2")]);
        await act(async () => {
            await result.current.funcSetTeamMembers();
        });

        expect(Object.keys(result.current.teamMemberProfiles).sort()).toEqual([
            "user-1",
            "user-2",
        ]);
    });

    it("produces new references when a member's avatar changes", async () => {
        const users = [member("user-1", { isOnline: true }), member("user-2")];
        answerWith(users);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const members = result.current.teamMembers;
        const profiles = result.current.teamMemberProfiles;

        answerWith([users[0], member("user-2", { avatarImgPath: "new-avatar.png" })]);
        await tick();

        expect(result.current.teamMembers).not.toBe(members);
        expect(result.current.teamMemberProfiles).not.toBe(profiles);
        expect(result.current.teamMembers.find((m) => m.userId === "user-2")?.avatarImgPath).toBe(
            "new-avatar.png"
        );
        expect(result.current.teamMemberProfiles["user-2"].avatarImgPath).toBe("new-avatar.png");
    });

    it("produces new references when a member's status or presence changes", async () => {
        const users = [member("user-1", { isOnline: true }), member("user-2")];
        answerWith(users);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const first = result.current.teamMembers;

        answerWith([users[0], member("user-2", { customStatus: "On leave" })]);
        await tick();
        const second = result.current.teamMembers;
        expect(second).not.toBe(first);
        expect(second.find((m) => m.userId === "user-2")?.customStatus).toBe("On leave");

        answerWith([
            users[0],
            member("user-2", {
                customStatus: "On leave",
                isOnline: true,
                tsLastSeen: "2026-11-03 10:01:00",
            }),
        ]);
        await tick();
        expect(result.current.teamMembers).not.toBe(second);
        expect(result.current.teamMemberProfiles["user-2"].isOnline).toBe(true);
    });

    it("produces new references when a member joins or leaves", async () => {
        const users = [member("user-1", { isOnline: true }), member("user-2")];
        answerWith(users);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const first = result.current.teamMembers;

        answerWith([...users, member("user-3")]);
        await tick();
        expect(result.current.teamMembers).not.toBe(first);
        expect(result.current.teamMembers).toHaveLength(3);
        expect(Object.keys(result.current.teamMemberProfiles)).toContain("user-3");

        const withThree = result.current.teamMembers;
        answerWith(users);
        await tick();
        expect(result.current.teamMembers).not.toBe(withThree);
        expect(result.current.teamMembers).toHaveLength(2);
        expect(Object.keys(result.current.teamMemberProfiles)).not.toContain("user-3");
    });

    it("still applies a local profile edit, then a later poll that differs", async () => {
        // The profile modals patch `teamMemberProfiles` functionally between
        // ticks. The next poll is the authority: equal-to-the-patched record
        // keeps it, anything else replaces it.
        const users = [member("user-1", { isOnline: true }), member("user-2")];
        answerWith(users);
        const { result } = renderHook(() => useTeamManagement(myself, "test-token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        act(() =>
            result.current.setTeamMemberProfiles((prev) => ({
                ...prev,
                "user-2": { ...prev["user-2"], customStatus: "Heads down" },
            }))
        );
        const patched = result.current.teamMemberProfiles;
        expect(patched["user-2"].customStatus).toBe("Heads down");

        // The server still says no status: the poll overwrites the local patch.
        await tick();
        expect(result.current.teamMemberProfiles).not.toBe(patched);
        expect(result.current.teamMemberProfiles["user-2"].customStatus).toBeUndefined();
    });
});

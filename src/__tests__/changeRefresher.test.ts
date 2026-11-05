/**
 * The change-driven refresher (MIP-970 step 5): one `/changes/` answer decides
 * which loaders run, and a token is recorded only for a load that worked.
 *
 * The tokens come from the shared contract fixture (`changes_response.json`,
 * the same file the API's test pins its real response to), so a rename on
 * either side shows up here.
 */

import { describe, expect, it, vi } from "vitest";

import {
    CHANGE_COLLECTIONS,
    ChangeCollection,
    ChangeRefreshInput,
    createChangeRefresher,
    FULL_REFRESH_BACKSTOP_MS,
    Loader,
    LoaderGroups,
    parseChangeTokens,
} from "../context/changeRefresher";
import fixture from "./fixtures/changes_response.json";

type Tokens = Record<ChangeCollection, string | null>;
const FIXTURE_TOKENS = fixture.tokens as Tokens;

const clock = (start = 1_000_000) => {
    let t = start;
    return { now: () => t, advance: (ms: number) => (t += ms) };
};

/** One spy per loader; two loaders in `notes_personal` like the real table's four. */
const makeLoaders = () => {
    const spies = {} as Record<ChangeCollection, ReturnType<typeof vi.fn>[]>;
    const groups = {} as LoaderGroups;
    const sizes: Record<ChangeCollection, number> = {
        tasks_project: 2,
        tasks_team: 1,
        projects: 1,
        notes_personal: 4,
        notes_task: 1,
        notes_chat: 1,
    };
    for (const c of CHANGE_COLLECTIONS) {
        spies[c] = Array.from({ length: sizes[c] }, () => vi.fn(async () => true));
        groups[c] = spies[c] as unknown as Loader[];
    }
    const callsOf = (c: ChangeCollection) => spies[c].reduce((n, s) => n + s.mock.calls.length, 0);
    const total = () => CHANGE_COLLECTIONS.reduce((n, c) => n + callsOf(c), 0);
    return { spies, groups, callsOf, total };
};

/** A server whose tokens the test edits between triggers. */
const makeServer = (initial: Tokens = FIXTURE_TOKENS) => {
    const state = { tokens: { ...initial } as Tokens, calls: 0, fail: null as null | Error };
    const fetchChanges = async () => {
        state.calls += 1;
        if (state.fail) throw state.fail;
        return { tokens: { ...state.tokens } };
    };
    return { state, fetchChanges };
};

const input = (over: Partial<ChangeRefreshInput> & Pick<ChangeRefreshInput, "groups">) => ({
    identity: "u1:team-a",
    projectId: 7 as number | null,
    fetchChanges: null,
    ...over,
});

describe("parseChangeTokens", () => {
    it("accepts the contract fixture", () => {
        expect(parseChangeTokens(fixture)).toEqual(fixture.tokens);
    });

    it("accepts a null per-project token only for tasks_project", () => {
        expect(parseChangeTokens({ tokens: { ...FIXTURE_TOKENS, tasks_project: null } })).not.toBe(
            null
        );
        expect(parseChangeTokens({ tokens: { ...FIXTURE_TOKENS, notes_chat: null } })).toBe(null);
    });

    it.each([
        ["undefined", undefined],
        ["null", null],
        ["a string", "ok"],
        ["no tokens key", {}],
        ["tokens is a string", { tokens: "x" }],
        ["a number token", { tokens: { ...FIXTURE_TOKENS, projects: 3 } }],
        ["a missing token", { tokens: { ...FIXTURE_TOKENS, notes_task: undefined } }],
        [
            "no tasks_project key",
            {
                tokens: Object.fromEntries(
                    Object.entries(FIXTURE_TOKENS).filter(([k]) => k !== "tasks_project")
                ),
            },
        ],
    ])("rejects %s", (_name, body) => {
        expect(parseChangeTokens(body)).toBe(null);
    });

    it("the fixture names exactly the collections the refresher knows", () => {
        expect(Object.keys(fixture.tokens).sort()).toEqual([...CHANGE_COLLECTIONS].sort());
    });
});

describe("createChangeRefresher", () => {
    it("runs every loader on the first run and records every token", async () => {
        const server = makeServer();
        const l = makeLoaders();
        const r = createChangeRefresher(clock().now);

        const res = await r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));

        expect(res.full).toBe(true);
        expect(res.stored.sort()).toEqual([...CHANGE_COLLECTIONS].sort());
        for (const c of CHANGE_COLLECTIONS) {
            l.spies[c].forEach((s) => expect(s).toHaveBeenCalledTimes(1));
        }
    });

    it("nothing changed: exactly one request (the /changes/ call), no loader", async () => {
        const server = makeServer();
        const l = makeLoaders();
        const r = createChangeRefresher(clock().now);
        const run = () => r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
        await run();
        const loadersAfterFirst = l.total();

        const res = await run();
        await run();

        expect(server.state.calls).toBe(3);
        expect(l.total()).toBe(loadersAfterFirst);
        expect(res).toMatchObject({ full: false, ran: [], stored: [], changesFailed: false });
    });

    it.each(CHANGE_COLLECTIONS.map((c) => [c]))(
        "a moved %s token runs that collection's loaders and nothing else",
        async (changed) => {
            const server = makeServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            const run = () =>
                r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
            await run();
            const before = Object.fromEntries(
                CHANGE_COLLECTIONS.map((c) => [c, l.callsOf(c)])
            ) as Record<ChangeCollection, number>;

            server.state.tokens[changed] = "moved";
            const res = await run();

            expect(res.ran).toEqual([changed]);
            expect(res.stored).toEqual([changed]);
            for (const c of CHANGE_COLLECTIONS) {
                const extra = l.callsOf(c) - before[c];
                expect(extra).toBe(c === changed ? l.spies[c].length : 0);
            }
            // And once applied it is quiet again.
            const quiet = l.total();
            await run();
            expect(l.total()).toBe(quiet);
        }
    );

    it("drives the contract table: which loaders each token owns", async () => {
        // The sizes in `makeLoaders` mirror App's wiring: 2 project loaders
        // (tasks delta, sprints), 4 personal-note loaders, 1 for each other.
        const l = makeLoaders();
        expect(CHANGE_COLLECTIONS.map((c) => [c, l.spies[c].length])).toEqual([
            ["tasks_project", 2],
            ["tasks_team", 1],
            ["projects", 1],
            ["notes_personal", 4],
            ["notes_task", 1],
            ["notes_chat", 1],
        ]);
    });

    it("a loader that reports false keeps its old token and is retried next time", async () => {
        const server = makeServer();
        const l = makeLoaders();
        const r = createChangeRefresher(clock().now);
        const run = () => r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
        await run();

        // One of the four personal-note loaders fails on this change.
        server.state.tokens.notes_personal = "moved";
        l.spies.notes_personal[2].mockResolvedValueOnce(false);
        const failed = await run();
        expect(failed.ran).toEqual(["notes_personal"]);
        expect(failed.stored).toEqual([]);

        // Same token from the server, but it was never applied: tried again, in full.
        const retried = await run();
        expect(retried.ran).toEqual(["notes_personal"]);
        expect(retried.stored).toEqual(["notes_personal"]);
        l.spies.notes_personal.forEach((s) => expect(s).toHaveBeenCalledTimes(3));

        expect((await run()).ran).toEqual([]);
    });

    it("a loader that rejects is a failure too, and does not stop its siblings", async () => {
        const server = makeServer();
        const l = makeLoaders();
        const r = createChangeRefresher(clock().now);
        const run = () => r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
        await run();

        server.state.tokens.tasks_project = "moved";
        l.spies.tasks_project[0].mockRejectedValueOnce(new Error("worker died"));
        const failed = await run();

        expect(failed.stored).toEqual([]);
        // The sprints loader still ran.
        expect(l.spies.tasks_project[1]).toHaveBeenCalledTimes(2);
        expect((await run()).stored).toEqual(["tasks_project"]);
    });

    it("a loader that does not say it worked (undefined) is not taken for a success", async () => {
        const server = makeServer();
        const l = makeLoaders();
        l.spies.notes_chat[0].mockResolvedValue(undefined);
        const r = createChangeRefresher(clock().now);

        const res = await r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));

        expect(res.stored).not.toContain("notes_chat");
    });

    it("one collection failing does not hold back the others' tokens", async () => {
        const server = makeServer();
        const l = makeLoaders();
        l.spies.projects[0].mockResolvedValue(false);
        const r = createChangeRefresher(clock().now);

        const res = await r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));

        expect(res.stored).not.toContain("projects");
        expect(res.stored).toHaveLength(CHANGE_COLLECTIONS.length - 1);
    });

    it.each([
        ["404", Object.assign(new Error("Request failed with status code 404"), { status: 404 })],
        ["a network error", new Error("Network Error")],
    ])(
        "/changes/ failing (%s) falls back to a full refresh and records nothing",
        async (_n, err) => {
            const server = makeServer();
            server.state.fail = err;
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            const run = () =>
                r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));

            const first = await run();
            const second = await run();

            expect(first).toMatchObject({ full: true, changesFailed: true, stored: [] });
            expect(second).toMatchObject({ full: true, changesFailed: true, stored: [] });
            // Every trigger is today's full refresh.
            for (const c of CHANGE_COLLECTIONS) {
                l.spies[c].forEach((s) => expect(s).toHaveBeenCalledTimes(2));
            }

            // The API arrives: the next trigger loads everything once more (nothing was
            // recorded), and the one after that is quiet.
            server.state.fail = null;
            const recovered = await run();
            expect(recovered.ran.sort()).toEqual([...CHANGE_COLLECTIONS].sort());
            expect((await run()).ran).toEqual([]);
        }
    );

    it("a malformed 200 is a failure, not a set of tokens", async () => {
        const l = makeLoaders();
        const r = createChangeRefresher(clock().now);
        const bodies = [{}, { tokens: { projects: 1 } }, "<html>"];
        for (const body of bodies) {
            const res = await r.run(
                input({ groups: l.groups, fetchChanges: async () => body as never })
            );
            expect(res).toMatchObject({ full: true, changesFailed: true, stored: [] });
        }
    });

    it("full refresh at least every ten minutes (the backstop), whatever the tokens say", async () => {
        const server = makeServer();
        const l = makeLoaders();
        const c = clock();
        const r = createChangeRefresher(c.now);
        const run = () => r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
        await run();

        c.advance(FULL_REFRESH_BACKSTOP_MS - 1);
        expect((await run()).full).toBe(false);

        c.advance(1);
        const due = await run();
        expect(due.full).toBe(true);
        expect(due.ran.sort()).toEqual([...CHANGE_COLLECTIONS].sort());

        // The clock restarts from that refresh.
        c.advance(FULL_REFRESH_BACKSTOP_MS - 1);
        expect((await run()).full).toBe(false);
        c.advance(1);
        expect((await run()).full).toBe(true);
    });

    describe("the project token is per project", () => {
        const perProjectServer = () => {
            const state = { tokens: { p7: "a7", p8: "a8" } as Record<string, string> };
            const fetchFor = (projectId: number | null) => async () => ({
                tokens: {
                    ...FIXTURE_TOKENS,
                    tasks_project: projectId === null ? null : state.tokens[`p${projectId}`],
                },
            });
            return { state, fetchFor };
        };

        it("compares each project against its own last token", async () => {
            const s = perProjectServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            const at = (projectId: number | null) =>
                r.run(
                    input({
                        groups: l.groups,
                        projectId,
                        fetchChanges: s.fetchFor(projectId),
                    })
                );
            await at(7);
            expect((await at(7)).ran).toEqual([]);

            // Project 8 has never been applied here: loaded.
            expect((await at(8)).ran).toEqual(["tasks_project"]);
            // Back on 7: its own token is unchanged, so nothing, even though the
            // last token applied was 8's.
            expect((await at(7)).ran).toEqual([]);

            s.state.tokens.p7 = "b7";
            expect((await at(7)).ran).toEqual(["tasks_project"]);
            // 8's token was not touched by 7's change.
            expect((await at(8)).ran).toEqual([]);
        });

        it("a project open but no token for it: load it, record nothing", async () => {
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            const noToken = async () => ({ tokens: { ...FIXTURE_TOKENS, tasks_project: null } });
            const run = () =>
                r.run(input({ groups: l.groups, projectId: 7, fetchChanges: noToken }));
            await run();
            const res = await run();

            expect(res.ran).toEqual(["tasks_project"]);
            expect(res.stored).toEqual([]);
        });

        it("no project open: the project loaders do not run", async () => {
            const l = makeLoaders();
            const groups = { ...l.groups, tasks_project: [] as Loader[] };
            const r = createChangeRefresher(clock().now);
            const none = async () => ({ tokens: { ...FIXTURE_TOKENS, tasks_project: null } });
            const res = await r.run(input({ groups, projectId: null, fetchChanges: none }));
            expect(res.ran).not.toContain("tasks_project");
            expect(l.callsOf("tasks_project")).toBe(0);
        });

        it("the backstop forgets other projects' tokens: they are looked at again when opened", async () => {
            const s = perProjectServer();
            const l = makeLoaders();
            const c = clock();
            const r = createChangeRefresher(c.now);
            const at = (projectId: number) =>
                r.run(input({ groups: l.groups, projectId, fetchChanges: s.fetchFor(projectId) }));
            await at(7);
            await at(8);
            expect((await at(7)).ran).toEqual([]);

            c.advance(FULL_REFRESH_BACKSTOP_MS);
            await at(8); // the full refresh, on project 8
            expect((await at(7)).ran).toEqual(["tasks_project"]);
        });
    });

    describe("session and team", () => {
        it("a team switch clears the tokens: team B is refreshed in full on the same tokens", async () => {
            const server = makeServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            await r.run(
                input({
                    groups: l.groups,
                    identity: "u1:team-a",
                    fetchChanges: server.fetchChanges,
                })
            );
            expect(
                (
                    await r.run(
                        input({
                            groups: l.groups,
                            identity: "u1:team-a",
                            fetchChanges: server.fetchChanges,
                        })
                    )
                ).ran
            ).toEqual([]);

            // Identical tokens, different team: a token from A must not suppress B.
            const b = await r.run(
                input({
                    groups: l.groups,
                    identity: "u1:team-b",
                    fetchChanges: server.fetchChanges,
                })
            );
            expect(b.full).toBe(true);
            expect(b.ran.sort()).toEqual([...CHANGE_COLLECTIONS].sort());
        });

        it("signing out clears them, and a signed-out trigger is a plain full refresh with no /changes/ call", async () => {
            const server = makeServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            await r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
            const calls = server.state.calls;

            const out = await r.run(input({ groups: l.groups, identity: null }));
            expect(out.full).toBe(true);
            expect(server.state.calls).toBe(calls);

            // Signing back in as the same user starts from nothing.
            const back = await r.run(
                input({ groups: l.groups, fetchChanges: server.fetchChanges })
            );
            expect(back.full).toBe(true);
        });

        it("reset() clears every token", async () => {
            const server = makeServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            const run = () =>
                r.run(input({ groups: l.groups, fetchChanges: server.fetchChanges }));
            await run();
            expect((await run()).ran).toEqual([]);

            r.reset();
            expect((await run()).full).toBe(true);
        });

        it("a /changes/ answer that lands after a reset does not run the old loaders", async () => {
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            let answer!: (v: unknown) => void;
            const slow = () => new Promise((resolve) => (answer = resolve));

            const pending = r.run(input({ groups: l.groups, fetchChanges: slow }));
            r.reset(); // team switch while the call is in the air
            answer({ tokens: FIXTURE_TOKENS });
            const res = await pending;

            expect(l.total()).toBe(0);
            expect(res.ran).toEqual([]);
        });

        it("a loader that finishes after a team switch records nothing for the new team", async () => {
            const server = makeServer();
            const l = makeLoaders();
            const r = createChangeRefresher(clock().now);
            let release!: (ok: boolean) => void;
            const slowChat = vi.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
            const groupsA = { ...l.groups, notes_chat: [slowChat] };

            const runA = r.run(
                input({
                    groups: groupsA,
                    identity: "u1:team-a",
                    fetchChanges: async () => ({
                        tokens: { ...FIXTURE_TOKENS, notes_chat: "team-a-token" },
                    }),
                })
            );
            // Switch to team B while A's chat loader is still running; B settles.
            await vi.waitFor(() => expect(slowChat).toHaveBeenCalled());
            await r.run(
                input({
                    groups: l.groups,
                    identity: "u1:team-b",
                    fetchChanges: server.fetchChanges,
                })
            );
            release(true);
            await runA;

            // B's own token for notes_chat is "5d2f7e88". Had A's late success been
            // recorded over it, B's next trigger would see a difference and refetch.
            const res = await r.run(
                input({
                    groups: l.groups,
                    identity: "u1:team-b",
                    fetchChanges: server.fetchChanges,
                })
            );
            expect(res.ran).toEqual([]);
        });
    });

    it("two refreshers (two mounted hosts) keep their own tokens and each runs its own loaders", async () => {
        const server = makeServer();
        const hostA = makeLoaders();
        const hostB = makeLoaders();
        const a = createChangeRefresher(clock().now);
        const b = createChangeRefresher(clock().now);
        const runA = () =>
            a.run(input({ groups: hostA.groups, fetchChanges: server.fetchChanges }));
        const runB = () =>
            b.run(input({ groups: hostB.groups, fetchChanges: server.fetchChanges }));

        await runA();
        await runB();
        // Host B's first run is a full one although A already applied these tokens.
        expect(hostB.total()).toBe(hostA.total());
        expect(hostB.total()).toBeGreaterThan(0);

        server.state.tokens.notes_task = "moved";
        await runA();
        await runB();

        expect(hostA.callsOf("notes_task")).toBe(2);
        expect(hostB.callsOf("notes_task")).toBe(2);
    });
});

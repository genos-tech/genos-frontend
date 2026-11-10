/**
 * MIP-1305: settings and modals that loaded data and, on failure, drew an empty
 * answer or a plain line with no way out now show the shared ErrorState and a
 * Retry that sends the request again.
 *
 * Like `loadStates.test.tsx`, each case fails at the REQUEST (axios `get`
 * rejects), then Retry lands the second request. The services these surfaces
 * used to swallow into `[]` ("Not connected to any other team yet", "No custom
 * emoji yet", "No labels yet", "No history yet") now say `null`: the cases
 * below are the ones that would be false statements if they came back empty.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamEmojiPanel } from "../components/layout/TeamEmojiPanel";
import { TeamEmojiProvider } from "../context/TeamEmojiContext";
import { ModalManageProjectLabels } from "../features/admin/components/projectLabels/ModalManageProjectLabels";
import { ConnectedTeamsPanel } from "../features/admin/components/team/ConnectedTeamsPanel";
import { useTeamConnections } from "../features/admin/components/team/useTeamConnections";
import { CalendarModal } from "../features/calendar/components/CalendarModal";
import { useCalendarSources } from "../features/calendar/hooks/useCalendarSources";
import { ModalManageGMTags } from "../features/chat/components/modals/ModalManageGMTags";
import { ModalNoteHistory } from "../features/notes/common/components/ModalNoteHistory";
import {
    _resetPersonalGMTagsStoreForTests,
    PersonalGMTagsBootstrap,
} from "../hooks/common/usePersonalGMTags";
import { useTeamEmoji } from "../hooks/common/useTeamEmoji";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";

// ---- HTTP, faked at axios (same shape as loadStates.test.tsx) ---------------
const answers = vi.hoisted(() => ({ queue: [] as Array<{ match: string; out: unknown }> }));
const calls = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("../services/api", async (orig) => ({
    ...(await orig<typeof import("../services/api")>()),
    authApi: () => ({
        get: vi.fn(async (url: string) => {
            calls.urls.push(url);
            const i = answers.queue.findIndex((a) => url.includes(a.match));
            const hit = i >= 0 ? answers.queue.splice(i, 1)[0] : undefined;
            if (!hit) throw new Error(`unexpected request ${url}`);
            if (hit.out instanceof Error) throw hit.out;
            return { data: hit.out };
        }),
    }),
}));
const fail = (match: string) => answers.queue.push({ match, out: new Error("Network Error") });
const ok = (match: string, out: unknown) => answers.queue.push({ match, out });
const hits = (match: string) => calls.urls.filter((u) => u.includes(match)).length;

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <span /> }));
vi.mock("../components/editors/CustomEmojiImg", () => ({ CustomEmojiImg: () => <span /> }));

// The calendar modal is heavy: under a loaded machine its first paint takes seconds.
const SLOW = { timeout: 15000 };
const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });
const myself = { userId: "u1", userName: "Me", teamId: "t1" } as UserProps;

beforeEach(() => {
    answers.queue.length = 0;
    calls.urls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Connected teams", () => {
    const Harness = () => {
        const connections = useTeamConnections("t1");
        return (
            <ConnectedTeamsPanel
                borderColor="#ccc"
                canDisconnect
                canManage
                connections={connections}
                labelColor="#666"
                myTeamId="t1"
                valueColor="#111"
            />
        );
    };
    const row = {
        connectionId: "c1",
        teamId: "t2",
        teamName: "Acme",
        status: "active",
        direction: "outgoing",
        tsCreated: "",
        tsUpdated: "",
    };

    it("a failed load is not 'not connected to any team'; Retry shows the connections", async () => {
        fail("/team/connection/");
        ok("/team/connection/", { connections: [row] });
        render(wrap(<Harness />));

        expect(await screen.findByText(en.admin.connectedTeams.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.admin.connectedTeams.empty)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("Acme")).toBeTruthy();
        expect(screen.queryByText(en.admin.connectedTeams.loadFailed)).toBeNull();
        expect(hits("/team/connection/")).toBe(2);
    });

    it("an answer of 'none' is still the empty state", async () => {
        ok("/team/connection/", { connections: [] });
        render(wrap(<Harness />));

        expect(await screen.findByText(en.admin.connectedTeams.empty)).toBeTruthy();
        expect(screen.queryByText(en.admin.connectedTeams.loadFailed)).toBeNull();
    });

    it("a failed refetch keeps the rows already shown", async () => {
        ok("/team/connection/", { connections: [row] });
        const { result } = renderHook(() => useTeamConnections("t1"));
        await waitFor(() => expect(result.current.active).toHaveLength(1));

        fail("/team/connection/");
        await result.current.refresh();

        await waitFor(() => expect(result.current.loadFailed).toBe(true));
        expect(result.current.active).toHaveLength(1);
    });
});

describe("Custom emoji settings", () => {
    const Harness = () => {
        const api = useTeamEmoji(myself, "tok");
        return (
            <TeamEmojiProvider value={api}>
                <TeamEmojiPanel myself={myself} teamMemberProfiles={{}} />
            </TeamEmojiProvider>
        );
    };

    it("a failed load is not 'no custom emoji'; Retry shows them", async () => {
        fail("/team-emoji/");
        ok("/team-emoji/", {
            teamEmoji: [
                {
                    emojiId: 1,
                    name: "party",
                    url: "/x.png",
                    isDefault: false,
                    createdBy: "u1",
                },
            ],
        });
        render(wrap(<Harness />));

        expect(await screen.findByText(en.settings.customEmoji.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.settings.customEmoji.empty)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText(/party/)).toBeTruthy();
        expect(hits("/team-emoji/")).toBe(2);
    });

    it("a failed refresh does not wipe the catalog the pickers read", async () => {
        const emoji = { emojiId: 1, name: "party", url: "/x.png", isDefault: false };
        ok("/team-emoji/", { teamEmoji: [emoji] });
        const { result } = renderHook(() => useTeamEmoji(myself, "tok"));
        await waitFor(() => expect(result.current.teamEmoji).toHaveLength(1));

        fail("/team-emoji/");
        await result.current.refresh();

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.teamEmoji).toHaveLength(1);
    });
});

describe("Project labels modal", () => {
    const labels = [
        {
            labelId: 5,
            name: "Q4",
            color: "#111111",
            textColor: "#ffffff",
            projectCount: 0,
        },
    ];
    const modal = () =>
        render(
            wrap(
                <ModalManageProjectLabels
                    assignedLabels={[]}
                    open
                    projectId={1}
                    teamId="t1"
                    onAssignedChange={vi.fn()}
                    onClose={vi.fn()}
                />
            )
        );

    it("a failed load is not 'no labels yet'; Retry shows the catalog", async () => {
        fail("/project/label/");
        ok("/project/label/", labels);
        modal();

        expect(await screen.findByText(en.admin.projectLabels.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.admin.projectLabels.empty)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("Q4")).toBeTruthy();
        expect(hits("/project/label/")).toBe(2);
    });
});

describe("Manage chat tags modal", () => {
    // The personal-tags store makes its own axios client, so the transport is the adapter.
    let original: typeof axios.defaults.adapter;
    const adapter = vi.fn();
    beforeEach(() => {
        original = axios.defaults.adapter;
        axios.defaults.adapter = adapter;
        adapter.mockReset();
        _resetPersonalGMTagsStoreForTests();
    });
    afterEach(() => {
        axios.defaults.adapter = original;
    });

    it("a failed load is not 'no tags yet'; Retry asks again and the tags show", async () => {
        const bundle = {
            tags: [
                { tagId: 1, name: "Family", color: "#111111", textColor: "#ffffff", sortOrder: 1 },
            ],
            assignments: {},
            defaultVisibleTagIds: [],
        };
        adapter.mockImplementationOnce(async () => {
            throw new Error("Network Error");
        });
        adapter.mockImplementation(async (config: unknown) => ({
            data: bundle,
            status: 200,
            statusText: "OK",
            headers: {},
            config,
        }));
        render(
            wrap(
                <>
                    <PersonalGMTagsBootstrap />
                    <ModalManageGMTags open setOpen={vi.fn()} />
                </>
            )
        );

        expect(await screen.findByText(en.chat.gmTags.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.chat.gmTags.emptyList)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("Family")).toBeTruthy();
        expect(adapter).toHaveBeenCalledTimes(2);
    });
});

describe("Calendar sources", () => {
    it("a failed list request is flagged (not 'no calendars'), and reload asks again", async () => {
        fail("/calendar/list/");
        ok("/calendar/list/", {
            calendars: [
                {
                    id: "primary",
                    account_id: "a1",
                    account_email: "me@x.com",
                    summary: "Me",
                    primary: true,
                    access_role: "owner",
                    selected: true,
                },
            ],
            failed_accounts: [],
            accounts: [],
        });
        const { result } = renderHook(() => useCalendarSources("tok", true));

        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.failed).toBe(true);
        expect(result.current.calendars).toHaveLength(0);

        result.current.reload();

        await waitFor(() => expect(result.current.calendars).toHaveLength(1));
        expect(result.current.failed).toBe(false);
        expect(hits("/calendar/list/")).toBe(2);
    });
});

describe("Calendar modal", () => {
    const google = {
        id: "a1",
        provider: "google",
        email: "me@x.com",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
    };
    const calendar = {
        id: "primary",
        account_id: "a1",
        account_email: "me@x.com",
        summary: "Me",
        primary: true,
        access_role: "owner",
        selected: true,
    };

    it(
        "a failed 'which accounts' probe is not 'Connect Google'; Retry loads the calendars",
        { timeout: 30000 },
        async () => {
            fail("/integrations/me/");
            ok("/integrations/me/", { primary_auth_provider: "email", connections: [google] });
            // The calendar list is asked for at open, alongside the probe; the second answer
            // is for the request Retry sends once the probe has worked.
            ok("/calendar/list/", { calendars: [calendar], failed_accounts: [], accounts: [] });
            ok("/calendar/list/", { calendars: [calendar], failed_accounts: [], accounts: [] });
            ok("/calendar/events/aggregate/", { items: [], failed_sources: [] });
            render(wrap(<CalendarModal open onClose={vi.fn()} />));

            expect(await screen.findByText(en.calendar.sources.loadFailed, {}, SLOW)).toBeTruthy();
            expect(screen.queryByText(en.calendar.connectButton)).toBeNull();

            fireEvent.click(retry());

            await waitFor(() => expect(hits("/calendar/list/")).toBe(2), SLOW);
            await waitFor(
                () => expect(screen.queryByText(en.calendar.sources.loadFailed)).toBeNull(),
                SLOW
            );
            expect(hits("/integrations/me/")).toBe(2);
        }
    );

    it(
        "a failed calendar list is not 'no calendars selected'; Retry asks again",
        { timeout: 30000 },
        async () => {
            ok("/integrations/me/", { primary_auth_provider: "email", connections: [google] });
            fail("/calendar/list/");
            ok("/calendar/list/", { calendars: [calendar], failed_accounts: [], accounts: [] });
            ok("/calendar/events/aggregate/", { items: [], failed_sources: [] });
            render(wrap(<CalendarModal open onClose={vi.fn()} />));

            expect(await screen.findByText(en.calendar.sources.loadFailed, {}, SLOW)).toBeTruthy();
            expect(screen.queryByText(en.calendar.sources.emptySelection)).toBeNull();

            fireEvent.click(retry());

            await waitFor(
                () => expect(screen.queryByText(en.calendar.sources.loadFailed)).toBeNull(),
                SLOW
            );
            expect(hits("/calendar/list/")).toBe(2);
        }
    );

    it(
        "failed events say so (the empty grid is not 'a free month'); Retry asks again",
        { timeout: 30000 },
        async () => {
            ok("/integrations/me/", { primary_auth_provider: "email", connections: [google] });
            ok("/calendar/list/", { calendars: [calendar], failed_accounts: [], accounts: [] });
            fail("/calendar/events/aggregate/");
            ok("/calendar/events/aggregate/", { items: [], failed_sources: [] });
            render(wrap(<CalendarModal open onClose={vi.fn()} />));

            expect(await screen.findByText(en.calendar.eventsLoadFailed, {}, SLOW)).toBeTruthy();

            fireEvent.click(retry());

            await waitFor(
                () => expect(screen.queryByText(en.calendar.eventsLoadFailed)).toBeNull(),
                SLOW
            );
            expect(hits("/calendar/events/aggregate/")).toBe(2);
        }
    );
});

describe("Note history", () => {
    const versions = [
        {
            versionNo: 2,
            editor: { userId: "u2", userName: "Ann", avatarUrl: null },
            title: "T",
            restoredFromVersionNo: null,
            tsCreatedAt: "",
            tsUpdatedAt: new Date().toISOString(),
        },
        {
            versionNo: 1,
            editor: { userId: "u2", userName: "Ann", avatarUrl: null },
            title: "T",
            restoredFromVersionNo: null,
            tsCreatedAt: "",
            tsUpdatedAt: new Date().toISOString(),
        },
    ];
    const useNM = (over: Record<string, unknown> = {}) =>
        ({
            currentNoteVersions: versions,
            currentNoteMembers: [
                { userId: "u1", userName: "Me", avatarUrl: null, roleId: 1, tsCreated: "" },
            ],
            loadNoteVersionsFor: vi.fn(),
            ...over,
        }) as never;
    const modal = (nm: never) =>
        render(
            wrap(
                <ModalNoteHistory
                    myself={myself}
                    noteId={1}
                    noteType={1}
                    open
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useNM={nm}
                    useUISM={{} as never}
                    onClose={vi.fn()}
                />
            )
        );

    it("a version that fails to load is not 'select a version'; Retry loads it", async () => {
        fail("/note/version/?");
        ok("/note/version/?", {
            versionNo: 1,
            title: "Plan v1",
            body: [],
            editor: { userId: "u2", userName: "Ann", avatarUrl: null },
            tsCreatedAt: "",
            tsUpdatedAt: "",
        });
        modal(useNM());

        expect(await screen.findByText(en.notes.history.detailLoadFailed)).toBeTruthy();
        expect(screen.queryByText(en.notes.history.selectVersionPrompt)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("Plan v1")).toBeTruthy();
        expect(screen.queryByText(en.notes.history.detailLoadFailed)).toBeNull();
        expect(hits("/note/version/?")).toBe(2);
    });

    it("a version list that failed to load says so, and Retry asks the host again", async () => {
        const loadNoteVersionsFor = vi.fn();
        modal(
            useNM({
                currentNoteVersions: [],
                currentNoteVersionsFailed: true,
                loadNoteVersionsFor,
            })
        );

        expect(await screen.findByText(en.notes.history.listLoadFailed)).toBeTruthy();
        expect(screen.queryByText(en.notes.history.emptyList)).toBeNull();

        fireEvent.click(retry());

        expect(loadNoteVersionsFor).toHaveBeenCalledWith(1, 1);
    });
});

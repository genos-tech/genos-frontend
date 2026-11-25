/**
 * MIP-2357: the dashboard form's "Save to" is ONE picker with the real places, not a kind of place
 * and a folder number: My notes, the member's own folders (nested), and each team folder they may
 * add notes to, each saying who can then open the page. The choice sets `save_to` and `folder_id`
 * together; a stored place that is no longer offered stays as "(unavailable)"; once the page exists
 * the picker is read only with one sentence (MIP-2397).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleFormPanel } from "../components/layout/schedules/ScheduleFormPanel";
import { HashMentionDataProvider } from "../context/HashMentionDataContext";
import { loadMyNoteFolders } from "../features/notes/my-notes/services/loadMyNoteFolders";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { fmt, getMessages } from "../i18n";
import type { Schedule, ScheduleJob } from "../services/schedules";
import type { UserProps } from "../types/admin";
import type { MyNoteFolderProps, TeamNoteFolderProps } from "../types/notes";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/notes/my-notes/services/loadMyNoteFolders", () => ({
    loadMyNoteFolders: vi.fn(),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNoteFolders", () => ({
    loadTeamNoteFolders: vi.fn(),
}));

const myFolders = vi.mocked(loadMyNoteFolders);
const teamFolders = vi.mocked(loadTeamNoteFolders);

const DASHBOARD: ScheduleJob = {
    job: "ai_dashboard",
    title: "Dashboard page",
    description: "One living dashboard page.",
    params: {
        kind: { type: "string", enum: ["milestone", "project", "mine"], required: true },
        period: { type: "string", enum: ["week", "month", "quarter", "year"] },
        save_to: { type: "string", enum: ["me", "personal_folder", "team_folder"] },
        folder_id: { type: "integer", minimum: 1 },
    },
};

const mine = (folderId: number, name: string, parentFolderId: number | null = null) =>
    ({ folderId, name, parentFolderId }) as MyNoteFolderProps;
const team = (folderId: number, name: string, over: Partial<TeamNoteFolderProps> = {}) =>
    ({
        folderId,
        name,
        parentFolderId: null,
        visibility: "public",
        effectiveVisibility: "public",
        myRoleId: 2,
        ownerId: "u1",
        ownerName: "Ana",
        memberCount: 3,
        tags: [],
        ...over,
    }) as TeamNoteFolderProps;

const FOLDERS = {
    mine: [mine(1, "Projects"), mine(2, "2026", 1)],
    team: [
        team(10, "Design"),
        team(11, "Leads", { effectiveVisibility: "private", visibility: "private" }),
        team(12, "Read only", { myRoleId: 3 }),
        team(13, "From a partner", { isExternal: true }),
    ],
};

const saved = (params: Schedule["params"]) =>
    ({
        id: "s-1",
        name: "Monday",
        job: "ai_dashboard",
        jobTitle: "Dashboard page",
        params,
        when: "every day at 09:00",
        frequency: "daily",
        timeOfDay: "09:00",
        enabled: true,
        deliverPush: true,
        nextRun: null,
        lastRun: null,
        lastStatus: null,
        lastError: null,
        lastResult: null,
        deliverChannelId: null,
        deliverChannel: null,
    }) as unknown as Schedule;

const me = { teamId: "t1", userId: "u1" } as UserProps;

const renderPanel = (
    params: Schedule["params"],
    extra: Partial<React.ComponentProps<typeof ScheduleFormPanel>> = {}
) => {
    const onSubmit = vi.fn(async () => ({ ok: true as const }));
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider
                value={{
                    tasks: [],
                    notes: [],
                    chats: [],
                    allChats: [],
                    projects: [],
                    todoGroups: [],
                    myself: me,
                    refresh: () => {},
                }}
            >
                <ScheduleFormPanel
                    jobs={[DASHBOARD]}
                    schedule={saved(params)}
                    timeZone="Asia/Tokyo"
                    onCancel={() => {}}
                    onSubmit={onSubmit}
                    {...extra}
                />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );
    return onSubmit;
};

const s = () => getMessages().settings.schedules;
const box = () => screen.getByRole("combobox", { name: s().paramSaveTo });
const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => expect(myFolders).toHaveBeenCalled());
    await user.click(box());
    return screen.findByRole("listbox");
};
const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: "Save changes" }));

beforeEach(() => {
    vi.clearAllMocks();
    myFolders.mockResolvedValue(FOLDERS.mine);
    teamFolders.mockResolvedValue(FOLDERS.team);
});

describe("what the picker offers", () => {
    it("shows My notes for a dashboard with no place, and nothing about a folder number", async () => {
        renderPanel({ kind: "mine" });
        expect(box()).toHaveValue(s().saveToMyNotes);
        expect(screen.queryByRole("spinbutton")).toBeNull();
        expect(screen.getByText(fmt(s().saveToReaders, { who: s().saveToOnlyYou }))).toBeTruthy();
    });

    it("lists My notes, then My folders nested, then the team folders the member may add notes to", async () => {
        const user = userEvent.setup();
        renderPanel({ kind: "mine" });
        const list = await open(user);
        const rows = within(list).getAllByRole("option");
        expect(rows.map((r) => within(r).getAllByText(/./)[0].textContent)).toEqual([
            s().saveToMyNotes,
            "Projects",
            "2026",
            "Design",
            "Leads",
        ]);
        expect(within(list).getByText(s().saveToGroupMine)).toBeTruthy();
        expect(within(list).getByText(s().saveToGroupTeam)).toBeTruthy();
        // Read only and another team's folder are not offered.
        expect(within(list).queryByText("Read only")).toBeNull();
        expect(within(list).queryByText("From a partner")).toBeNull();
    });

    it("says on each row who can open the page there", async () => {
        const user = userEvent.setup();
        renderPanel({ kind: "mine" });
        const list = await open(user);
        const row = (name: string) => within(list).getByRole("option", { name: new RegExp(name) });
        expect(within(row("Projects")).getByText(s().saveToOnlyYou)).toBeTruthy();
        // The caption, and the icon's own title, say it: at least the caption is there.
        expect(within(row("Design")).getAllByText(s().saveToTeamPublic).length).toBeGreaterThan(0);
        expect(
            within(row("Leads")).getAllByText(fmt(s().saveToTeamPrivate, { name: "Leads" })).length
        ).toBeGreaterThan(0);
    });
});

describe("choosing", () => {
    it("sets the kind of place and the folder together, and sends all the options", async () => {
        const user = userEvent.setup();
        const onSubmit = renderPanel({ kind: "mine", period: "month" });
        const list = await open(user);
        await user.click(within(list).getByRole("option", { name: /Design/ }));
        expect(box()).toHaveValue("Design");
        await save(user);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            params: { kind: "mine", period: "month", save_to: "team_folder", folder_id: 10 },
        });
    });

    it("shows a nested folder by its whole path", async () => {
        const user = userEvent.setup();
        renderPanel({ kind: "mine" });
        const list = await open(user);
        await user.click(within(list).getByRole("option", { name: /2026/ }));
        expect(box()).toHaveValue("Projects / 2026");
    });

    it("goes back to My notes with save_to me and no folder", async () => {
        const user = userEvent.setup();
        const onSubmit = renderPanel({
            kind: "mine",
            save_to: "personal_folder",
            folder_id: 1,
        });
        expect(await screen.findByDisplayValue("Projects")).toBeTruthy();
        const list = await open(user);
        await user.click(
            within(list).getByRole("option", { name: new RegExp(s().saveToMyNotes) })
        );
        await save(user);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            params: { kind: "mine", save_to: "me" },
        });
    });
});

describe("a stored place", () => {
    it("is shown by name once the lists are in", async () => {
        renderPanel({ kind: "mine", save_to: "team_folder", folder_id: 10 });
        await waitFor(() => expect(box()).toHaveValue("Design"));
    });

    it("that is no longer offered stays as (unavailable) and is kept when nothing changes", async () => {
        const user = userEvent.setup();
        const onSubmit = renderPanel({ kind: "mine", save_to: "team_folder", folder_id: 12 });
        await waitFor(() => expect(box()).toHaveValue(s().unavailable));
        await save(user);
        // Nothing changed: nothing is sent, the stored place is not touched.
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}));
    });

    it("reads Loading while the lists are on their way, not unavailable", async () => {
        myFolders.mockReturnValue(new Promise(() => {}));
        teamFolders.mockReturnValue(new Promise(() => {}));
        renderPanel({ kind: "mine", save_to: "team_folder", folder_id: 10 });
        expect(box()).toHaveValue(s().saveToLoading);
    });

    it("cannot be changed once the page exists, and says why once", async () => {
        renderPanel(
            { kind: "mine", save_to: "team_folder", folder_id: 10 },
            {
                lockedParams: {
                    keys: ["save_to", "folder_id"],
                    hint: "The page stays where it is.",
                },
            }
        );
        await waitFor(() => expect(box()).toHaveValue("Design"));
        expect(box()).toBeDisabled();
        expect(screen.getAllByText("The page stays where it is.")).toHaveLength(1);
    });
});

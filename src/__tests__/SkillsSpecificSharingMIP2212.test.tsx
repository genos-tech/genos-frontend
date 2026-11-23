/**
 * MIP-2212: "Who can use it" gains "Specific people": a list of people, mention groups, group chats
 * and projects. The draft carries the list and sends it with a save that changes it; the field
 * picks people with the shared person picker and groups from what the app already holds; the form
 * shows the field only when the choice is made; the server's answer is read as it is sent.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { MentionGroupsProvider } from "../context/MentionGroupsContext";
import { SkillDetailsForm } from "../features/genos/skills/SkillDetailsForm";
import {
    draftChanges,
    draftFrom,
    shareKey,
    validateDraft,
} from "../features/genos/skills/skillDraft";
import { parseSkill, type SkillRow, type SkillShare } from "../features/genos/skills/skillsApi";
import { SkillSharesField } from "../features/genos/skills/SkillSharesField";
import { I18nProvider } from "../i18n";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

// SkillTagsField (MIP-2211) calls useAuth and loads the tag catalog.
vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return {
        ...actual,
        fetchSkillTags: vi
            .fn()
            .mockResolvedValue({ ok: true, data: { tags: [], editable: false } }),
    };
});
vi.mock("../features/genos/skills/useEffortLevels", () => ({ useEffortLevels: () => null }));
vi.mock("../features/genos/skills/useSkillNameCheck", () => ({ useSkillNameCheck: () => null }));

const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
    id: "s1",
    teamId: "t1",
    slug: "weekly-update",
    title: "Weekly update",
    description: "",
    tags: [],
    icon: "",
    argumentHint: "",
    toolLevel: "read",
    effort: "",
    visibility: "private",
    status: "active",
    moderationReason: "",
    currentVersionNo: 1,
    publishedVersionNo: 0,
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
    mine: true,
    role: "owner",
    canEdit: true,
    canManage: true,
    canHide: false,
    hiddenByTeam: false,
    ownerName: "ken",
    author: null,
    starCount: 0,
    runCount30d: 0,
    copyCount: 0,
    isOfficial: false,
    starred: false,
    editors: [],
    shares: [],
    forkedFrom: null,
    noteId: 12,
    hasUnpublishedChanges: false,
    unpublishedChanges: [],
    ...over,
});

const share = (over: Partial<SkillShare>): SkillShare => ({
    kind: "user",
    id: "u-ann",
    name: "Ann",
    memberCount: null,
    available: true,
    ...over,
});

// ─── the draft ────────────────────────────────────────────────────────────────────────────────

describe("the draft", () => {
    it("reads 'specific' and its list from the skill", () => {
        const draft = draftFrom(
            skill({
                visibility: "specific",
                shares: [share({}), share({ kind: "project", id: "7" })],
            })
        );
        expect(draft.visibility).toBe("specific");
        expect(draft.shares.map(shareKey)).toEqual(["user:u-ann", "project:7"]);
    });

    it("sends the list with the visibility when the skill becomes specific", () => {
        const saved = skill();
        const draft = {
            ...draftFrom(saved),
            visibility: "specific" as const,
            shares: [share({})],
        };
        expect(draftChanges(draft, saved)).toEqual({
            visibility: "specific",
            shares: [{ kind: "user", id: "u-ann" }],
        });
    });

    it("sends only the identity of each share, never the names or counts", () => {
        const saved = skill({ visibility: "specific", shares: [share({})] });
        const draft = draftFrom(saved);
        draft.shares = [
            ...draft.shares,
            share({ kind: "groupChat", id: "c1", name: "Design", memberCount: 4 }),
        ];
        const changes = draftChanges(draft, saved);
        expect(changes.shares).toEqual([
            { kind: "user", id: "u-ann" },
            { kind: "groupChat", id: "c1" },
        ]);
        expect(Object.keys(changes)).toEqual(["shares"]);
    });

    it("is clean when the list is the same in another order, and sends nothing then", () => {
        const a = share({});
        const b = share({ kind: "mentionGroup", id: "3", name: "@design" });
        const saved = skill({ visibility: "specific", shares: [a, b] });
        const draft = draftFrom(saved);
        draft.shares = [b, a];
        expect(draftChanges(draft, saved)).toEqual({});
    });

    it("sends no list for a co-editor's save (they never see it)", () => {
        const saved = skill({
            role: "editor",
            canManage: false,
            visibility: "specific",
            shares: [],
        });
        const draft = { ...draftFrom(saved), title: "New title" };
        expect(draftChanges(draft, saved)).toEqual({ title: "New title" });
    });

    it("keeps the list when another choice is selected, so a mis-click loses nothing", () => {
        const saved = skill({ visibility: "specific", shares: [share({})] });
        const draft = { ...draftFrom(saved), visibility: "team" as const };
        expect(draftChanges(draft, saved)).toEqual({ visibility: "team" });
        expect(draft.shares).toHaveLength(1);
    });

    it("refuses 'specific' with nobody chosen, before the server is asked", () => {
        expect(validateDraft({ ...draftFrom(skill()), visibility: "specific" }).shares).toBe(
            "empty"
        );
        expect(
            validateDraft({ ...draftFrom(skill()), visibility: "specific", shares: [share({})] })
                .shares
        ).toBeUndefined();
        expect(
            validateDraft({ ...draftFrom(skill()), visibility: "team" }).shares
        ).toBeUndefined();
    });
});

describe("the server's answer", () => {
    it("is read into chips, and a malformed entry is dropped", () => {
        const parsed = parseSkill({
            id: "s1",
            visibility: "specific",
            shares: [
                { kind: "user", id: "u1", name: "Ann", memberCount: null, available: true },
                { kind: "groupChat", id: "c1", name: "Design", memberCount: 4, available: true },
                { kind: "project", id: "7", name: "", memberCount: 2, available: false },
                { kind: "team", id: "x" },
                { kind: "user" },
                "nope",
            ],
        });
        expect(parsed?.visibility).toBe("specific");
        expect(
            parsed?.shares.map((s) => [s.kind, s.id, s.name, s.memberCount, s.available])
        ).toEqual([
            ["user", "u1", "Ann", null, true],
            ["groupChat", "c1", "Design", 4, true],
            ["project", "7", "", 2, false],
        ]);
    });

    it("has no list for a reader", () => {
        expect(parseSkill({ id: "s1", visibility: "specific" })?.shares).toEqual([]);
    });
});

// ─── the field ────────────────────────────────────────────────────────────────────────────────

const members = [
    { userId: "me", userName: "Me", userEmail: "me@x.test" },
    { userId: "u-ann", userName: "Ann", userEmail: "ann@x.test" },
    { userId: "u-bob", userName: "Bob", userEmail: "bob@x.test" },
] as unknown as UserProps[];

const chat = (over: Partial<AllChatProps>): AllChatProps =>
    ({ chatType: 2, chatId: "c1", chatName: "Design chat", ...over }) as AllChatProps;

const chats: AllChatProps[] = [
    chat({}),
    chat({ chatId: "c-ext", chatName: "Shared out", isExternal: true }),
    chat({ chatId: "dm1", chatName: "A DM", chatType: 1 }),
    chat({
        chatId: "pm7",
        chatName: "Rocket",
        chatType: 3,
        project: { projectId: 7 } as AllChatProps["project"],
    }),
];

const groupsApi = {
    mentionGroups: [{ groupId: 3, groupName: "design", memberCount: 5, memberUserIds: [] }],
    loading: false,
    refresh: async () => {},
    createGroup: async () => null,
    updateGroup: async () => null,
    deleteGroup: () => {},
    addMembers: async () => false,
    removeMember: async () => false,
} as never;

const wrap = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: () => {},
            teamMemberProfiles: {},
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>
            <I18nProvider>
                <MentionGroupsProvider value={groupsApi}>{node}</MentionGroupsProvider>
            </I18nProvider>
        </CssVarsProvider>
    </AvatarContextProvider>
);

const field = (shares: SkillShare[], onChange = vi.fn(), extra: { disabled?: boolean } = {}) => {
    render(
        wrap(
            <SkillSharesField
                allChats={chats}
                myId="me"
                shares={shares}
                teamMembers={members}
                onChange={onChange}
                {...extra}
            />
        )
    );
    return onChange;
};

afterEach(cleanup);

describe("the Specific people field", () => {
    it("says nobody is chosen yet", () => {
        field([]);
        expect(screen.getByText("Nobody chosen yet.")).toBeTruthy();
    });

    it("shows a chip per share, a group with how many are in it now", () => {
        field([
            share({}),
            share({ kind: "mentionGroup", id: "3", name: "@design", memberCount: 5 }),
            share({ kind: "groupChat", id: "c1", name: "Design chat", memberCount: 4 }),
            share({ kind: "project", id: "7", name: "Rocket", memberCount: null }),
        ]);
        expect(screen.getByText("Ann")).toBeTruthy();
        expect(screen.getByText("@design · 5 people now")).toBeTruthy();
        expect(screen.getByText("Design chat · 4 people now")).toBeTruthy();
        expect(screen.getByText("Rocket · Project")).toBeTruthy();
    });

    it("says so when a chat or project can no longer be seen", () => {
        field([share({ kind: "groupChat", id: "gone", name: "", available: false })]);
        expect(screen.getByText(/A chat or project you can no longer see/)).toBeTruthy();
    });

    it("removes a chip", async () => {
        const onChange = field([share({}), share({ kind: "project", id: "7", name: "Rocket" })]);
        await userEvent.click(screen.getByRole("button", { name: "Remove Ann" }));
        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ kind: "project", id: "7" }),
        ]);
    });

    it("adds a person with the shared person picker, never the owner or someone already chosen", async () => {
        const onChange = field([share({ id: "u-ann", name: "Ann" })]);
        await userEvent.click(screen.getByRole("combobox", { name: "Add a person" }));
        const names = screen.getAllByRole("option").map((o) => o.textContent);
        expect(names).toHaveLength(1);
        expect(names[0]).toMatch(/Bob/);
        await userEvent.click(screen.getByRole("option", { name: /Bob/ }));
        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: "u-ann" }),
            expect.objectContaining({ kind: "user", id: "u-bob", name: "Bob" }),
        ]);
    });

    it("offers mention groups, group chats and projects, but no DM and no chat shared with another team", async () => {
        const onChange = field([]);
        await userEvent.click(
            screen.getByRole("combobox", { name: "Add a group, chat or project" })
        );
        const listbox = screen.getByRole("listbox");
        const options = within(listbox)
            .getAllByRole("option")
            .map((o) => o.textContent ?? "");
        expect(options.some((o) => o.includes("@design") && o.includes("5 people now"))).toBe(
            true
        );
        expect(options.some((o) => o.includes("Design chat") && o.includes("Group chat"))).toBe(
            true
        );
        expect(options.some((o) => o.includes("Rocket") && o.includes("Project"))).toBe(true);
        expect(options.some((o) => o.includes("Shared out"))).toBe(false);
        expect(options.some((o) => o.includes("A DM"))).toBe(false);
        await userEvent.click(within(listbox).getByRole("option", { name: /Rocket/ }));
        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({ kind: "project", id: "7", name: "Rocket" }),
        ]);
    });

    it("does not offer a group that is already chosen", async () => {
        field([share({ kind: "groupChat", id: "c1", name: "Design chat" })]);
        await userEvent.click(
            screen.getByRole("combobox", { name: "Add a group, chat or project" })
        );
        const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
        expect(options.some((o) => o.includes("Design chat"))).toBe(false);
    });

    it("cannot be changed while the skill is read-only", () => {
        field([share({})], vi.fn(), { disabled: true });
        expect(screen.queryByRole("button", { name: "Remove Ann" })).toBeNull();
        expect(screen.queryByRole("combobox", { name: "Add a person" })).toBeNull();
    });

    it("shows the sentence a save asked for when nobody is chosen", () => {
        render(
            wrap(
                <SkillSharesField
                    allChats={chats}
                    myId="me"
                    problem="Choose at least one person or group, or pick Only me."
                    shares={[]}
                    teamMembers={members}
                    onChange={() => {}}
                />
            )
        );
        expect(screen.getByText(/Choose at least one person or group/)).toBeTruthy();
    });
});

// ─── in the form ──────────────────────────────────────────────────────────────────────────────

describe("the details form", () => {
    const form = (visibility: "private" | "team" | "specific", ownerOnly = false) => {
        const s = skill();
        const onChange = vi.fn();
        render(
            wrap(
                <SkillDetailsForm
                    disabled={false}
                    draft={{ ...draftFrom(s), visibility }}
                    ownerOnly={ownerOnly}
                    problems={{}}
                    serverProblems={{}}
                    sharesField={<div data-testid="shares-field" />}
                    skill={s}
                    onChange={onChange}
                />
            )
        );
        return onChange;
    };

    it("has a third choice, and picking it selects it", async () => {
        const onChange = form("private");
        await userEvent.click(screen.getByRole("button", { name: "Specific people" }));
        expect(onChange).toHaveBeenCalledWith({ visibility: "specific" });
    });

    it("draws the list under the choice only when it is chosen", () => {
        form("team");
        expect(screen.queryByTestId("shares-field")).toBeNull();
        cleanup();
        form("specific");
        expect(screen.getByTestId("shares-field")).toBeTruthy();
    });

    it("a co-editor sees the choice locked and no list", () => {
        form("specific", true);
        expect(screen.queryByTestId("shares-field")).toBeNull();
        expect(
            screen.getByText("Only the owner changes who this skill is shared with.")
        ).toBeTruthy();
    });
});

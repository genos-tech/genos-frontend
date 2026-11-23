/**
 * MIP-2175: the Inbox item card, refreshed. Requests and Activities are one calm row: the
 * person's real avatar (or the Genos mark, or the type's tile) in the left column, one title
 * line, the type folded into a context line, the time and unread dot aligned at the right, and
 * the answer buttons right under the text. Every request type still renders and still answers
 * the way it did (socket event for types 1-4, HTTP for 5, 7, 8).
 *
 * jsdom cannot paint a layout: the look itself is checked in a real browser (screenshots in the
 * PR); this file pins the structure and every behaviour.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { findActor, joinTitleKey, splitAroundName } from "../features/inbox/components/inboxActor";
import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { en } from "../i18n/locales/en";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const claim = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/ownershipClaim", () => ({
    respondToOwnershipClaim: (...a: unknown[]) => claim(...a),
}));
const connection = vi.fn().mockResolvedValue(true);
const share = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/teamConnections", () => ({
    respondToTeamConnection: (...a: unknown[]) => connection(...a),
    respondToExternalShare: (...a: unknown[]) => share(...a),
}));
const persisted = vi.fn().mockResolvedValue(null);
vi.mock("../features/admin/services/addInboxItem", () => ({
    addInboxItem: (...a: unknown[]) => persisted(...a),
}));

const item = (itemType: number, extra: Partial<InboxItemProps> = {}): InboxItemProps => ({
    itemId: 100 + itemType,
    itemType,
    itemBody: [{ content: [{ text: "someone is asking" }] }],
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-30T00:00:00Z",
    itemOptionals: { connection_id: "c1", grant_id: "g1", deadline: "2026-08-29T00:00:00Z" },
    ...extra,
});

/** A body the way sockets writes it: a mention, the sentence, the filler paragraph. */
const mentionBody = (userId: string, userName: string, sentence: string) => [
    {
        type: "paragraph",
        content: [
            { type: "mention", props: { userId, userName, userEmail: "", avatarImgPath: "" } },
            { type: "text", text: sentence, styles: {} },
        ],
    },
    {
        type: "paragraph",
        content: [{ type: "text", text: "Waiting for your approval...", styles: {} }],
    },
    { type: "paragraph", content: [] },
];

const baseProps = {
    myself: { userId: "u1", teamId: "t1" } as never,
    setMyself: vi.fn(),
    useCM: { allChats: [] } as never,
    useTEM: { teamMemberProfiles: {} } as never,
    useUISM: {} as never,
};

const mount = (i: InboxItemProps, socket: unknown = null, withAvatars = false) => {
    const card = (
        <InboxBubble
            {...baseProps}
            inboxItem={i}
            socket={socket as never}
            onItemChanged={vi.fn()}
        />
    );
    return render(
        <CssVarsProvider>
            {withAvatars ? (
                <AvatarContextProvider
                    value={{
                        myself: { userId: "u1", teamId: "t1", userName: "Me" } as never,
                        setMyself: () => {},
                        teamMemberProfiles: {
                            "u-sam": {
                                userId: "u-sam",
                                userName: "Sam Okafor",
                                avatarImgPath: "https://img.example/sam.png",
                            } as never,
                        },
                        setTeamMemberProfiles: () => {},
                        socket: null,
                        useCM: {} as never,
                        useUISM: {} as never,
                    }}
                >
                    {card}
                </AvatarContextProvider>
            ) : (
                card
            )}
        </CssVarsProvider>
    );
};

const SOCKET_EVENTS: Record<number, [string, string]> = {
    1: ["approve_join_team_request", "reject_join_team_request"],
    2: ["approve_join_project_request", "reject_join_project_request"],
    3: ["approve_join_gm_request", "reject_join_gm_request"],
    4: ["approve_note_access_request", "reject_note_access_request"],
};

const LABELS: Record<number, string> = {
    1: "Team request",
    2: "Project request",
    3: "Group chat request",
    4: "Note access",
    5: "Ownership claim",
    7: "Team connection",
    8: "Shared with your team",
};

describe("every request type is the shared row", () => {
    it.each([1, 2, 3, 4, 5, 7, 8])(
        "type %i: its mark, its short type name, time, unread dot, Approve and Reject",
        (type) => {
            const { container } = mount(item(type));
            expect(container.querySelector('[data-bubble-layout="compact"]')).not.toBeNull();
            // No person to show in this body: the type's tile fills the avatar column.
            expect(container.querySelector("[data-inbox-tile-tone]")).not.toBeNull();
            expect(screen.getByText(LABELS[type])).toBeTruthy();
            expect(screen.getByTestId("inbox-unread-dot")).toBeTruthy();
            expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
            expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
        }
    );

    it.each([1, 2, 3, 4])("type %i still answers over the socket", (type) => {
        const emit = vi.fn();
        mount(item(type), { emit });
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS[type][0], { item_id: 100 + type });
        // answered: the dot and the buttons go, a quiet status stays
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
        expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
        expect(screen.getByTestId("inbox-request-status").textContent).toBe("Approved");
    });

    it.each([1, 2, 3, 4])("type %i reject emits the reject event", (type) => {
        const emit = vi.fn();
        mount(item(type), { emit });
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS[type][1], { item_id: 100 + type });
        expect(screen.getByTestId("inbox-request-status").textContent).toBe("Rejected");
    });

    it.each([
        [5, claim],
        [7, connection],
        [8, share],
    ])("type %i still answers over HTTP and persists the answer", async (type, fn) => {
        mount(item(type));
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(fn).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByTestId("inbox-unread-dot")).toBeNull());
        expect(persisted).toHaveBeenCalledWith(
            expect.objectContaining({
                itemId: 100 + type,
                requestStatus: "approved",
                isRead: true,
            })
        );
    });

    it("a request answered elsewhere shows its status and neither buttons nor dot", () => {
        mount(item(2, { requestStatus: "rejected" }));
        expect(screen.getByTestId("inbox-request-status").textContent).toBe("Rejected");
        expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
    });

    it("answering a request is not opening the card", () => {
        const emit = vi.fn();
        const open = vi.fn();
        render(
            <CssVarsProvider>
                {/* the list's row: a click that reaches it opens the card */}
                <div onClick={open}>
                    <InboxBubble
                        {...baseProps}
                        inboxItem={item(1)}
                        socket={{ emit } as never}
                        onItemChanged={vi.fn()}
                    />
                </div>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(emit).toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
    });
});

describe("a join request says one short sentence with the person's name bold", () => {
    it.each([
        [1, " wants to join Acme team.", "wants to join the team"],
        [2, " wants to join project - X.", "wants to join the project"],
        [3, " wants to join GM - X.", "wants to join the group chat"],
        [4, " is requesting access to the note - X.", "wants access to your note"],
    ])("type %i", (type, stored, shown) => {
        const { container } = mount(
            item(type, { itemBody: mentionBody("u-sam", "Sam Okafor", stored) })
        );
        const bold = container.querySelector("strong");
        expect(bold?.textContent).toBe("Sam Okafor");
        expect(container.textContent).toContain(`Sam Okafor${shown ? " " : ""}${shown}`);
        // the server's English sentence and its filler are not shown
        expect(container.textContent).not.toContain("Waiting for your approval");
        expect(container.textContent).not.toContain(stored.trim());
    });

    it("still names the project or chat when the card cannot open it", () => {
        // `allChats` is empty here, so the target link resolves to nothing.
        mount(
            item(2, {
                itemBody: mentionBody("u-sam", "Sam Okafor", " wants to join project - Apollo."),
                itemOptionals: { project_id: 7, project_name: "Apollo launch" },
            })
        );
        expect(screen.getByText("Apollo launch")).toBeTruthy();
    });

    it("reads the target from the body's bold run on a row that stored no name", () => {
        const body = mentionBody("u-sam", "Sam Okafor", " wants to join GM - ");
        (body[0].content as unknown[]).push({
            type: "text",
            text: "design-crit",
            styles: { bold: true },
        });
        mount(item(3, { itemBody: body, itemOptionals: { gm_id: "gm-9" } }));
        expect(screen.getByText("design-crit")).toBeTruthy();
    });

    it("still names a task or chat note, which the card cannot open", () => {
        mount(
            item(4, {
                itemBody: mentionBody("u-sam", "Sam Okafor", " is requesting access to the note"),
                itemOptionals: { note_type: 2, note_id: 5, note_title: "Launch checklist" },
            })
        );
        expect(screen.getByText("Launch checklist")).toBeTruthy();
    });

    it("keeps the stored body when the body names nobody", () => {
        const { container } = mount(item(1));
        expect(container.querySelector("strong")).toBeNull();
        expect(screen.getByTestId("bn-preview")).toBeTruthy();
    });

    it("shows the person's real avatar, with the initial while the picture loads", () => {
        const { container } = mount(
            item(1, { itemBody: mentionBody("u-sam", "Sam Okafor", " wants to join") }),
            null,
            true
        );
        expect(container.querySelector(".MuiAvatar-root")).not.toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            "https://img.example/sam.png"
        );
        // a person, not the type's tile
        expect(container.querySelector("[data-inbox-tile-tone]")).toBeNull();
    });

    it("without an avatar context the initial stands in instead of throwing", () => {
        const { container } = mount(
            item(1, { itemBody: mentionBody("u-sam", "Sam Okafor", " wants to join") })
        );
        expect(container.querySelector(".MuiAvatar-root")?.textContent).toBe("S");
    });
});

describe("Activities share the row", () => {
    it("an activity naming a person gets that person's avatar, the dot and the read toggle", () => {
        const { container } = mount(
            item(0, {
                itemBody: mentionBody("u-sam", "Sam Okafor", " commented on your task"),
                itemOptionals: {},
            }),
            null,
            true
        );
        expect(container.querySelector('[data-bubble-layout="compact"]')).not.toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            "https://img.example/sam.png"
        );
        expect(screen.getByTestId("inbox-unread-dot")).toBeTruthy();
        expect(screen.getByTestId("inbox-read-toggle")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    });

    it("what Genos wrote wears the Genos mark", () => {
        mount(
            item(10, {
                itemBody: { title: "Weekly", text: "All clear", sections: [] } as never,
                itemOptionals: { kind: "report" },
            })
        );
        expect(screen.getByAltText("Genos Logo")).toBeTruthy();
        expect(screen.getByText("Genos report")).toBeTruthy();
    });

    it("a read activity has no dot", () => {
        mount(item(0, { isRead: true, itemOptionals: {} }));
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
    });
});

describe("findActor and the composed sentence", () => {
    it("reads the first mention of the opening paragraph", () => {
        expect(findActor(mentionBody("u-sam", "Sam Okafor", " hi"))).toEqual({
            userId: "u-sam",
            userName: "Sam Okafor",
        });
    });

    it("is null for a body with no mention, no blocks, or a mention with no id", () => {
        expect(findActor([{ content: [{ text: "plain" }] }])).toBeNull();
        expect(findActor({ title: "t", text: "x" } as never)).toBeNull();
        expect(findActor(null as never)).toBeNull();
        expect(findActor(mentionBody("", "Nobody", " hi"))).toBeNull();
    });

    it("composes a sentence only for the four join types and only with a name", () => {
        const actor = { userId: "u", userName: "Sam" };
        expect(joinTitleKey(1, actor)).toBe("joinTeam");
        expect(joinTitleKey(2, actor)).toBe("joinProject");
        expect(joinTitleKey(3, actor)).toBe("joinGm");
        expect(joinTitleKey(4, actor)).toBe("noteAccess");
        expect(joinTitleKey(5, actor)).toBeNull();
        expect(joinTitleKey(0, actor)).toBeNull();
        expect(joinTitleKey(1, null)).toBeNull();
        expect(joinTitleKey(1, { userId: "u", userName: "" })).toBeNull();
    });

    it("splits a template around the name wherever the language puts it", () => {
        expect(splitAroundName("{name} wants in")).toEqual(["", " wants in"]);
        expect(splitAroundName("Request from {name}.")).toEqual(["Request from ", "."]);
        expect(splitAroundName("no token")).toEqual(["no token", ""]);
    });

    it("the English strings are the wording the card shows", () => {
        expect(en.inbox.card.joinTeam).toBe("{name} wants to join the team");
    });
});

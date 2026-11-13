/**
 * MIP-1333: a "Messages sent" line wears the chat's own avatar, or the generic emoji.
 *
 * Drawn through the real `GenosReportBody` (parse, lookup in the member's chats, card). Layout
 * is checked by eye in the browser, not here (jsdom has no layout); these pin what is drawn:
 * which avatar for which chat type, the fallback, that the slot is decorative and holds nothing
 * focusable, and that the line reads the same to a screen reader.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { GenosReportBody } from "../features/inbox/components/GenosReportBody";
import type { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

afterEach(cleanup);

const GM = "11111111-1111-4111-8111-111111111111";
const PM = "22222222-2222-4222-8222-222222222222";
const MDM = "33333333-3333-4333-8333-333333333333";
const DM = "44444444-4444-4444-8444-444444444444";
const SELF = "55555555-5555-4555-8555-555555555555";
const GONE = "66666666-6666-4666-8666-666666666666";

const me = {
    userId: "me",
    userName: "Me Myself",
    userEmail: "me@x.test",
    teamId: "t1",
    avatarImgPath: "https://m.example/me.png",
} as unknown as UserProps;
const ada = {
    userId: "u-ada",
    userName: "Ada Lovelace",
    userEmail: "ada@x.test",
    teamId: "t1",
    avatarImgPath: "https://m.example/ada.png",
} as unknown as UserProps;

const chats = [
    { chatType: 1, chatId: DM, chatName: "Ada Lovelace", dmPartnerUser: ada },
    { chatType: 1, chatId: SELF, chatName: "Me Myself", dmPartnerUser: me },
    {
        chatType: 2,
        chatId: GM,
        chatName: "Design crew",
        dmPartnerUser: { userId: "" },
        profileImagePath: "https://m.example/gm.png",
    },
    {
        chatType: 3,
        chatId: PM,
        chatName: "Genos",
        dmPartnerUser: { userId: "" },
        project: { projectId: 3 },
        profileImagePath: "https://m.example/pm.png",
    },
    { chatType: 4, chatId: MDM, chatName: "Ada, Bob", dmPartnerUser: { userId: "" } },
];

const line = (kind: string, id: string, text: string, extra: Record<string, unknown> = {}) => ({
    text,
    kind: "chat",
    link: `/workspace/chat/${kind}/${id}`,
    ...extra,
});

const body = (items: unknown[]) => ({
    version: 2,
    title: "Wrap up",
    sections: [{ heading: "Messages sent", key: "messages", emoji: "💬", items }],
});

const renderBody = (items: unknown[], opts: { context?: boolean; allChats?: unknown[] } = {}) => {
    const { context = true, allChats = chats } = opts;
    const card = (
        <MemoryRouter>
            <GenosReportBody allChats={allChats as never} itemBody={body(items)} />
        </MemoryRouter>
    );
    return render(
        <CssVarsProvider>
            {context ? (
                <AvatarContextProvider
                    value={{
                        myself: me,
                        setMyself: () => {},
                        teamMemberProfiles: { "u-ada": ada },
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

/** The row (`<a>`, or a `<div>` for a line with no link) of the line with this text, and the icon slot in it. */
const rowOf = (container: HTMLElement, text: string): HTMLElement => {
    const row = [...container.querySelectorAll("li > a, li > div")].find((a) =>
        a.textContent?.includes(text)
    );
    if (!row) throw new Error(`no row with "${text}"`);
    return row as HTMLElement;
};
const slotOf = (row: HTMLElement) => row.querySelector<HTMLElement>("[data-report-chat-icon]");

describe("a chat line's icon", () => {
    it("DM: the other person's avatar (their picture from the roster), not the emoji", () => {
        const { container } = renderBody([line("dm", DM, "Ada Lovelace: 2 messages")]);
        const row = rowOf(container, "Ada Lovelace");
        const slot = slotOf(row);
        expect(slot).not.toBeNull();
        expect(slot!.querySelector("img")?.getAttribute("src")).toBe("https://m.example/ada.png");
        expect(row.textContent).not.toContain("💬");
    });

    it("self-DM: the viewer's own picture", () => {
        const { container } = renderBody([line("dm", SELF, "Me Myself: 1 message")]);
        const img = slotOf(rowOf(container, "Me Myself"))!.querySelector("img");
        expect(img?.getAttribute("src")).toBe("https://m.example/me.png");
    });

    it("a DM whose partner is not in the roster yet still gets an avatar (the name's letter)", () => {
        const stranger = {
            chatType: 1,
            chatId: DM,
            chatName: "Zed",
            dmPartnerUser: { userId: "u-zed", userName: "Zed Zebra" },
        };
        const { container } = renderBody([line("dm", DM, "Zed: 1 message")], {
            allChats: [stranger],
        });
        const slot = slotOf(rowOf(container, "Zed"))!;
        expect(slot.textContent).toBe("Z");
    });

    it("group chat: its group picture", () => {
        const { container } = renderBody([line("gm", GM, "Design crew: 4 messages")]);
        const slot = slotOf(rowOf(container, "Design crew"))!;
        expect(slot.querySelector("img")?.getAttribute("src")).toBe("https://m.example/gm.png");
    });

    it("group chat with no picture: the group icon, as the chat list", () => {
        const noPic = [{ ...chats[2], profileImagePath: undefined }];
        const { container } = renderBody([line("gm", GM, "Design crew: 4 messages")], {
            allChats: noPic,
        });
        const slot = slotOf(rowOf(container, "Design crew"))!;
        expect(slot.querySelector("img")).toBeNull();
        expect(slot.querySelector('svg[data-testid="GroupsIcon"]')).not.toBeNull();
    });

    it("project chat: the project's picture", () => {
        const { container } = renderBody([line("pm", PM, "Genos: 3 messages")]);
        const slot = slotOf(rowOf(container, "Genos"))!;
        expect(slot.querySelector("img")?.getAttribute("src")).toBe("https://m.example/pm.png");
    });

    it("project chat with no picture: the project icon", () => {
        const noPic = [{ ...chats[3], profileImagePath: undefined }];
        const { container } = renderBody([line("pm", PM, "Genos: 3 messages")], {
            allChats: noPic,
        });
        const slot = slotOf(rowOf(container, "Genos"))!;
        expect(slot.querySelector('svg[data-testid="AssignmentIcon"]')).not.toBeNull();
    });

    it("multi-person DM: the people mark", () => {
        const { container } = renderBody([line("mdm", MDM, "Ada, Bob: 2 messages")]);
        const slot = slotOf(rowOf(container, "Ada, Bob"))!;
        expect(slot.querySelector('svg[data-testid="PeopleRoundedIcon"]')).not.toBeNull();
    });
});

describe("the fallback: the generic emoji, no slot, no throw", () => {
    it.each([
        ["a chat the member is not in", line("gm", GONE, "Old room: 2 messages")],
        [
            "an unknown chat type",
            { ...line("gm", GM, "Odd: 1 message"), link: `/workspace/chat/zz/${GM}` },
        ],
        [
            "a malformed link",
            { ...line("gm", GM, "Junk: 1 message"), link: "/workspace/chat/gm/" },
        ],
        [
            "a link that is not a chat",
            { ...line("gm", GM, "Task-ish: 1 message"), link: "/workspace/tasks/1" },
        ],
        ["no link", { text: "Linkless: 1 message", kind: "chat" }],
        ["a gm link whose id is a DM", line("gm", DM, "Crossed: 1 message")],
    ])("%s", (_name, item) => {
        const { container } = renderBody([item]);
        const row = rowOf(container, String((item as { text: string }).text.split(":")[0]));
        expect(slotOf(row)).toBeNull();
        expect(row.textContent).toContain("💬");
    });

    it("a DM outside the avatar context keeps an emoji in the slot (never a blank)", () => {
        const { container } = renderBody([line("dm", DM, "Ada Lovelace: 2 messages")], {
            context: false,
        });
        const row = rowOf(container, "Ada Lovelace");
        expect(row.textContent).toContain("💬");
        expect(row.querySelector("img")).toBeNull();
    });

    it("a chat link on a line that is not kind chat gets no avatar", () => {
        const { container } = renderBody([
            { text: "Note about a chat", kind: "note", link: `/workspace/chat/gm/${GM}` },
        ]);
        const row = rowOf(container, "Note about a chat");
        expect(slotOf(row)).toBeNull();
        expect(row.textContent).toContain("📝");
    });

    it("never draws text from the link", () => {
        const evil = `/workspace/chat/gm/${GM}?x=<img src=x onerror=alert(1)>`;
        const { container } = renderBody([{ text: "Safe text", kind: "chat", link: evil }]);
        // The link is refused by the report parser (whitespace/markup), so the line is plain.
        expect(container.innerHTML).not.toContain("onerror");
    });
});

describe("accessibility: the avatar is decorative", () => {
    it("is aria-hidden, has no focusable element and no accessible image name", () => {
        const { container } = renderBody([
            line("dm", DM, "Ada Lovelace: 2 messages"),
            line("gm", GM, "Design crew: 4 messages"),
            line("pm", PM, "Genos: 3 messages"),
            line("mdm", MDM, "Ada, Bob: 2 messages"),
        ]);
        const slots = container.querySelectorAll<HTMLElement>("[data-report-chat-icon]");
        expect(slots.length).toBe(4);
        for (const slot of slots) {
            expect(slot.getAttribute("aria-hidden")).toBe("true");
            expect(
                slot.querySelector("button, a, input, select, textarea, [tabindex]")
            ).toBeNull();
        }
    });

    it("the row reads the same as before: its text is the chat's name and count, nothing more", () => {
        const withAvatar = renderBody([line("gm", GM, "Design crew: 4 messages")]);
        const a = rowOf(withAvatar.container, "Design crew");
        // Everything inside the slot is hidden from a reader, so the readable text is the line.
        const readable = [...a.children]
            .filter((el) => el.getAttribute("aria-hidden") !== "true")
            .map((el) => el.textContent)
            .join("");
        expect(readable).toBe("Design crew: 4 messages");
        cleanup();
        const emoji = renderBody([line("gm", GONE, "Design crew: 4 messages")]);
        const b = rowOf(emoji.container, "Design crew");
        const readableB = [...b.children]
            .filter((el) => el.getAttribute("aria-hidden") !== "true")
            .map((el) => el.textContent)
            .join("");
        expect(readableB).toBe(readable);
    });
});

/* eslint-disable react-refresh/only-export-components -- a page entry, nothing imports it */
/**
 * The page the real-browser probe loads (`TouchTargetsChatListMIP1515.test.ts`): the REAL
 * `ChatListItem` (so the real `NavItem`, `ChatListItemActions`, avatar) and the REAL `ChatSearch`,
 * inside the app's theme, with seeded chats and no backend. Not part of the app bundle: nothing
 * imports this file, and Vite only serves it to the probe.
 *
 * `?mode=dark` selects the dark scheme. Every tap is logged by a capture listener on
 * `window.__taps` as "which control got it", so a probe can see what a real touch reached.
 */
import "@fontsource-variable/geist/index.css";
import "../../index.css";

import { useEffect, useRef } from "react";
import { List } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { AvatarContextProvider } from "../../components/ui/avatars/AvatarContext";
import { ChatListItem } from "../../features/chat/components/sidebar/chatListItem";
import { ChatSearch } from "../../features/chat/components/sidebar/ChatSearch";
import { I18nProvider } from "../../i18n";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";
import type { UserProps } from "../../types/admin";
import type { AllChatProps } from "../../types/chat";

const NOOP = () => {};
const ME = {
    userId: "u1",
    userName: "Me Myself",
    customStatus: "",
    tsJoined: "2026-01-02 03:04:05",
} as unknown as UserProps;
const ADA = {
    userId: "u2",
    userName: "Ada Lovelace",
    tsJoined: "2026-01-02 03:04:05",
} as unknown as UserProps;
const BEN = {
    userId: "u3",
    userName: "Ben Ito",
    tsJoined: "2026-01-02 03:04:05",
} as unknown as UserProps;
const PROFILES = { u1: ME, u2: ADA, u3: BEN } as Record<string, UserProps>;

const chat = (over: Partial<AllChatProps>): AllChatProps =>
    ({
        chatType: 1,
        isPinned: false,
        isPrivate: false,
        lastReadMessageId: "10",
        latestMessageText: "See you at the stand-up",
        latestMessage: { messageId: 10, tsSent: "2026-11-14 10:00:00" },
        ...over,
    }) as unknown as AllChatProps;

// A plain DM (its pin is a NON-keep action: the one NavItem forces `position: static` on), a
// pinned DM (a keep action), a DM with a long name and an unread dot, and a self-DM (to-do button).
const CHATS: AllChatProps[] = [
    chat({ chatId: "c-ada", chatName: "Ada Lovelace", dmPartnerUser: ADA }),
    chat({ chatId: "c-ben", chatName: "Ben Ito", isPinned: true, dmPartnerUser: BEN }),
    chat({
        chatId: "c-long",
        chatName: "Ada Lovelace",
        dmPartnerUser: ADA,
        latestMessageText: "A very long preview line that has to be cut off at the row's end",
        lastReadMessageId: "3",
    }),
    chat({ chatId: "c-me", chatName: "Me Myself", dmPartnerUser: ME }),
];

const live = {
    current: {
        useCM: { funcSetAllChats: NOOP, setCurrentMainChat: NOOP, setIsMainChatVisible: NOOP },
        useTM: {},
    },
};
const USE_TEM = { teamMemberProfiles: PROFILES } as never;

const Page = () => {
    const { setMode } = useColorScheme();
    const mode =
        new URLSearchParams(window.location.search).get("mode") === "dark" ? "dark" : "light";
    useEffect(() => setMode(mode), [mode, setMode]);
    const tapped = useRef(false);
    useEffect(() => {
        if (tapped.current) return;
        tapped.current = true;
        const w = window as unknown as { __taps: string[] };
        w.__taps = [];
        document.addEventListener(
            "click",
            (e) => {
                const el = e.target as HTMLElement;
                const btn = el.closest("button, [role='button']") as HTMLElement | null;
                const kind = !btn
                    ? "none"
                    : btn.closest(".NavItem-actions")
                      ? `action:${btn.getAttribute("aria-label") ?? "pin"}`
                      : btn.parentElement?.parentElement?.getAttribute("data-testid") ===
                          "chat-list"
                        ? "row"
                        : btn.closest("[data-testid='chat-list']")
                          ? "avatar"
                          : "search";
                w.__taps.push(kind);
            },
            true
        );
    }, []);
    return (
        <AvatarContextProvider
            value={{
                myself: ME,
                setMyself: NOOP,
                teamMemberProfiles: PROFILES,
                setTeamMemberProfiles: NOOP,
                socket: null,
                useCM: { allChats: [] } as never,
                useUISM: {} as never,
            }}
        >
            <div data-testid="sidebar" style={{ width: "100%", maxWidth: 390 }}>
                <ChatSearch
                    myself={ME}
                    openSearchBox={false}
                    setMyself={NOOP}
                    setOpenJoinGM={NOOP}
                    setOpenSearchBox={NOOP}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={USE_TEM}
                    useUISM={{} as never}
                />
                <List data-testid="chat-list" sx={{ p: 0 }}>
                    {CHATS.map((c) => (
                        <ChatListItem
                            key={c.chatId}
                            chat={c}
                            incompleteTodoCount={0}
                            isPinnedChat={Boolean(c.isPinned)}
                            isToDoVisible={false}
                            liveRef={live as never}
                            myself={ME}
                            selected={false}
                            setIsToDoVisible={NOOP}
                            setMyself={NOOP}
                            socket={null}
                            useCM={live.current.useCM as never}
                            useTEM={USE_TEM}
                            useTM={{} as never}
                            useUISM={{} as never}
                        />
                    ))}
                </List>
            </div>
        </AvatarContextProvider>
    );
};

createRoot(document.getElementById("root")!).render(
    <MemoryRouter>
        <ColorThemeProvider>
            <I18nProvider>
                <Page />
            </I18nProvider>
        </ColorThemeProvider>
    </MemoryRouter>
);

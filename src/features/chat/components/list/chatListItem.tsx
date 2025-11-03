import { ListDivider, ListItem, Stack } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import * as React from "react";
import { memo } from "react";

import { useAuth } from "../../../../context/AuthContext";
import { useChatListItem } from "../../hooks/useChatListItem";
import { ChatListItemProps } from "./ChatListItem.types";
import { ChatListItemActions } from "./ChatListItemActions";
import { ChatListItemAvatar } from "./ChatListItemAvatar";
import { ChatListItemMessage } from "./ChatListItemMessage";
import { ChatListItemTitle } from "./ChatListItemTitle";

export const ChatListItem = memo((props: ChatListItemProps) => {
    const {
        chat,
        incompleteTodoCount,
        isCreatingTask,
        isPinnedChat,
        myself,
        isTaskPreviewVisible,
        setIsToDoVisible,
        setMyself,
        UIM,
        socket,
        TEM,
        CM,
    } = props;

    const { accessToken } = useAuth();

    const {
        isPinned,
        setIsPinned,
        selected,
        isYou,
        onClickHandler,
        splitOpenHandler,
        pinChatHandler,
    } = useChatListItem({
        chat,
        myself,
        CM,
        isTaskPreviewVisible,
        isCreatingTask,
        isPinnedChat,
        accessToken: accessToken || "",
    });

    const handlePinClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        pinChatHandler(chat.chatId, chat.chatType, CM.funcSetAllChats);
        setIsPinned(!isPinned);
    };

    const handleSplitClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        splitOpenHandler(CM);
    };

    const handleTodoClick = () => {
        setIsToDoVisible(true);
    };

    return (
        <React.Fragment>
            <ListItem sx={{ width: "100%", p: 0.8, overflowX: "hidden" }}>
                <ListItemButton
                    color="neutral"
                    selected={selected}
                    sx={{ flexDirection: "column", alignItems: "initial", gap: 1 }}
                    variant="soft"
                    onClick={() => {
                        onClickHandler(CM);
                        setIsToDoVisible(false);
                    }}
                >
                    <Stack direction="column">
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                        >
                            <Stack direction="row" spacing={1}>
                                <div>
                                    <ChatListItemAvatar
                                        chat={chat}
                                        chatType={chat.chatType}
                                        CM={CM}
                                        isYou={isYou}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        TEM={TEM}
                                        UIM={UIM}
                                    />
                                </div>

                                <ChatListItemTitle
                                    chat={chat}
                                    isYou={isYou}
                                    myself={myself}
                                    TEM={TEM}
                                />
                            </Stack>

                            <ChatListItemActions
                                chat={chat}
                                incompleteTodoCount={incompleteTodoCount}
                                isPinned={isPinned || false}
                                myself={myself}
                                onPinClick={handlePinClick}
                                onSplitClick={handleSplitClick}
                                onTodoClick={handleTodoClick}
                            />
                        </Stack>

                        <ChatListItemMessage chat={chat} />
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider sx={{ margin: 0 }} />
        </React.Fragment>
    );
});

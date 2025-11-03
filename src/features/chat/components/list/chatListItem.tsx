import * as React from "react";
import { memo } from "react";
import { ListDivider, ListItem, Stack } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";

import { useAuth } from "../../../../context/AuthContext";
import { useChatListItem } from "../../hooks/useChatListItem";
import { ChatListItemProps } from "./ChatListItem.types";
import { ChatListItemActions } from "./ChatListItemActions";
import { ChatListItemAvatar } from "./ChatListItemAvatar";
import { ChatListItemMessage } from "./ChatListItemMessage";
import { ChatListItemTitle } from "./ChatListItemTitle";

export const ChatListItem = memo((props: ChatListItemProps) => {
    const {
        TEM,
        socket,
        chat,
        myself,
        setMyself,
        currentMainChat,
        currentSubChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setIsMainChatVisible,
        setIsThreadVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        isSubChatVisible,
        setIsSubChatVisible,
        UIM,
        chatType,
        funcSetAllChats,
        isPinnedChat,
        incompleteTodoCount,
        setIsToDoVisible,
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
        currentMainChat,
        currentSubChat,
        isSubChatVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        isPinnedChat,
        accessToken: accessToken || "",
    });

    const handlePinClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        pinChatHandler(chat.chatId, chat.chatType, funcSetAllChats);
        setIsPinned(!isPinned);
    };

    const handleSplitClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        splitOpenHandler(
            setCurrentSubChat,
            setIsMainChatVisible,
            setIsThreadVisible,
            setIsSubChatVisible
        );
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
                        onClickHandler(
                            setCurrentMainChat,
                            setIsMainChatVisible,
                            setIsThreadVisible
                        );
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
                                        chatType={chatType}
                                        funcSetAllChats={funcSetAllChats}
                                        isYou={isYou}
                                        myself={myself}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setMyself={setMyself}
                                        UIM={UIM}
                                        socket={socket}
                                        TEM={TEM}
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

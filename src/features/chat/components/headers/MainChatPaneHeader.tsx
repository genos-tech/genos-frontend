import { Button, IconButton, Stack } from "@mui/joy";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CancelIcon from "@mui/icons-material/Cancel";

import { HeaderUserName } from "./HeaderUserName";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

type MainChatPaneHeaderProps = {
    myself: UserProps;
    chat: ChatProps;
    subChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
};

export const MainChatPaneHeader = (props: MainChatPaneHeaderProps) => {
    const {
        myself,
        chat,
        subChat,
        setCurrentMainChat,
        setCurrentSubChat,
        isSubChatVisible,
        setIsSubChatVisible,
    } = props;
    const isYou = myself.userId === chat.dmPartnerUser.userId;

    const switchSubToMain = () => {
        setCurrentMainChat(subChat);
        setIsSubChatVisible(false);
    };

    const swapChat = () => {
        setCurrentMainChat(subChat);
        setCurrentSubChat(chat);
    };

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: "space-between",
                py: { xs: 2, md: 2 },
                px: { xs: 1, md: 2 },
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.body",
                height: "60px",
            }}
        >
            <Stack direction="row" spacing={{ xs: 1, md: 2 }} sx={{ alignItems: "center" }}>
                <HeaderUserName chat={chat} isYou={isYou} />
            </Stack>
            <Stack spacing={1} direction="row" sx={{ alignItems: "center" }}>
                <Button
                    component="a"
                    startDecorator={<PhoneInTalkRoundedIcon />}
                    color="neutral"
                    variant="outlined"
                    size="sm"
                    sx={{ display: { xs: "none", md: "inline-flex" } }}
                >
                    Call
                </Button>
                {isSubChatVisible ? (
                    <div>
                        <IconButton
                            component="a"
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => swapChat()}
                        >
                            <SwapVertIcon />
                        </IconButton>
                        <IconButton
                            component="a"
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => switchSubToMain()}
                        >
                            <CancelIcon />
                        </IconButton>
                    </div>
                ) : (
                    ""
                )}
                <IconButton component="a" size="sm" variant="plain" color="neutral">
                    <MoreVertRoundedIcon />
                </IconButton>
            </Stack>
        </Stack>
    );
};

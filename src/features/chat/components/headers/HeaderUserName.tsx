import { Avatar, Box, Chip, Typography } from "@mui/joy";
import GroupsIcon from "@mui/icons-material/Groups";

import { ChatProps } from "../../../../types/chat";
import { PulseDot } from "../../../../components/utils/PulseDot";

export const HeaderUserName = (props: { isOnline: boolean; chat: ChatProps; isYou: boolean }) => {
    const { isOnline, chat, isYou } = props;
    return (
        <>
            <div>
                {chat.chatType === 1 ? (
                    <Avatar src={chat.CGAvatarImgPath}>{chat.chatName[0]}</Avatar>
                ) : (
                    <Avatar>
                        <GroupsIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                )}
            </div>
            <div>
                <Typography
                    component="h2"
                    noWrap
                    endDecorator={
                        chat.chatType === 1 ? (
                            <Chip
                                variant="outlined"
                                size="md"
                                color="neutral"
                                sx={{ borderRadius: "sm" }}
                                startDecorator={
                                    <Box sx={{ ml: "-5px" }}>
                                        <PulseDot color={isOnline === true ? "#4caf50" : "#999"} />
                                    </Box>
                                }
                                slotProps={{ root: { component: "span" } }}
                            >
                                {isOnline === true ? "Online" : "Offline"}
                            </Chip>
                        ) : undefined
                    }
                    sx={{ fontWeight: "lg", fontSize: "lg" }}
                >
                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
                </Typography>
            </div>
        </>
    );
};

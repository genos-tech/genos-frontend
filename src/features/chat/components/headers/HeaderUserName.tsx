import Avatar from '@mui/joy/Avatar';
import Chip from '@mui/joy/Chip';
import Typography from '@mui/joy/Typography';
import CircleIcon from '@mui/icons-material/Circle';
import GroupsIcon from '@mui/icons-material/Groups';
import { ChatProps } from '../../../../types/types';

export const HeaderUserName = (props: { chat: ChatProps; isYou: boolean }) => {
    const { chat, isYou } = props;
    return (
        <>
            <div>
                {chat.isDm ? (
                    <Avatar src={chat.CGAvatarImgPath}>{chat.chatName[0]}</Avatar>
                ) : (
                    <Avatar >
                        <GroupsIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                )}
            </div>
            <div>
                <Typography
                    component="h2"
                    noWrap
                    endDecorator={
                        chat.isDm ? (
                            <Chip
                                variant="outlined"
                                size="sm"
                                color="neutral"
                                sx={{ borderRadius: 'sm' }}
                                startDecorator={
                                    <CircleIcon sx={{ fontSize: 8 }} color="success" />
                                }
                                slotProps={{ root: { component: 'span' } }}
                            >
                                Online
                            </Chip>
                        ) : undefined
                    }
                    sx={{ fontWeight: 'lg', fontSize: 'lg' }}
                >
                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
                </Typography>
            </div>
        </>
    )
}
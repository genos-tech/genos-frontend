import { Socket } from 'socket.io-client';
import { useState } from 'react';
import { Badge, Avatar } from '@mui/joy';

import { AllChatProps, ChatProps } from '../../types/chat';
import { UserProfile } from '../../features/admin/components/modals/UserProfile';
import { UserProps, } from '../../types/admin';
import { ThreadProps } from '../../types/chat';

type AvatarWithStatusProps = {
  userProfile: UserProps;
  socket: Socket | null;
  chat?: AllChatProps;
  thread?: ThreadProps;
  online?: boolean;
  setOpeningService: (service: number) => void;
  setCurrentMainChat: (chat: ChatProps) => void;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
  const {
    userProfile,
    socket,
    online = false,
    chat,
    thread,
    setOpeningService,
    setCurrentMainChat
  } = props;
  const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

  return (
    (userProfile !== undefined && (chat !== undefined || thread !== undefined)) ?
      <div>
        <Badge
          color={online ? 'success' : 'neutral'}
          variant={'solid'}
          size="sm"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeInset="4px 4px"
        >
          <Avatar size="sm" onClick={() => setOpenUserProfile(true)} src={userProfile.avatarImgPath} >
            {chat ? chat?.chatName[0] : thread?.chatName[0]}
          </Avatar>
        </Badge>

        <UserProfile
          socket={socket}
          userProfile={userProfile}
          openUserProfile={openUserProfile}
          setOpenUserProfile={setOpenUserProfile}
          setCurrentMainChat={setCurrentMainChat}
          setOpeningService={setOpeningService}
        />
      </div >
      : <></>
  );
}

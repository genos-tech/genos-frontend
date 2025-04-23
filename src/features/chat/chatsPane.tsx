import { useState } from 'react';
import Sheet from '@mui/joy/Sheet';
import { Socket } from "socket.io-client";

import { ModalCreateGM } from './components/ModalCreateGM';
import { ChatSearch } from './components/ChatSearch';
import { ChatList } from './components/ChatList';
import { DMDivider, GMDivider, PinnedDivider } from './components/ChatPaneDividers';
import { ChatProps, AllChatProps, UserProps } from '../../types/types';

type ChatsPaneProps = {
  myself: UserProps;
  allChats: AllChatProps[];
  setAllChats: (chat: AllChatProps[]) => void;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  currentMainChat: ChatProps;
  currentSubChat: ChatProps;
  socket: Socket;
  isSubChatVisible: boolean;
  setIsSubChatVisible: (value: boolean) => void;
};

export const ChatsPane = (props: ChatsPaneProps) => {
  const { myself,
    allChats,
    setAllChats,
    setCurrentMainChat,
    setCurrentSubChat,
    currentMainChat,
    currentSubChat,
    socket,
    isSubChatVisible,
    setIsSubChatVisible } = props;

  const [openSearchBox, setOpenSearchBox] = useState(false);
  const [openCreateGM, setOpenCreateGM] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100dvh' }}>

      <Sheet
        sx={{
          width: '100%',
          borderRight: '1px solid',
          borderColor: 'divider',
          overflowY: 'hidden',
          position: 'relative',
          transition: 'width 0.2s ease-in-out',
        }}
      >

        <ChatSearch
          myself={myself}
          socket={socket}
          openSearchBox={openSearchBox}
          setOpenSearchBox={setOpenSearchBox}
          setCurrentMainChat={setCurrentMainChat}
          allChats={allChats}
          setAllChats={setAllChats}
        />

        <PinnedDivider />

        <GMDivider setOpenCreateGM={setOpenCreateGM} />

        <ModalCreateGM
          socket={socket}
          myself={myself}
          open={openCreateGM}
          setOpen={setOpenCreateGM}
          allChats={allChats}
          setAllChats={setAllChats}
          setCurrentMainChat={setCurrentMainChat}
        />

        <ChatList
          myself={myself}
          isDm={false}
          allChats={allChats}
          currentMainChat={currentMainChat}
          currentSubChat={currentSubChat}
          setCurrentMainChat={setCurrentMainChat}
          setCurrentSubChat={setCurrentSubChat}
          isSubChatVisible={isSubChatVisible}
          setIsSubChatVisible={setIsSubChatVisible}
        />

        <DMDivider />

        <ChatList
          myself={myself}
          isDm={true}
          allChats={allChats}
          currentMainChat={currentMainChat}
          currentSubChat={currentSubChat}
          setCurrentMainChat={setCurrentMainChat}
          setCurrentSubChat={setCurrentSubChat}
          isSubChatVisible={isSubChatVisible}
          setIsSubChatVisible={setIsSubChatVisible}
        />

      </Sheet>
    </div>
  );
}

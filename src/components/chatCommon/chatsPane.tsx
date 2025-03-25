import { useState, useEffect } from 'react';
import Sheet from '@mui/joy/Sheet';
import {
  Box,
  Alert,
  Stack,
  Typography,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  Button,
  Input,
} from '@mui/joy';
import List from '@mui/joy/List';
import Autocomplete from '@mui/joy/Autocomplete';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CircularProgress from '@mui/joy/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import { Socket } from "socket.io-client";
import ChatListItem from './chatListItem';
import {
  ChatProps,
  AllChatProps,
  UserProps,
  SearchListProps,
  MessageProps
} from '../../types';
import createChatGroup from './createChatGroup';
import loadSearchList from '../loadFromBackend/loadSearchList';
import CheckKnownChatWorker from "../../workers/checkKnownChatWorker.ts?worker";
import InsertDMChatWorker from "../../workers/insertDMChatWorker.ts?worker";
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertDMMessageWorker from "../../workers/insertDMMessageWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";
import FetchSpecificDMMessagesWorker from "../../workers/fetchSpecificDMMessagesWorker.ts?worker";
import FetchSpecificGMMessagesWorker from "../../workers/fetchSpecificGMMessagesWorker.ts?worker";
import { useAuth } from "../../components/admin/AuthContext";


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

function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const insertDMChat = async (dmChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMChatWorker = new InsertDMChatWorker();
    insertDMChatWorker.postMessage({ dmChat: dmChat });
    insertDMChatWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMChatWorker.terminate();
    };
    insertDMChatWorker.onerror = (error) => {
      reject(error);
      insertDMChatWorker.terminate();
    };
  });
};

const insertGMChat = async (gmChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMChatWorker = new InsertGMChatWorker();
    insertGMChatWorker.postMessage({ gmChat: gmChat });
    insertGMChatWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMChatWorker.terminate();
    };
    insertGMChatWorker.onerror = (error) => {
      reject(error);
      insertGMChatWorker.terminate();
    };
  });
};

const insertDMMessage = async (dmMessage: MessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMMessageWorker = new InsertDMMessageWorker();
    insertDMMessageWorker.postMessage({ dmMessage: dmMessage });
    insertDMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMMessageWorker.terminate();
    };
    insertDMMessageWorker.onerror = (error) => {
      reject(error);
      insertDMMessageWorker.terminate();
    };
  });
};

const insertGMMessage = async (gmMessage: MessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMMessageWorker = new InsertGMMessageWorker();
    insertGMMessageWorker.postMessage({ gmMessage: gmMessage });
    insertGMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMMessageWorker.terminate();
    };
    insertGMMessageWorker.onerror = (error) => {
      reject(error);
      insertGMMessageWorker.terminate();
    };
  });
};

export default function ChatsPane(props: ChatsPaneProps) {
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

  const { accessToken } = useAuth();
  const [openUsers, setOpenUsers] = useState(false);
  const [options, setOptions] = useState<SearchListProps[]>([]);
  const loading = openUsers && options.length === 0;

  useEffect(() => {
    let active = true;

    if (!loading) {
      return undefined;
    }

    (async () => {
      const loadedUsers: SearchListProps[] = await loadSearchList({
        myself: myself, teamName: "origin-tech", accessToken: accessToken || ""
      });

      if (active) {
        setOptions([...loadedUsers]);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading]);

  useEffect(() => {
    if (!open) {
      setOptions([]);
    }
  }, [openUsers]);

  const moveToDMChat = async (
    chatEmail: string,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fetchSpecificDMMessagesWorker = new FetchSpecificDMMessagesWorker();
      fetchSpecificDMMessagesWorker.postMessage({
        chatEmail: chatEmail,
      });
      fetchSpecificDMMessagesWorker.onmessage = (event) => {
        const fetchedMessages: MessageProps[] = event.data;
        if (fetchedMessages !== undefined) {
          const newChat: ChatProps = {
            chatName: chatName,
            chatEmail: chatEmail,
            isDm: false,
            unread: false,
            messages: fetchedMessages,
            latestMessage: fetchedMessages[fetchedMessages.length - 1],
            TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
          };
          setCurrentMainChat(newChat)
        } else {
          console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages)
        }
        resolve(event.data);
        fetchSpecificDMMessagesWorker.terminate();
      };
      fetchSpecificDMMessagesWorker.onerror = (error) => {
        reject(error);
        fetchSpecificDMMessagesWorker.terminate();
      };
    });
  };

  const moveToGMChat = async (
    chatEmail: string,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fetchSpecificGMMessagesWorker = new FetchSpecificGMMessagesWorker();
      fetchSpecificGMMessagesWorker.postMessage({
        chatEmail: chatEmail,
      });
      fetchSpecificGMMessagesWorker.onmessage = (event) => {
        const fetchedMessages: MessageProps[] = event.data;
        if (fetchedMessages !== undefined) {
          const newChat: ChatProps = {
            chatName: chatName,
            chatEmail: chatEmail,
            isDm: false,
            unread: false,
            messages: fetchedMessages,
            latestMessage: fetchedMessages[fetchedMessages.length - 1],
            TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
          };
          setCurrentMainChat(newChat)
        } else {
          console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
        }
        resolve(event.data);
        fetchSpecificGMMessagesWorker.terminate();
      };
      fetchSpecificGMMessagesWorker.onerror = (error) => {
        reject(error);
        fetchSpecificGMMessagesWorker.terminate();
      };
    });
  };

  const _checkKnownChat = async (chatEmail: string, isDm: boolean): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const checkKnownChatWorker = new CheckKnownChatWorker();
      checkKnownChatWorker.postMessage({ chatEmail: chatEmail, isDm: isDm });
      checkKnownChatWorker.onmessage = (event) => {
        resolve(event.data);
        checkKnownChatWorker.terminate();
      };
      checkKnownChatWorker.onerror = (error) => {
        reject(error);
        checkKnownChatWorker.terminate();
      };
    });
  };

  const moveToSelectedChat = async (chatEmail: string, chatName: string, isDm: boolean) => {
    try {
      const isKnownChat = await _checkKnownChat(chatEmail, isDm);
      setOpenUsers(false);

      if (!isKnownChat) {
        console.log("New Chat")
        socket.emit("message", {
          message: `${myself.userName} joined`,
          destCGName: chatName,
          destCGEmail: chatEmail,
          isDm: isDm,
        }, (ack: any) => {
          if (isDm) {
            const dmMessage: MessageProps = {
              messageIdWithChatEmail: `${chatEmail}-1`,
              messageId: '1',
              chatEmail: chatEmail,
              content: `${myself.userName} joined`,
              sender: myself,
              tsSent: getCurrentTimestamp(),
              numReplies: 0
            }
            const dmChat: AllChatProps = {
              chatName: chatName,
              chatEmail: chatEmail,
              isDm: true,
              unread: true,
              latestMessage: dmMessage,
              TSLastMessage: getCurrentTimestamp(),
            }
            insertDMChat(dmChat)
            insertDMMessage(dmMessage)
            setCurrentMainChat({ ...dmChat, messages: [dmMessage] })
          } else {
            const gmMessage: MessageProps = {
              messageIdWithChatEmail: `${chatEmail}-1`,
              messageId: '1',
              chatEmail: chatEmail,
              content: `${myself.userName} joined`,
              sender: myself,
              tsSent: getCurrentTimestamp(),
              numReplies: 0
            }
            const gmChat: AllChatProps = {
              chatName: chatName,
              chatEmail: chatEmail,
              isDm: false,
              unread: true,
              latestMessage: gmMessage,
              TSLastMessage: getCurrentTimestamp(),
            }
            insertGMChat(gmChat)
            insertGMMessage(gmMessage)
            setCurrentMainChat({ ...gmChat, messages: [gmMessage] })
          }
        });
      } else {
        console.log("Existing Chat")
        if (isDm) {
          moveToDMChat(chatEmail, chatName, setCurrentMainChat)
        } else {
          moveToGMChat(chatEmail, chatName, setCurrentMainChat)
        }
      }

    } catch (error) {
      console.error("Worker error:", error);
    }
  };

  function onChangeHandler(value: any) {
    var isDm: boolean = true
    if (value.type === "Group") {
      isDm = false;
    }

    socket.emit("join", {
      joiningCGEmail: value.email,
      joiningCGName: value.name,
      isDm: isDm,
      userEmail: myself.userEmail,
    }, (ack: any) => {
      moveToSelectedChat(
        value.email,
        value.name,
        (value.type === "Group") ? Boolean(false) : Boolean(true)
      )
    }
    );

  }

  // Modal configs
  const [CreateCGErrorMessage, setCreateCGErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [chatName, setGroupName] = useState("");
  const handleCreateGroup = () => {
    if (chatName.trim()) {
      createChatGroup(
        myself,
        chatName,
        allChats,
        socket,
        setCreateCGErrorMessage,
        setOpen,
        setGroupName,
        setAllChats,
        setCurrentMainChat,
        accessToken ? accessToken : ""
      )
    }
  };

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
        {/* ============================================================================ */}

        <Box sx={{ px: 2, pb: 1.5, mt: 2 }}>

          <Autocomplete
            placeholder={"Search"}
            open={openUsers}
            onOpen={() => {
              setOpenUsers(true);
            }}
            onClose={() => {
              setOpenUsers(false);
            }}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            getOptionLabel={(option) => option.name}
            options={options}
            loading={loading}
            endDecorator={
              loading ? (
                <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
              ) : null
            }
            onChange={(event, value) => onChangeHandler(value)}
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            aria-label="Search"
            groupBy={(option) => option.type}
          />
        </Box>

        {/* ============================================================================ */}

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between", p: 2, pb: 1.5 }}
        >
          <Typography
            component="h1"
            endDecorator={
              <Chip
                variant="soft"
                color="primary"
                size="md"
                slotProps={{ root: { component: "span" } }}
              >
                ?
              </Chip>
            }
            sx={{ fontSize: { xs: 13 }, fontWeight: "lg", mr: "auto" }}
          >
            GMs
          </Typography>

          <IconButton component='a' size="sm" variant="plain" color="neutral" onClick={() => setOpen(true)}>
            <AddIcon />
          </IconButton>

        </Stack>

        {/* Modal for creating a new chat group */}
        <Modal open={open} onClose={() => setOpen(false)}>
          <ModalDialog>
            <Typography level="h4">Create New Group</Typography>
            <Input
              placeholder="Enter group name"
              value={chatName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatName.trim()) {
                  handleCreateGroup();
                }
              }}
              sx={{ mt: 1 }}
            />
            {CreateCGErrorMessage && CreateCGErrorMessage !== "" && (
              <Alert color="danger">{CreateCGErrorMessage}</Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
              <Button component='a' variant="outlined" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button component='a' onClick={handleCreateGroup} disabled={!chatName.trim()}>
                Create
              </Button>
            </Stack>
          </ModalDialog>
        </Modal>

        <List
          size='sm'
          sx={{
            py: 0,
            '--ListItem-paddingY': '0.3rem',
            '--ListItem-paddingX': '1rem',
            maxHeight: '40vh',
            overflowY: 'auto',
            overflowX: "hidden",
          }}
          className="custom-scrollbar"
        >
          {allChats
            .slice() // Avoid mutating the original array
            .sort((a, b) =>
              new Date(b.TSLastMessage.replace(" ", "T")).getTime() -
              new Date(a.TSLastMessage.replace(" ", "T")).getTime()
            ) // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss" for proper parsing
            .map((chat) =>
              !chat.isDm && (
                <ChatListItem
                  key={chat.chatEmail}
                  chat={chat}
                  myself={myself}
                  currentMainChat={currentMainChat}
                  currentSubChat={currentSubChat}
                  setCurrentMainChat={setCurrentMainChat}
                  setCurrentSubChat={setCurrentSubChat}
                  isSubChatVisible={isSubChatVisible}
                  setIsSubChatVisible={setIsSubChatVisible}
                />
              )
            )}
        </List>

        {/* ============================================================================ */}

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between", p: 2, pb: 1.5 }}
        >
          <Typography
            component="h1"
            endDecorator={
              <Chip
                variant="soft"
                color="primary"
                size="md"
                slotProps={{ root: { component: "span" } }}
              >
                ?
              </Chip>
            }
            sx={{ fontSize: { xs: 13 }, fontWeight: "lg", mr: "auto" }}
          >
            DMs
          </Typography>
        </Stack>

        <List
          size='sm'
          sx={{
            py: 0,
            '--ListItem-paddingY': '0.3rem',
            '--ListItem-paddingX': '1rem',
            maxHeight: '45vh',
            overflowY: 'auto',
            overflowX: "hidden",
          }}
          className="custom-scrollbar"
        >
          {allChats
            .slice() // Avoid mutating the original array
            .sort((a, b) =>
              new Date(b.TSLastMessage.replace(" ", "T")).getTime() -
              new Date(a.TSLastMessage.replace(" ", "T")).getTime()
            ) // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss" for proper parsing
            .map((chat) =>
              chat.isDm && (
                <ChatListItem
                  key={chat.chatEmail}
                  chat={chat}
                  myself={myself}
                  currentMainChat={currentMainChat}
                  currentSubChat={currentSubChat}
                  setCurrentMainChat={setCurrentMainChat}
                  setCurrentSubChat={setCurrentSubChat}
                  isSubChatVisible={isSubChatVisible}
                  setIsSubChatVisible={setIsSubChatVisible}
                />
              )
            )}
        </List>

      </Sheet>
    </div>
  );
}

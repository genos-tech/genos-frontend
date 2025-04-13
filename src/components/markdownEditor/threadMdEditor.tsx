import { useEffect, useState, useRef } from "react";
import MDEditor, { EditorContext, commands } from "@uiw/react-md-editor";
import { IconButton } from "@mui/joy";
import rehypeSanitize from "rehype-sanitize";
import "./markdown_editor.css";
import { useContext } from "react";
import { BoldIcon } from "../../assets/BoldIcon";
import { ItalicIcon } from "../../assets/ItalicIcon";
import { QuoteIcon } from "../../assets/QuoteIcon";
import { CodeIcon } from "../../assets/CodeIcon";
import { LinkIcon } from "../../assets/LinkIcon";
import { OrderedListIcon } from "../../assets/OrderedListIcon";
import { UnorderedListIcon } from "../../assets/UnorderedListIcon";
import { CodeBlockIcon } from "../../assets/CodeBlockIcon";
import { StrikethroughIcon } from "../../assets/StrikethroughIcon";
import { UserProps, ThreadMessageProps, ThreadProps } from '../../types'
import { Socket } from "socket.io-client";
import InsertDMThreadMessageWorker from "../../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../../workers/insertGMThreadMessageWorker.ts?worker";
import { useColorScheme } from '@mui/joy/styles';
import SendIcon from '@mui/icons-material/Send';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import EmojiPicker from '../emojiInput/EmojiPicker'

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

const insertDMThreadMessage = async (newDMThreadMessage: ThreadMessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMThreadMessageWorker = new InsertDMThreadMessageWorker();
    insertDMThreadMessageWorker.postMessage({ dmThreadMessage: newDMThreadMessage });
    insertDMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMThreadMessageWorker.terminate();
    };
    insertDMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertDMThreadMessageWorker.terminate();
    };
  });
};

const insertGMThreadMessage = async (newGMThreadMessage: ThreadMessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMThreadMessageWorker = new InsertGMThreadMessageWorker();
    insertGMThreadMessageWorker.postMessage({ gmThreadMessage: newGMThreadMessage });
    insertGMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMThreadMessageWorker.terminate();
    };
    insertGMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertGMThreadMessageWorker.terminate();
    };
  });
};

type MarkdownEditorProps = {
  setContent: (text: string) => void;
  myself: UserProps;
  socket: Socket;
  thread: ThreadProps;
  messageContent: string;
  setCurrentThreadChat: (chat: ThreadProps) => void;
};


export const MarkdownEditor = ({
  messageContent,
  myself,
  socket,
  thread,
  setCurrentThreadChat,
  setContent,
}: MarkdownEditorProps) => {
  const { mode } = useColorScheme();
  const _className: string = `markdown-editor-${mode}`
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const EditButton = () => {
    const { preview, dispatch } = useContext(EditorContext);

    const click = () => {
      if (dispatch) {
        dispatch({
          preview: "edit",
        });
      }
    };
    return (
      <span
        style={{
          color: '#fff',
          backgroundColor: preview === "edit" ? "#393939" : "#393939",
          borderTopLeftRadius: "8px",
          borderTopRightRadius: preview === "edit" ? "8px" : "0px",
          borderRight: preview === "edit" ? "1px solid #393939" : "none",
          padding: "11px 16px 12px 16px",
          fontSize: "14px",
          fontWeight: 'bold',
        }}
        onClick={click}
      >
        Edit
      </span>
    );
  };

  const PreviewButton = () => {
    const { preview, dispatch } = useContext(EditorContext);
    const click = () => {
      if (dispatch) {
        dispatch({
          preview: "preview",
        });
      }
    };
    return (
      <span
        style={{
          color: '#fff',
          backgroundColor: preview === "preview" ? "#393939" : "#393939",
          borderTopLeftRadius: preview === "preview" ? "8px" : "0px",
          borderTopRightRadius: preview === "preview" ? "8px" : "0px",
          borderRight: preview === "preview" ? "1px solid #393939" : "none",
          borderLeft: preview === "preview" ? "1px solid #393939" : "none",
          padding: "11px 16px 12px 16px",
          fontSize: "14px",
          fontWeight: 'bold',
        }}
        onClick={click}
      >
        Preview
      </span>
    );
  };


  const SendButton = () => {
    return (
      <IconButton
        component='a'
        variant="plain"
        sx={{
          color: 'rgb(217, 217, 217)',
          paddingRight: '10px',
          "&:hover": {
            backgroundColor: "transparent",
            color: "white",
            fontWeight: "bold"
          },
        }}
        onClick={
          () => {
            if (messageContent.trim()) {
              socket.emit("thread_message", {
                isInit: false,
                rootMessageTSSent: "",
                threadId: thread.threadId,
                threadMessage: messageContent,
                isDm: thread.isDm,
                dmPartnerUserId: thread.dmPartnerUserId,
                senderId: myself.userId,
                senderName: myself.userName,
                destCGName: thread.chatName,
                destCGId: thread.chatId,
                taskId: thread.taskId
              }, (ack: any) => {

                const updatedChat: ThreadProps = {
                  chatId: thread.chatId,
                  chatName: thread.chatName,
                  threadId: thread.threadId,
                  isDm: thread.isDm,
                  dmPartnerUserId: thread.dmPartnerUserId,
                  taskId: null,
                  unread: false,
                  messages: [...thread.messages, {
                    messageIdWithChatIdAndThreadId: `${thread.chatId}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                    chatId: thread.chatId,
                    threadId: thread.threadId,
                    messageId: Number(thread.messages.length) + 1,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                  }],
                  TSLastMessage: getCurrentTimestamp(),
                };
                setCurrentThreadChat(updatedChat);

                const newThreadMessage: ThreadMessageProps = {
                  messageIdWithChatIdAndThreadId: `${thread.chatId}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                  chatId: thread.chatId,
                  threadId: thread.threadId,
                  messageId: Number(thread.messages.length) + 1,
                  content: messageContent,
                  sender: myself,
                  tsSent: getCurrentTimestamp(),
                };

                if (thread.isDm) {
                  insertDMThreadMessage(newThreadMessage);
                } else {
                  insertGMThreadMessage(newThreadMessage);
                }

                setContent("")
              });
            }
          }
        }>
        <SendIcon sx={{ color: 'rgb(217, 217, 217)' }} />
        &nbsp; Send
      </IconButton>
    );
  };

  const EmojiInputButton = () => {
    return (
      <IconButton
        component='p'
        variant="plain"
        sx={{
          backgroundColor: 'transparent',
          '&:hover': { backgroundColor: 'transparent' }
        }}
        onClick={() => setShowEmojiPicker((prev) => !prev)}
      >
        <SentimentSatisfiedAltIcon sx={{
          fontSize: 22,
          color: "rgb(217, 217, 217)"
        }} />
      </IconButton>
    );
  };

  const editPreviewCommand = {
    name: "edit-preview",
    keyCommand: "edit-preview",
    buttonProps: { "aria-label": "Generate Edit" },
    icon: <EditButton />,
  };

  const customPreviewCommand = {
    name: "custom-preview",
    keyCommand: "custom-preview",
    buttonProps: { "aria-label": "Generate Preview" },
    icon: <PreviewButton />,
  };

  const customEmojiCommand = {
    name: "emoji-input",
    keyCommand: "emoji-input",
    icon: <EmojiInputButton />,
  };

  const customBoldCommand = {
    ...commands.bold,
    icon: <BoldIcon color='rgb(217, 217, 217)' />,
  };

  const customItalicCommand = {
    ...commands.italic,
    icon: <ItalicIcon color='rgb(217, 217, 217)' />,
  };

  const customStrikethroughCommand = {
    ...commands.strikethrough,
    icon: <StrikethroughIcon color='rgb(217, 217, 217)' />,
  };

  const customQuoteCommand = {
    ...commands.quote,
    icon: <QuoteIcon color='rgb(217, 217, 217)' />,
  };

  const customCodeCommand = {
    ...commands.code,
    icon: <CodeIcon color='rgb(217, 217, 217)' />,
  };

  const customCodeBlockCommand = {
    ...commands.codeBlock,
    icon: <CodeBlockIcon color='rgb(217, 217, 217)' />,
  };

  const customLinkCommand = {
    ...commands.link,
    icon: <LinkIcon color='rgb(217, 217, 217)' />,
  };

  const customOrderedListCommand = {
    ...commands.orderedListCommand,
    icon: <OrderedListIcon color='rgb(217, 217, 217)' />,
  };

  const customUnorderedListCommand = {
    ...commands.unorderedListCommand,
    icon: <UnorderedListIcon color='rgb(217, 217, 217)' />,
  };

  const customSendCommand = {
    name: "custom-preview",
    keyCommand: "custom-preview",
    icon: <SendButton />,
  };

  useEffect(() => {
    if (selectedEmoji !== null) {
      setContent(messageContent + selectedEmoji)
    }
  }, [selectedEmoji])

  const updatePosition = () => {
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 440,
        left: rect.right,
      });
    }
  };

  useEffect(() => {
    updatePosition(); // Initial position
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  return (
    <div ref={boxRef}>
      <EmojiPicker
        editorPos={position}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        setSelectedEmoji={setSelectedEmoji} />
      <MDEditor
        className={_className}
        style={{
          color: mode === 'dark' ? 'grey' : '#ededed',
          backgroundColor: mode === 'dark' ? 'grey' : '#ededed',
          caretColor: mode === 'dark' ? 'rgb(217, 217, 217)' : 'black',
          fontWeight: 'bold',
        }}
        height={200}
        visibleDragbar={false}
        commands={[
          editPreviewCommand,
          customPreviewCommand,
          customBoldCommand,
          customItalicCommand,
          customStrikethroughCommand,
          customLinkCommand,
          customQuoteCommand,
          commands.divider,
          customOrderedListCommand,
          customUnorderedListCommand,
          commands.divider,
          customCodeCommand,
          customCodeBlockCommand,
          customEmojiCommand,
        ]}
        extraCommands={[
          customSendCommand
        ]}
        preview="edit"
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]],
        }}
        value={messageContent}
        onChange={(val) => setContent(val ?? "")}
        textareaProps={{
          placeholder: "Type something here...",
          onKeyDown: (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {

              if (messageContent.trim()) {
                socket.emit("thread_message", {
                  isInit: false,
                  rootMessageTSSent: "",
                  threadId: thread.threadId,
                  threadMessage: messageContent,
                  isDm: thread.isDm,
                  dmPartnerUserId: thread.dmPartnerUserId,
                  senderId: myself.userId,
                  senderName: myself.userName,
                  destCGName: thread.chatName,
                  destCGId: thread.chatId,
                  taskId: thread.taskId
                }, (ack: any) => {

                  const updatedChat: ThreadProps = {
                    chatId: thread.chatId,
                    chatName: thread.chatName,
                    threadId: thread.threadId,
                    isDm: thread.isDm,
                    dmPartnerUserId: thread.dmPartnerUserId,
                    taskId: null,
                    unread: false,
                    messages: [...thread.messages, {
                      messageIdWithChatIdAndThreadId: `${thread.chatId}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                      chatId: thread.chatId,
                      threadId: thread.threadId,
                      messageId: Number(thread.messages.length) + 1,
                      content: messageContent,
                      sender: myself,
                      tsSent: getCurrentTimestamp(),
                    }],
                    TSLastMessage: getCurrentTimestamp(),
                  };
                  setCurrentThreadChat(updatedChat);

                  const newThreadMessage: ThreadMessageProps = {
                    messageIdWithChatIdAndThreadId: `${thread.chatId}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                    chatId: thread.chatId,
                    threadId: thread.threadId,
                    messageId: Number(thread.messages.length) + 1,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                  };

                  if (thread.isDm) {
                    insertDMThreadMessage(newThreadMessage);
                  } else {
                    insertGMThreadMessage(newThreadMessage);
                  }

                  setContent("")
                });
              }

            }
          }
        }
        }
      />
    </div>
  );
};

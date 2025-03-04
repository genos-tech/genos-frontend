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
import Stack from '@mui/joy/Stack';
import { UserProps, ThreadMessageProps, ThreadProps, ChatProps, AllChatProps } from '../../types'
import { Socket } from "socket.io-client";
import InsertDMThreadMessageWorker from "../../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../../workers/insertGMThreadMessageWorker.ts?worker";
import InsertDMChatWorker from "../../workers/insertDMChatWorker.ts?worker";
import InsertDMMessageWorker from "../../workers/insertDMMessageWorker.ts?worker";
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";
import { useColorScheme } from '@mui/joy/styles';
import SendIcon from '@mui/icons-material/Send';

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


const insertDMChatAndMessage = async (newDMChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMMessageWorker = new InsertDMMessageWorker();
    insertDMMessageWorker.postMessage({ dmMessage: newDMChat.latestMessage });
    insertDMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMMessageWorker.terminate();
    };
    insertDMMessageWorker.onerror = (error) => {
      reject(error);
      insertDMMessageWorker.terminate();
    };

    const insertDMChatWorker = new InsertDMChatWorker();
    insertDMChatWorker.postMessage({ dmChat: newDMChat });
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

const insertGMChatAndMessage = async (newGMChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMMessageWorker = new InsertGMMessageWorker();
    insertGMMessageWorker.postMessage({ gmMessage: newGMChat.latestMessage });
    insertGMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMMessageWorker.terminate();
    };
    insertGMMessageWorker.onerror = (error) => {
      reject(error);
      insertGMMessageWorker.terminate();
    };

    const insertGMChatWorker = new InsertGMChatWorker();
    insertGMChatWorker.postMessage({ gmChat: newGMChat });
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
          color: '#c1c1c1',
          backgroundColor: preview === "edit" ? "#393939" : "#393939",
          borderTopLeftRadius: "8px",
          borderTopRightRadius: preview === "edit" ? "8px" : "0px",
          borderRight: preview === "edit" ? "1px solid #393939" : "none",
          padding: "11px 16px 12px 16px",
          fontSize: "14px",
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
          color: '#c1c1c1',
          backgroundColor: preview === "preview" ? "#393939" : "#393939",
          borderTopLeftRadius: preview === "preview" ? "8px" : "0px",
          borderTopRightRadius: preview === "preview" ? "8px" : "0px",
          borderRight: preview === "preview" ? "1px solid #393939" : "none",
          borderLeft: preview === "preview" ? "1px solid #393939" : "none",
          padding: "11px 16px 12px 16px",
          fontSize: "14px",
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
          color: 'white',
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
                senderEmail: myself.userEmail,
                senderName: myself.userName,
                destCGName: thread.chatName,
                destCGEmail: thread.chatEmail
              }, (ack: any) => {

                const updatedChat: ThreadProps = {
                  chatName: thread.chatName,
                  chatEmail: thread.chatEmail,
                  threadId: thread.threadId,
                  isDm: thread.isDm,
                  unread: false,
                  messages: [...thread.messages, {
                    messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                    threadId: thread.threadId,
                    messageId: String(Number(thread.messages.length) + 1),
                    chatEmail: thread.chatEmail,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                  }],
                  TSLastMessage: getCurrentTimestamp(),
                };
                setCurrentThreadChat(updatedChat);

                const newThreadMessage: ThreadMessageProps = {
                  messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                  threadId: thread.threadId,
                  messageId: String(Number(thread.messages.length) + 1),
                  chatEmail: thread.chatEmail,
                  content: messageContent,
                  sender: myself,
                  tsSent: getCurrentTimestamp(),
                };

                if (thread.isDm) {
                  insertDMThreadMessage(newThreadMessage);
                } else {
                  insertGMThreadMessage(newThreadMessage);
                }

                // TODO: Dynamically update the num of replies in the message pane.
                // if (currentMainChat.chatEmail === thread.chatEmail) {
                // } else if (currentSubChat.chatEmail === thread.chatEmail) {
                // }

                setContent("")
              });
            }
          }
        }>
        <SendIcon sx={{ color: 'white' }} />
        &nbsp; Send
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

  const customBoldCommand = {
    ...commands.bold,
    icon: <BoldIcon color="#c1c1c1" />,
  };

  const customItalicCommand = {
    ...commands.italic,
    icon: <ItalicIcon color="#c1c1c1" />,
  };

  const customStrikethroughCommand = {
    ...commands.strikethrough,
    icon: <StrikethroughIcon color="#c1c1c1" />,
  };

  const customQuoteCommand = {
    ...commands.quote,
    icon: <QuoteIcon color="#c1c1c1" />,
  };

  const customCodeCommand = {
    ...commands.code,
    icon: <CodeIcon color="#c1c1c1" />,
  };

  const customCodeBlockCommand = {
    ...commands.codeBlock,
    icon: <CodeBlockIcon color="#c1c1c1" />,
  };

  const customLinkCommand = {
    ...commands.link,
    icon: <LinkIcon color="#c1c1c1" />,
  };

  const customOrderedListCommand = {
    ...commands.orderedListCommand,
    icon: <OrderedListIcon color="#c1c1c1" />,
  };

  const customUnorderedListCommand = {
    ...commands.unorderedListCommand,
    icon: <UnorderedListIcon color="#c1c1c1" />,
  };

  const customSendCommand = {
    name: "custom-preview",
    keyCommand: "custom-preview",
    icon: <SendButton />,
  };

  return (
    <div>
      <Stack direction="column" >
        <MDEditor
          className={_className}
          style={{
            color: mode === 'dark' ? 'grey' : '#ededed',
            backgroundColor: mode === 'dark' ? 'grey' : '#ededed',
            borderBottomRightRadius: '0.5%',
            borderBottomLeftRadius: '0.5%',
            caretColor: mode === 'dark' ? 'white' : 'black',
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
                    senderEmail: myself.userEmail,
                    senderName: myself.userName,
                    destCGName: thread.chatName,
                    destCGEmail: thread.chatEmail
                  }, (ack: any) => {

                    const updatedChat: ThreadProps = {
                      chatName: thread.chatName,
                      chatEmail: thread.chatEmail,
                      threadId: thread.threadId,
                      isDm: thread.isDm,
                      unread: false,
                      messages: [...thread.messages, {
                        messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                        threadId: thread.threadId,
                        messageId: String(Number(thread.messages.length) + 1),
                        chatEmail: thread.chatEmail,
                        content: messageContent,
                        sender: myself,
                        tsSent: getCurrentTimestamp(),
                      }],
                      TSLastMessage: getCurrentTimestamp(),
                    };
                    setCurrentThreadChat(updatedChat);

                    const newThreadMessage: ThreadMessageProps = {
                      messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                      threadId: thread.threadId,
                      messageId: String(Number(thread.messages.length) + 1),
                      chatEmail: thread.chatEmail,
                      content: messageContent,
                      sender: myself,
                      tsSent: getCurrentTimestamp(),
                    };

                    if (thread.isDm) {
                      insertDMThreadMessage(newThreadMessage);
                    } else {
                      insertGMThreadMessage(newThreadMessage);
                    }

                    // TODO: Dynamically update the num of replies in the message pane.
                    // if (currentMainChat.chatEmail === thread.chatEmail) {
                    // } else if (currentSubChat.chatEmail === thread.chatEmail) {
                    // }

                    setContent("")
                  });
                }

              }
            }
          }
          }
        />
      </Stack>
    </div>
  );
};

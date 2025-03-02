import MDEditor, { EditorContext, commands } from "@uiw/react-md-editor";
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
import MDFooter from './threadMdFooter'
import { UserProps, ThreadMessageProps, ThreadProps } from '../../types'
import { Socket } from "socket.io-client";
import InsertDMThreadMessageWorker from "../../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../../workers/insertGMThreadMessageWorker.ts?worker";


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
  return (
    <div>
      <Stack direction="column" >
        <MDEditor
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
          extraCommands={[]}
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
        <MDFooter messageContent={messageContent}
          myself={myself}
          socket={socket}
          thread={thread}
          setCurrentThreadChat={setCurrentThreadChat}
          setContent={setContent} />
      </Stack>
    </div>
  );
};

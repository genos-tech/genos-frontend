import { useEffect, useState, useRef } from "react";
import { IconButton } from "@mui/joy";
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
import { useColorScheme } from '@mui/joy/styles';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import EmojiPicker from '../emojiInput/EmojiPicker'
import SendIcon from '@mui/icons-material/Send';
import { Socket } from "socket.io-client";
import {
  UserProps,
  TaskCommentProps
} from "../../types";

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


type MarkdownEditorProps = {
  myself: UserProps;
  socket?: Socket;
  projectId: number;
  taskId: number;
  content: string;
  setBody: (text: string) => void;
  height: number;
  mdMode: string;
  sendMode: boolean;
  isTaskBody: boolean;
  setTaskUpdate: (value: boolean) => void;
  taskComments: TaskCommentProps[];
  setTaskComments: (value: TaskCommentProps[]) => void;
};

export const MarkdownEditor = ({
  myself,
  socket,
  projectId,
  taskId,
  content,
  setBody,
  height,
  mdMode,
  sendMode,
  isTaskBody,
  setTaskUpdate,
  taskComments,
  setTaskComments
}: MarkdownEditorProps) => {
  const { mode } = useColorScheme();
  const _className: string = `markdown-editor-${mode}`
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });


  const SendButton = () => {
    return (
      (sendMode) ?
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
              if (socket) {
                if (content.trim()) {
                  socket.emit("task_comment", {
                    project_id: projectId,
                    task_id: taskId,
                    comment_body: content
                  }, (ack: any) => {
                    setBody("")
                    setTaskComments([...taskComments, {
                      taskId: taskId,
                      senderId: myself.userId,
                      senderName: myself.userName,
                      commentId: taskComments.length + 1,
                      commentBody: content,
                      sentAt: getCurrentTimestamp(),
                    }])
                  }
                  )
                }
              }
            }
          }>
          <SendIcon sx={{ color: 'rgb(217, 217, 217)' }} />
          &nbsp; Send
        </IconButton>
        : ""
    );
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
          color: 'rgb(217, 217, 217)',
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
          color: 'rgb(217, 217, 217)',
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
    icon: <BoldIcon color="rgb(217, 217, 217)" />,
  };

  const customItalicCommand = {
    ...commands.italic,
    icon: <ItalicIcon color="rgb(217, 217, 217)" />,
  };

  const customStrikethroughCommand = {
    ...commands.strikethrough,
    icon: <StrikethroughIcon color="rgb(217, 217, 217)" />,
  };

  const customQuoteCommand = {
    ...commands.quote,
    icon: <QuoteIcon color="rgb(217, 217, 217)" />,
  };

  const customCodeCommand = {
    ...commands.code,
    icon: <CodeIcon color="rgb(217, 217, 217)" />,
  };

  const customCodeBlockCommand = {
    ...commands.codeBlock,
    icon: <CodeBlockIcon color="rgb(217, 217, 217)" />,
  };

  const customLinkCommand = {
    ...commands.link,
    icon: <LinkIcon color="rgb(217, 217, 217)" />,
  };

  const customOrderedListCommand = {
    ...commands.orderedListCommand,
    icon: <OrderedListIcon color="rgb(217, 217, 217)" />,
  };

  const customUnorderedListCommand = {
    ...commands.unorderedListCommand,
    icon: <UnorderedListIcon color="rgb(217, 217, 217)" />,
  };

  const customSendCommand = {
    name: "custom-preview",
    keyCommand: "custom-preview",
    icon: <SendButton />,
  };

  useEffect(() => {
    if (selectedEmoji !== null) {
      setBody(content + selectedEmoji)
    }
  }, [selectedEmoji])

  const updatePosition = () => {
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      setPosition({
        top: 1370,
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
          caretColor: mode === 'dark' ? 'rgb(217, 217, 217)' : 'black',
          fontWeight: 'bold',
          colorScheme: 'revert',
        }}
        height={height}
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
        preview={(mdMode === "preview" ? "preview" : "edit")}
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]],
        }}
        value={content}
        onChange={(val) => setBody(val ?? "")}
        onBlur={() => { (isTaskBody) ? setTaskUpdate(true) : setTaskUpdate(false) }}
        textareaProps={{
          placeholder: "Type something here...",
          onKeyDown: (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              console.log("Entered")
            }
          }
        }
        }
      />
    </div>
  );
};

import { useState } from "react";
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


type MarkdownEditorProps = {
  content: string;
  setContent: (text: string) => void;
  height: number;
  mdMode: string;
};

export const MarkdownEditor = ({
  content,
  setContent,
  height,
  mdMode
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

  return (
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
      ]}
      extraCommands={[]}
      preview={(mdMode === "preview" ? "preview" : "edit")}
      previewOptions={{
        rehypePlugins: [[rehypeSanitize]],
      }}
      value={content}
      onChange={(val) => setContent(val ?? "")}
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
  );
};

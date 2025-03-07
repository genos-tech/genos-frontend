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
          color: 'white',
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
          color: 'white',
          backgroundColor: "#393939",
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
    icon: <BoldIcon color="#fff" />,
  };

  const customItalicCommand = {
    ...commands.italic,
    icon: <ItalicIcon color="#fff" />,
  };

  const customStrikethroughCommand = {
    ...commands.strikethrough,
    icon: <StrikethroughIcon color="#fff" />,
  };

  const customQuoteCommand = {
    ...commands.quote,
    icon: <QuoteIcon color="#fff" />,
  };

  const customCodeCommand = {
    ...commands.code,
    icon: <CodeIcon color="#fff" />,
  };

  const customCodeBlockCommand = {
    ...commands.codeBlock,
    icon: <CodeBlockIcon color="#fff" />,
  };

  const customLinkCommand = {
    ...commands.link,
    icon: <LinkIcon color="#fff" />,
  };

  const customOrderedListCommand = {
    ...commands.orderedListCommand,
    icon: <OrderedListIcon color="#fff" />,
  };

  const customUnorderedListCommand = {
    ...commands.unorderedListCommand,
    icon: <UnorderedListIcon color="#fff" />,
  };

  return (
    <MDEditor
      className={_className}
      style={{
        caretColor: mode === 'dark' ? 'white' : 'black',
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

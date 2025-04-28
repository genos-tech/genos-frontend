import { Box } from "@mui/joy";
import { useColorScheme } from '@mui/joy/styles';
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { PartialBlock } from "@blocknote/core";
import { codeBlock } from "@blocknote/code-block";

type BnPreviewProps = {
    content: PartialBlock[];
    isSent: boolean;
    customClassName?: string;
}
export const BnPreview = (props: BnPreviewProps) => {
    const { content, isSent, customClassName } = props;
    const { mode } = useColorScheme();
    const _bnBoxClassName: string = isSent ? `bn-preview-box-${mode}-me` : `bn-preview-box-${mode}`
    const bnBoxClassName = customClassName ? `${customClassName}-${mode}` : _bnBoxClassName;

    const editor = useCreateBlockNote({
        codeBlock,
        initialContent: content.slice(0, -1)
    });

    return (
        <Box className={bnBoxClassName}>
            <BlockNoteView
                editor={editor}
                editable={false}
                formattingToolbar={false}
                linkToolbar={false}
                filePanel={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                data-changing-font-demo // custom font
            >
            </BlockNoteView>
        </Box>
    );
}

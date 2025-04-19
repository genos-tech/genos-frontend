import { Box } from "@mui/joy";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { PartialBlock } from "@blocknote/core";
import { useColorScheme } from '@mui/joy/styles';
import { codeBlock } from "@blocknote/code-block";

type BnPreviewProps = {
    content: PartialBlock[];
    isSent: boolean;
}

export function BnPreview(props: BnPreviewProps) {
    const { content, isSent } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName: string = isSent ? `bn-preview-box-${mode}-me` : `bn-preview-box-${mode}`

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

export default BnPreview;



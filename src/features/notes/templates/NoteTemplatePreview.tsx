import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useMemo } from "react";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { sanitizeBlocksForMarkdown } from "../common/services/noteMarkdown";

type Props = {
    blocks: PartialBlock[];
};

/**
 * Read-only render of a template's body (MIP-2337). The default BlockNote schema is enough:
 * a template saved from a note may hold the notes schema's custom blocks and chips, which the
 * default schema would reject, so they are degraded to plain text first (the same step the
 * Markdown export uses). Mount it with a `key` per template: the editor is built once.
 */
export const NoteTemplatePreview = ({ blocks }: Props) => {
    const { mode, systemMode } = useColorScheme();
    // Joy reports "system" until it resolves; the resolved scheme is the one BlockNote needs.
    const scheme = (mode === "system" ? systemMode : mode) ?? "light";
    const initialContent = useMemo(() => {
        const safe = sanitizeBlocksForMarkdown(blocks);
        return safe.length > 0 ? safe : undefined;
    }, [blocks]);
    const editor = useCreateBlockNote({ initialContent });
    return (
        <Box sx={{ "& .bn-editor": { px: 0 } }} data-note-template-preview>
            <BlockNoteView
                editable={false}
                editor={editor}
                filePanel={false}
                formattingToolbar={false}
                linkToolbar={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                theme={scheme}
            />
        </Box>
    );
};

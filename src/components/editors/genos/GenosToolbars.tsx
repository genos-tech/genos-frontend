import {
    AddCommentButton,
    BasicTextStyleButton,
    BlockTypeSelect,
    BlockTypeSelectItem,
    ColorStyleButton,
    CreateLinkButton,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    FileReplaceButton,
    FormattingToolbar,
    TableCellMergeButton,
    TextAlignButton,
} from "@blocknote/react";
import { RiAlertFill } from "react-icons/ri";

import type { AgentMentionRef } from "../../../features/agentQA/mentions/types";
import { useTranslation } from "../../../i18n";
import { AskGenosToolbarButton } from "../AskGenosToolbarButton";
import { AttachFileToolbarButton } from "../AttachFileToolbarButton";
import { CustomEmojiToolbar } from "../customEmojiToolbar";
import { GifToolbarButton } from "../GifToolbarButton";
import {
    getBlockTypeSelectItemsForDocuments,
    getBlockTypeSelectItemsWithCodeBlock,
} from "../sub/codeBlockExtras";
import { WrapToggleToolbarButtons } from "../sub/WrapToggleToolbarButtons";

type EditorForItems = Parameters<typeof getBlockTypeSelectItemsWithCodeBlock>[0];

/**
 * The formatting toolbar of the editors people WRITE DOCUMENTS in: notes, the task body and
 * body templates (the floating bar over a selection). One definition for all five; they
 * differed only in whether the viewer may edit (a Viewer keeps Comment) and whether the
 * document has comments.
 *
 *   `isEditable` false: only the comment button remains (`hasComments`), as before.
 *   `hasComments`:      the document has a thread store, so Comment is offered.
 *   `media` false:      no GIF button (a to-do's notes, MIP-1334: nowhere to upload to). The
 *                       file buttons stay: they only show on a file block, which the notes
 *                       never get from this toolbar or the `/` menu.
 *   `askSource`:        offers "Ask Genos about the selected text" (MIP-1058), saying what the
 *                       document is (a note), for the server to read around the passage. Absent:
 *                       no button (a task body, a template, a to-do's notes, a modal-hosted note).
 */
export const GenosDocumentToolbar = ({
    editor,
    isEditable = true,
    hasComments = false,
    media = true,
    askSource,
    setShowGifPicker,
}: {
    editor: EditorForItems;
    isEditable?: boolean;
    hasComments?: boolean;
    media?: boolean;
    askSource?: AgentMentionRef | null;
    setShowGifPicker: (value: boolean) => void;
}) => {
    const { t } = useTranslation();
    return (
        <FormattingToolbar>
            {isEditable && (
                <BlockTypeSelect
                    key={"blockTypeSelect"}
                    items={[
                        ...getBlockTypeSelectItemsForDocuments(editor),
                        {
                            name: t.common.editor.alertBlock,
                            type: "alert",
                            icon: RiAlertFill,
                        } satisfies BlockTypeSelectItem,
                    ]}
                />
            )}
            {isEditable && (
                <>
                    <BasicTextStyleButton key={"boldStyleButton"} basicTextStyle={"bold"} />
                    <BasicTextStyleButton key={"italicStyleButton"} basicTextStyle={"italic"} />
                    <BasicTextStyleButton
                        key={"underlineStyleButton"}
                        basicTextStyle={"underline"}
                    />
                    <BasicTextStyleButton key={"strikeStyleButton"} basicTextStyle={"strike"} />
                    <BasicTextStyleButton key={"codeStyleButton"} basicTextStyle={"code"} />
                    <TextAlignButton key={"textAlignLeftButton"} textAlignment={"left"} />
                    <TextAlignButton key={"textAlignCenterButton"} textAlignment={"center"} />
                    <TextAlignButton key={"textAlignRightButton"} textAlignment={"right"} />
                    <ColorStyleButton key={"colorStyleButton"} />
                    <CreateLinkButton key={"createLinkButton"} />
                    {media && (
                        <GifToolbarButton key={"gifButton"} setShowGifPicker={setShowGifPicker} />
                    )}
                    <FileCaptionButton key={"fileCaptionButton"} />
                    <FileReplaceButton key={"fileReplaceButton"} />
                </>
            )}
            {hasComments && <AddCommentButton key={"addCommentButton"} />}
            {askSource && <AskGenosToolbarButton key={"askGenosButton"} source={askSource} />}
            {isEditable && (
                <>
                    <FileDeleteButton key={"fileDeleteButton"} />
                    <FileDownloadButton key={"fileDownloadButton"} />
                    <FilePreviewButton key={"filePreviewButton"} />
                    <FileRenameButton key={"fileRenameButton"} />
                    <TableCellMergeButton key={"tableCellMergeButton"} />
                </>
            )}
        </FormattingToolbar>
    );
};

/**
 * The always-visible toolbar of the chat-style editors: the composers (chat, thread, task
 * comment) and their edit-in-place twins (`Update*`). One definition.
 *
 * Narrow screens (`isMobile`): the block-type picker (the widest item in the bar) and the
 * link button are dropped, which is what buys room for Emoji and GIF, so those two show at
 * every width. Optional extras: `onAttach` adds a native "attach file" button on a phone
 * (drag-drop and the side menu cover desktop), `wrapToggles` adds the session-only wrap
 * toggles on desktop (a phone's bar has no room for them).
 */
export const GenosChatToolbar = ({
    editor,
    isMobile,
    setShowEmojiPicker,
    setShowGifPicker,
    onAttach,
    wrapToggles,
}: {
    editor: EditorForItems;
    isMobile: boolean;
    setShowEmojiPicker: (value: boolean) => void;
    /** Omit for a surface that cannot carry a GIF: the button is left out. */
    setShowGifPicker?: (value: boolean) => void;
    onAttach?: () => void;
    wrapToggles?: {
        unwrapAll: boolean;
        setUnwrapAll: (value: boolean) => void;
        unwrapCode: boolean;
        setUnwrapCode: (value: boolean) => void;
    };
}) => (
    <FormattingToolbar>
        {!isMobile && (
            <BlockTypeSelect
                key={"blockTypeSelect"}
                items={getBlockTypeSelectItemsWithCodeBlock(editor)}
            />
        )}

        <BasicTextStyleButton key={"boldStyleButton"} basicTextStyle={"bold"} />
        <BasicTextStyleButton key={"italicStyleButton"} basicTextStyle={"italic"} />
        <BasicTextStyleButton key={"underlineStyleButton"} basicTextStyle={"underline"} />
        <BasicTextStyleButton key={"strikeStyleButton"} basicTextStyle={"strike"} />
        <BasicTextStyleButton key={"codeStyleButton"} basicTextStyle={"code"} />

        <ColorStyleButton key={"colorStyleButton"} />
        {!isMobile && <CreateLinkButton key={"createLinkButton"} />}
        <FileCaptionButton key={"fileCaptionButton"} />
        <FileReplaceButton key={"replaceFileButton"} />
        <FileDeleteButton key={"fileDeleteButton"} />
        <FileDownloadButton key={"fileDownloadButton"} />
        <FilePreviewButton key={"filePreviewButton"} />
        <FileRenameButton key={"fileRenameButton"} />

        <CustomEmojiToolbar key={"customButton"} setShowEmojiPicker={setShowEmojiPicker} />
        {setShowGifPicker && (
            <GifToolbarButton key={"gifButton"} setShowGifPicker={setShowGifPicker} />
        )}
        {isMobile && onAttach && (
            <AttachFileToolbarButton key={"attachFileButton"} onClick={onAttach} />
        )}
        {!isMobile && wrapToggles && (
            <WrapToggleToolbarButtons key={"wrapToggleButtons"} {...wrapToggles} />
        )}
    </FormattingToolbar>
);

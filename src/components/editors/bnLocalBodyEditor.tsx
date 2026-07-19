import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    PartialBlock,
} from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    BlockTypeSelectItem,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    FileReplaceButton,
    FormattingToolbar,
    FormattingToolbarController,
    getDefaultReactSlashMenuItems,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    TableCellMergeButton,
    TextAlignButton,
    useCreateBlockNote,
} from "@blocknote/react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { RiAlertFill } from "react-icons/ri";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { GifPicker } from "../ui/gif/GifPicker";
import { CreateCustomEmojiSpec } from "./CustomEmoji";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { GifToolbarButton, withGifSlashItem } from "./GifToolbarButton";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
    HashSuggestionMenuController,
} from "./HashMention";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "./Mention";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";
import { CustomDragHandleMenu } from "./sub/CustomDragHandleMenu";

type BnLocalBodyEditorProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    initialBody: PartialBlock[];
    onChange: (blocks: PartialBlock[]) => void;
};

const EMPTY_DOC: PartialBlock[] = [{ type: "paragraph", content: [] }];

/**
 * A LOCAL (non-collaborative) editable BlockNote editor for authoring a
 * project body template — the SAME editing surface as the task body
 * (`bnTaskPreview`): same schema, same `bn-task-body-box-*` styling,
 * side menu, formatting toolbar (incl. GIF), and the `#` / `@` / `/` /
 * `:` suggestion menus (mentions, custom emoji, GIF).
 *
 * It differs from `bnTaskPreview` only in that it is NOT wired to a
 * Yjs/Hocuspocus doc — a template belongs to no task — and never emits;
 * it reports the current document via `onChange` so the host modal can
 * POST/PUT it. The schema staying identical to `bnTaskPreview`'s matters:
 * the create form applies a template with `editor.replaceBlocks`, which
 * throws on any block/inline type the task editor's schema lacks.
 */
export const BnLocalBodyEditor = (props: BnLocalBodyEditorProps) => {
    const { useTEM, myself, setMyself, socket, useUISM, useCM, initialBody, onChange } = props;
    const { mode } = useColorScheme();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    const { mentionGroups } = useMentionGroupsContext();

    // Same spec set as bnTaskPreview. Memoized [] — useCreateBlockNote
    // keeps its first schema for the editor's lifetime.
    const schema = useMemo(() => {
        const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;
        return BlockNoteSchema.create({
            inlineContentSpecs: {
                ...defaultInlineContentSpecs,
                mention: CreateMentionSpec(
                    useTEM.teamMemberProfiles,
                    socket,
                    myself,
                    setMyself,
                    useUISM,
                    useCM
                ),
                mentionGroup: CreateMentionGroupSpec(),
                customEmoji: CreateCustomEmojiSpec(),
                hashTask: CreateHashTaskSpec(),
                hashNote: CreateHashNoteSpec(),
                hashChat: CreateHashChatSpec(),
                hashProject: CreateHashProjectSpec(),
            },
            blockSpecs: {
                ...remainingBlockSpecs,
                codeBlock: createCodeBlockSpec(codeBlockOptions),
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showGifPicker, setShowGifPicker] = useState(false);

    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    const editor = useCreateBlockNote({
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        initialContent: initialBody.length > 0 ? initialBody : EMPTY_DOC,
        extensions: [codeBlockEnterShortcut],
        dictionary: {
            ...en,
            placeholders: {
                ...en.placeholders,
                emptyDocument: "Start typing...",
                default: "Type something...",
                heading: "Custom heading placeholder",
            },
        },
    });

    const insertGif = (gif: { url: string; title: string }) => {
        (editor as any).insertBlocks(
            [{ type: "image", props: { url: gif.url, name: gif.title } }],
            editor.getTextCursorPosition().block,
            "after"
        );
        setShowGifPicker(false);
    };

    // Report the current document to the host (a ref write there — no
    // re-render). Wrapped in an effect-free callback on the view.
    const emitChange = () => onChange(editor.document as PartialBlock[]);
    // Emit once on mount so a template opened for editing but saved
    // untouched still round-trips its seeded body.
    useEffect(() => {
        emitChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const bnBoxClassName = `bn-task-body-box-${mode}`;

    return (
        <Box
            ref={editorBoxRef}
            className={bnBoxClassName}
            style={{ ["--task-body-editor-height" as any]: "360px" }}
            sx={{ position: "relative" }}
        >
            <GifPicker
                pickerLeftPosition="calc(50vw - 170px)"
                pickerTopPosition="15vh"
                setShowGifPicker={setShowGifPicker}
                showGifPicker={showGifPicker}
                useFixedPosition={true}
                onSelect={insertGif}
            />
            <BlockNoteView
                className="bn-box"
                editor={editor as any}
                emojiPicker={false}
                slashMenu={false}
                formattingToolbar={false}
                sideMenu={false}
                theme={mode === "dark" ? "dark" : "light"}
                data-changing-font-demo
                onChange={emitChange}
            >
                <SideMenuController
                    sideMenu={(sideMenuProps) => (
                        <SideMenu {...sideMenuProps} dragHandleMenu={CustomDragHandleMenu} />
                    )}
                />
                <FormattingToolbarController
                    formattingToolbar={() => (
                        <FormattingToolbar>
                            <BlockTypeSelect
                                key={"blockTypeSelect"}
                                items={[
                                    ...getBlockTypeSelectItemsWithCodeBlock(editor.dictionary),
                                    {
                                        name: "Alert",
                                        type: "alert",
                                        icon: RiAlertFill,
                                    } satisfies BlockTypeSelectItem,
                                ]}
                            />
                            <BasicTextStyleButton
                                key={"boldStyleButton"}
                                basicTextStyle={"bold"}
                            />
                            <BasicTextStyleButton
                                key={"italicStyleButton"}
                                basicTextStyle={"italic"}
                            />
                            <BasicTextStyleButton
                                key={"underlineStyleButton"}
                                basicTextStyle={"underline"}
                            />
                            <BasicTextStyleButton
                                key={"strikeStyleButton"}
                                basicTextStyle={"strike"}
                            />
                            <BasicTextStyleButton
                                key={"codeStyleButton"}
                                basicTextStyle={"code"}
                            />
                            <TextAlignButton key={"textAlignLeftButton"} textAlignment={"left"} />
                            <TextAlignButton
                                key={"textAlignCenterButton"}
                                textAlignment={"center"}
                            />
                            <TextAlignButton
                                key={"textAlignRightButton"}
                                textAlignment={"right"}
                            />
                            <ColorStyleButton key={"colorStyleButton"} />
                            <CreateLinkButton key={"createLinkButton"} />
                            <GifToolbarButton
                                key={"gifButton"}
                                setShowGifPicker={setShowGifPicker}
                            />
                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"fileReplaceButton"} />
                            <FileDeleteButton key={"fileDeleteButton"} />
                            <FileDownloadButton key={"fileDownloadButton"} />
                            <FilePreviewButton key={"filePreviewButton"} />
                            <FileRenameButton key={"fileRenameButton"} />
                            <TableCellMergeButton key={"tableCellMergeButton"} />
                        </FormattingToolbar>
                    )}
                />
                {/* "#" mentions: tasks / notes / GM chats / projects */}
                <HashSuggestionMenuController editor={editor} />
                {/* "@" mentions */}
                <SuggestionMenuController
                    suggestionMenuComponent={MentionSuggestionMenu}
                    triggerCharacter={"@"}
                    getItems={async (query) =>
                        filterAndRankSuggestionItems(
                            MentionMenuItems(
                                useTEM.teamMemberProfiles,
                                editor,
                                useTEM.teamMembers,
                                myself.userId,
                                mentionGroups
                            ),
                            query
                        )
                    }
                />
                <SuggestionMenuController
                    triggerCharacter={"/"}
                    getItems={async (query) =>
                        filterSuggestionItems(
                            getCustomSlashMenuItems(
                                editor as unknown as typeof schema.BlockNoteEditor
                            ),
                            query
                        )
                    }
                />
                {/* ":" custom + unicode emoji */}
                <SuggestionMenuController
                    getItems={async (query) => getEmojiSuggestionItems(editor, query)}
                    minQueryLength={2}
                    triggerCharacter={":"}
                />
            </BlockNoteView>
        </Box>
    );
};

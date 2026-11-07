import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    FormattingToolbarController,
    SideMenu,
    SideMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosDocumentToolbar } from "./genos/GenosToolbars";
import { genosTableOptions } from "./genosBlockSpecs";
import { codeFenceInputRule } from "./sub/codeBlockExtras";
import { CustomDragHandleMenu } from "./sub/CustomDragHandleMenu";
import { linkHostCaption } from "./sub/linkHostCaption";
import { TAB_INDENT_OPTIONS, tabStaysInEditor } from "./sub/tabIndent";

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
    const schema = useGenosSchema(
        {
            teamMemberProfiles: useTEM.teamMemberProfiles,
            socket,
            myself,
            setMyself,
            useUISM,
            useCM,
        },
        "mount"
    );

    const [showGifPicker, setShowGifPicker] = useState(false);
    const dictionary = useBlockNoteDictionary();

    const editor = useCreateBlockNote({
        ...TAB_INDENT_OPTIONS,
        tables: genosTableOptions,
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        initialContent: initialBody.length > 0 ? initialBody : EMPTY_DOC,
        extensions: [codeFenceInputRule, linkHostCaption, tabStaysInEditor],
        dictionary,
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
                        <GenosDocumentToolbar
                            editor={editor}
                            setShowGifPicker={setShowGifPicker}
                        />
                    )}
                />
                <GenosSuggestionMenus
                    editor={editor}
                    getMentionSources={() => ({
                        teamMemberProfiles: useTEM.teamMemberProfiles,
                        teamMembers: useTEM.teamMembers,
                        myselfUserId: myself.userId,
                        mentionGroups,
                    })}
                    slash={{ preset: "document", setShowGifPicker }}
                />
            </BlockNoteView>
        </Box>
    );
};

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useRef } from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { FormattingToolbarController, SideMenu, SideMenuController } from "@blocknote/react";
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
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosDocumentToolbar } from "./genos/GenosToolbars";
import { useGenosEditor } from "./genos/useGenosEditor";
import { CustomDragHandleMenu } from "./sub/CustomDragHandleMenu";

// No GIF picker on this surface: the `/` menu and the toolbar leave media out (MIP-1334).
const NO_GIF_PICKER = () => {};

type BnTodoPreviewProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    customClassName?: string;
    useUISM: UIStateManagementState;
    setBodyEdited: (value: boolean) => void;
    useCM: ChatManagementState;
};
export const BnTodoPreview = (props: BnTodoPreviewProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        body,
        setBody,
        customClassName,
        useUISM,
        setBodyEdited,
        useCM,
    } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName = customClassName
        ? `${customClassName}-${mode}`
        : `bn-todo-bubble-box-${mode}`;

    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);

    const { mentionGroups } = useMentionGroupsContext();

    // The shared Genos schema, with every block type. A todo body used to be built on a
    // smaller schema (no headings, tables, files, images or quotes, and a plain code block),
    // which is the drift MIP-1019 forbids: a schema that lacks a type rejects a body that has
    // one.
    //
    // Since MIP-1334 the notes are edited like a task body: the same `/` menu, drag handle,
    // link toolbar, table handles and formatting toolbar (headings and quotes included). The
    // one thing left out is media (images, video, audio, files, GIFs): a to-do has nowhere to
    // upload a file to, so the `/` menu's `todo` preset and `media={false}` drop them.
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

    const dictionary = useBlockNoteDictionary();
    const editor = useGenosEditor({ surface: "todo", schema, dictionary, initialContent: body });

    return (
        <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ px: "10px" }}>
            <BlockNoteView
                className="bn-box"
                editable={true}
                editor={editor}
                emojiPicker={false}
                filePanel={false}
                formattingToolbar={false}
                // Off on the view because the custom controllers below replace them: with the
                // built-in ones on as well, "/" opens two menus and the drag handle never wires
                // up (the same reason as in the task editor).
                sideMenu={false}
                slashMenu={false}
                theme={mode === "dark" ? "dark" : "light"}
                data-changing-font-demo // custom font
                onChange={() => {
                    setBody(editor.document);
                    setBodyEdited(true);
                }}
            >
                <SideMenuController
                    sideMenu={(props) => (
                        <SideMenu {...props} dragHandleMenu={CustomDragHandleMenu} />
                    )}
                />
                <FormattingToolbarController
                    formattingToolbar={() => (
                        <GenosDocumentToolbar
                            editor={editor}
                            media={false}
                            setShowGifPicker={NO_GIF_PICKER}
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
                    slash={{ preset: "todo", setShowGifPicker: NO_GIF_PICKER }}
                />
            </BlockNoteView>
        </Box>
    );
};

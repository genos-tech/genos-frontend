// The message of a scheduled message (MIP-2482), written in the chat page's editor: the same
// schema, toolbar, `@` / `#` / `:` / `/` menus and emoji picker as `bnChatEditor`, because the run
// posts these blocks as a chat message. What a chat composer has and this does not: Send, drafts,
// and images or files (the server refuses them: an upload belongs to one chat, and the schedule's
// chat can be changed), so there is no attach button, GIF button or media item in the `/` menu.
//
// Default export: the form loads it only when the member picks this job.

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { memo, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import type { SkillsHost } from "../../../features/genos/skills/skillsHost";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../../hooks/common/useIsMobile";
import { g } from "../../../theme/tokens";
import { useBlockNoteDictionary } from "../../editors/blockNoteI18n";
import { insertEmojiValue } from "../../editors/customEmojiHelpers";
import { useGenosSchema } from "../../editors/genos/genosSchema";
import { GenosSuggestionMenus } from "../../editors/genos/GenosSuggestionMenus";
import { GenosChatToolbar } from "../../editors/genos/GenosToolbars";
import { useGenosEditor } from "../../editors/genos/useGenosEditor";
import { withoutTrailingBlank, withTrailingBlank } from "../../editors/utils/messageBlocks";
import { useInsertSelectedEmoji } from "../../editors/utils/useInsertSelectedEmoji";
import { EmojiPicker } from "../../ui/emoji/EmojiPicker";

type Props = {
    host: SkillsHost;
    /** The stored body when editing; [] for a new message. Read once. */
    initialBody: unknown[];
    /** The body as a chat message stores it (with the trailing blank line). */
    onChange: (body: unknown[]) => void;
    /** The id of the field's label. */
    labelledBy: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- the editor's raw block array, as everywhere */
const ScheduleMessageEditor = ({ host, initialBody, onChange, labelledBy }: Props) => {
    const { myself, setMyself, socket, useTEM, useCM, useUISM } = host;
    const { mode, systemMode } = useColorScheme();
    // Joy reports "system" until it resolves; the resolved scheme is the one BlockNote needs.
    const scheme = (mode === "system" ? systemMode : mode) ?? "light";
    const isMobile = useIsMobile();
    const urlLinkModal = useUrlLinkModal();
    const boxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(boxRef, urlLinkModal);

    const { mentionGroups } = useMentionGroupsContext();
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
    const editor = useGenosEditor({
        surface: "composer",
        schema,
        dictionary,
        initialContent:
            initialBody.length > 0
                ? (withoutTrailingBlank(initialBody) as PartialBlock[])
                : undefined,
    });

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
    useInsertSelectedEmoji(selectedEmoji, (emoji: string) => {
        insertEmojiValue(editor, emoji);
        setShowEmojiPicker(false);
    });

    // The `@` menu reads the latest team without re-creating the editor.
    const teamRef = useRef(useTEM);
    const groupsRef = useRef(mentionGroups);
    useEffect(() => {
        teamRef.current = useTEM;
        groupsRef.current = mentionGroups;
    }, [useTEM, mentionGroups]);

    return (
        <Box sx={{ minWidth: 0 }}>
            {/* Fixed to the window: the editor sits in a scrolling dialog, which would
                cut off a picker anchored above the editor. */}
            <EmojiPicker
                pickerBottomPosition="auto"
                pickerLeftPosition="max(8px, calc(50vw - 176px))"
                pickerTopPosition="12vh"
                useFixedPosition
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <Box
                ref={boxRef}
                aria-labelledby={labelledBy}
                className={`bn-chat-editor-box-${scheme}`}
                data-testid="schedule-message-editor"
                role="group"
                sx={{
                    position: "relative",
                    minWidth: 0,
                    border: "1px solid",
                    borderColor: g.border.default,
                    borderRadius: 8,
                    "& .bn-editor": { borderRadius: 8 },
                }}
            >
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    emojiPicker={false}
                    formattingToolbar={false}
                    sideMenu={false}
                    slashMenu={false}
                    theme={scheme}
                    data-changing-font-demo
                    onChange={() =>
                        onChange(
                            withTrailingBlank(JSON.parse(JSON.stringify(editor.document)) as any[])
                        )
                    }
                >
                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: "absolute",
                            top: { xs: 0, md: "1%" },
                            left: { xs: 0, md: "0.5%" },
                            zIndex: 1,
                            p: { xs: 0.25, md: 0.7 },
                        }}
                    >
                        <GenosChatToolbar
                            editor={editor}
                            isMobile={isMobile}
                            setShowEmojiPicker={setShowEmojiPicker}
                        />
                    </Box>
                    <GenosSuggestionMenus
                        editor={editor}
                        slash={{ preset: "message", setShowGifPicker: () => undefined }}
                        getMentionSources={() => ({
                            teamMemberProfiles: teamRef.current.teamMemberProfiles,
                            teamMembers: teamRef.current.teamMembers,
                            myselfUserId: myself.userId,
                            mentionGroups: groupsRef.current,
                        })}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};

// The form re-renders on every keystroke of any field; the editor only when its own props do.
export default memo(
    ScheduleMessageEditor,
    (a, b) => a.onChange === b.onChange && a.labelledBy === b.labelledBy
);

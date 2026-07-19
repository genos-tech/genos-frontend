import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useMemo } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { CreateCustomEmojiSpec } from "./CustomEmoji";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
} from "./HashMention";
import { CreateMentionGroupSpec, CreateMentionSpec } from "./Mention";

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
 * project body template.
 *
 * Unlike `bnTaskPreview` it is not wired to a Yjs/Hocuspocus doc — a
 * template belongs to no task — and unlike the comment/thread editors it
 * never emits on save; it only reports the current document via
 * `onChange` so the host modal can POST/PUT it.
 *
 * Its schema MUST stay identical to `bnTaskPreview`'s (defaults minus
 * audio/video + syntax-highlighted codeBlock; `mention`, `mentionGroup`,
 * `customEmoji`, `hash*` inline content). A template's saved body is
 * later applied to the create form via `editor.replaceBlocks`, which
 * throws if the body carries a block/inline type the task editor's
 * schema lacks — so the two schemas must never drift.
 */
export const BnLocalBodyEditor = (props: BnLocalBodyEditorProps) => {
    const { useTEM, myself, setMyself, socket, useUISM, useCM, initialBody, onChange } = props;
    const { mode } = useColorScheme();

    // Memoized [] on purpose: `useCreateBlockNote` keeps its first schema
    // for the editor's lifetime, so rebuilding the spec set on later
    // renders is discarded work. The mount-time closures (team profiles
    // etc.) are what the editor captures.
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

    const editor = useCreateBlockNote({
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        initialContent: initialBody.length > 0 ? initialBody : EMPTY_DOC,
    });

    return (
        <BlockNoteView
            editor={editor}
            theme={mode === "dark" ? "dark" : "light"}
            editable
            onChange={() => onChange(editor.document as PartialBlock[])}
        />
    );
};

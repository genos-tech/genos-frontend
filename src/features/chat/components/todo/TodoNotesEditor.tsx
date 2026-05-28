import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { BnTodoPreview } from "../../../../components/editors/bnTodoPreview";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";

interface TodoNotesEditorProps {
    body: PartialBlock[];
    setBody: (blocks: PartialBlock[]) => void;
    onEdited: () => void;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    socket: Socket | null;
}

// Per-item rich-text notes editor. Reuses BnTodoPreview's BlockNote
// configuration (mentions, formatting toolbar, no headings/tables).
// Note: checkListItem blocks remain available inside notes, but the
// item's `is_completed` field on the row is the source of truth for
// completion — nested checkboxes inside notes are presentational only
// and must not be wired into the completion logic.
export const TodoNotesEditor = (props: TodoNotesEditorProps) => {
    const { body, setBody, onEdited, myself, setMyself, useTEM, useUISM, useCM, socket } = props;
    return (
        <BnTodoPreview
            body={body}
            customClassName="todo-item-notes"
            myself={myself}
            setBody={(b) => setBody(b as PartialBlock[])}
            setMyself={setMyself}
            socket={socket}
            useCM={useCM}
            useTEM={useTEM}
            useUISM={useUISM}
            setBodyEdited={(edited) => {
                if (edited) onEdited();
            }}
        />
    );
};

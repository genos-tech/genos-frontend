import { useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Autocomplete from "@mui/joy/Autocomplete";
import Box from "@mui/joy/Box";

import { Spinner } from "../../../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../../../context/authState";
import { useLatestRef } from "../../../../../hooks/common/useLatestRef";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { ChatNoteProps } from "../../../../../types/notes";
import { loadChatSubNotes } from "../../../chat-notes/services/loadChatSubNotes";

const NO_NOTES: ChatNoteProps[] = [];

type ACChatChildNotesProps = {
    myself: UserProps;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    useNM: NoteManagementState;
};
export const ACChatChildNotes = (props: ACChatChildNotesProps) => {
    const { myself, openSearchBox, setOpenSearchBox, useNM } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    // Which note's children the box is about. A list is only ever shown for the note it was loaded for.
    const target = useNM.currentChatNote?.noteId;
    const [loaded, setLoaded] = useState<{ target: typeof target; notes: ChatNoteProps[] }>();
    const isLoaded = loaded !== undefined && loaded.target === target;
    const options = isLoaded ? loaded.notes : NO_NOTES;
    // Not `options.length === 0`: a task or note with nothing to list has still answered.
    const loading = openSearchBox && !isLoaded;

    const onChangeHandler = async (value: ChatNoteProps) => {
        useNM.tabsApi.openTab({
            kind: "chat",
            noteType: 3,
            noteId: value.noteId,
            chatType: value.chatType,
            chatId: value.chatId,
            isThread: value.isThread,
            threadId: value.threadId,
            id: `chat-${value.noteId}`,
            title: value.title,
            teamId: myself.teamId,
        });
    };

    // One load per opening and per note; who asks is read then.
    const latestRef = useLatestRef({ myself, accessToken });

    useEffect(() => {
        let active = true;

        if (!openSearchBox) {
            return undefined;
        }

        (async () => {
            const { myself, accessToken } = latestRef.current;
            // Undefined after an API error.
            const notes: ChatNoteProps[] =
                (await loadChatSubNotes(myself, target as number, accessToken)) ?? [];

            if (active) {
                setLoaded({ target, notes });
            }
        })();

        // Closing the box drops the list, so the next opening asks again.
        return () => {
            active = false;
            setLoaded(undefined);
        };
    }, [openSearchBox, target, latestRef]);

    return (
        <Autocomplete
            aria-label={t.notes.autocomplete.searchAria}
            getOptionKey={(option) => option.noteId}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.noteId === value.noteId}
            loading={loading}
            open={openSearchBox}
            options={options}
            placeholder={t.notes.autocomplete.searchChildNotes}
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            endDecorator={
                loading ? (
                    // Masks the popup arrow under it, as the old spinner's own background did.
                    <Box sx={{ display: "inline-flex", bgcolor: "background.surface" }}>
                        <Spinner />
                    </Box>
                ) : null
            }
            onChange={(event, value) => {
                if (value) {
                    onChangeHandler(value);
                }
            }}
            onClose={() => {
                setOpenSearchBox(false);
            }}
            onOpen={() => {
                setOpenSearchBox(true);
            }}
        />
    );
};

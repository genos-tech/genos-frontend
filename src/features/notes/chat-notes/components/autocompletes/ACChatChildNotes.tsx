import { useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Autocomplete from "@mui/joy/Autocomplete";
import CircularProgress from "@mui/joy/CircularProgress";

import { useAuth } from "../../../../../context/AuthContext";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../../types/admin";
import { ChatNoteProps } from "../../../../../types/notes";
import { loadChatSubNotes } from "../../../chat-notes/services/loadChatSubNotes";

type ACChatChildNotesProps = {
    myself: UserProps;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    useNM: NoteManagementState;
};
export const ACChatChildNotes = (props: ACChatChildNotesProps) => {
    const { myself, openSearchBox, setOpenSearchBox, useNM } = props;
    const { accessToken } = useAuth();
    const [options, setOptions] = useState<ChatNoteProps[]>([]);
    const loading = openSearchBox && options.length === 0;

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

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: ChatNoteProps[] = await loadChatSubNotes(
                myself,
                useNM.currentChatNote?.noteId as number,
                accessToken
            );

            if (active) {
                setOptions([...loadedUsers]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        if (!open) {
            setOptions([]);
        }
    }, [openSearchBox]);

    return (
        <Autocomplete
            aria-label="Search"
            getOptionKey={(option) => option.noteId}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.noteId === value.noteId}
            loading={loading}
            open={openSearchBox}
            options={options}
            placeholder={"Search Child Notes"}
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            endDecorator={
                loading ? (
                    <CircularProgress size="sm" sx={{ bgcolor: "background.surface" }} />
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

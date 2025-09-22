import { useState, useEffect } from "react";
import Autocomplete from "@mui/joy/Autocomplete";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CircularProgress from "@mui/joy/CircularProgress";

import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { loadChatSubNotes } from "../../services/loadChatSubNotes";
import { useAuth } from "../../../../context/AuthContext";

type ACChatChildNotesProps = {
    myself: UserProps;
    noteId: number;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    setCurrentChatNote: (value: ChatNoteProps) => void;
};
export const ACChatChildNotes = (props: ACChatChildNotesProps) => {
    const { myself, noteId, openSearchBox, setOpenSearchBox, setCurrentChatNote } = props;
    const { accessToken } = useAuth();
    const [options, setOptions] = useState<ChatNoteProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: ChatNoteProps) => {
        setCurrentChatNote(value);
    };

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: ChatNoteProps[] = await loadChatSubNotes(
                myself,
                noteId,
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
            placeholder={"Search"}
            open={openSearchBox}
            onOpen={() => {
                setOpenSearchBox(true);
            }}
            onClose={() => {
                setOpenSearchBox(false);
            }}
            isOptionEqualToValue={(option, value) => option.noteId === value.noteId}
            getOptionLabel={(option) => option.title}
            getOptionKey={(option) => option.noteId}
            options={options}
            loading={loading}
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
            size="sm"
            startDecorator={<SearchRoundedIcon />}
            aria-label="Search"
        />
    );
};

import { useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Autocomplete from "@mui/joy/Autocomplete";
import CircularProgress from "@mui/joy/CircularProgress";

import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { TaskNoteProps } from "../../../../../types/notes";
import { loadTaskNotes } from "../../services/loadTaskNotes";

type ACTaskNotesProps = {
    myself: UserProps;
    projectId: number;
    taskId: number;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
};
export const ACTaskNotes = (props: ACTaskNotesProps) => {
    const { myself, projectId, taskId, openSearchBox, setOpenSearchBox, setCurrentTaskNote } =
        props;
    const { accessToken } = useAuth();
    const [options, setOptions] = useState<TaskNoteProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: TaskNoteProps) => {
        setCurrentTaskNote(value);
    };

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: TaskNoteProps[] = await loadTaskNotes(
                myself,
                projectId,
                taskId,
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
            placeholder={"Search Task Notes"}
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

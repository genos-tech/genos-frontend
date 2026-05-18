import { useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Autocomplete from "@mui/joy/Autocomplete";
import CircularProgress from "@mui/joy/CircularProgress";

import { useAuth } from "../../../../../context/AuthContext";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TaskNoteProps } from "../../../../../types/notes";
import { loadTaskNotes } from "../../services/loadTaskNotes";

type ACTaskNotesProps = {
    myself: UserProps;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    useNM: NoteManagementState;
};
export const ACTaskNotes = (props: ACTaskNotesProps) => {
    const { myself, openSearchBox, setOpenSearchBox, useNM } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [options, setOptions] = useState<TaskNoteProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: TaskNoteProps) => {
        useNM.tabsApi.openTab({
            kind: "task",
            noteType: 2,
            noteId: value.noteId,
            projectId: value.projectId,
            taskId: value.taskId,
            id: `task-${value.noteId}`,
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
            const loadedUsers: TaskNoteProps[] = await loadTaskNotes(
                myself,
                useNM.currentTaskNote?.projectId as number,
                useNM.currentTaskNote?.taskId as number,
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
            aria-label={t.notes.autocomplete.searchAria}
            getOptionKey={(option) => option.noteId}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.noteId === value.noteId}
            loading={loading}
            open={openSearchBox}
            options={options}
            placeholder={t.notes.autocomplete.searchTaskNotes}
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

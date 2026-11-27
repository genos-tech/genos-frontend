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
import { TaskNoteProps } from "../../../../../types/notes";
import { loadTaskNotes } from "../../services/loadTaskNotes";

const NO_NOTES: TaskNoteProps[] = [];

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
    // Which task's notes the box is about. A list is only ever shown for the task it was loaded for.
    const target = `${useNM.currentTaskNote?.projectId}:${useNM.currentTaskNote?.taskId}`;
    const [loaded, setLoaded] = useState<{ target: typeof target; notes: TaskNoteProps[] }>();
    const isLoaded = loaded !== undefined && loaded.target === target;
    const options = isLoaded ? loaded.notes : NO_NOTES;
    // Not `options.length === 0`: a task or note with nothing to list has still answered.
    const loading = openSearchBox && !isLoaded;

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

    // One load per opening and per task; who asks is read then.
    const latestRef = useLatestRef({
        myself,
        accessToken,
        projectId: useNM.currentTaskNote?.projectId,
        taskId: useNM.currentTaskNote?.taskId,
    });

    useEffect(() => {
        let active = true;

        if (!openSearchBox) {
            return undefined;
        }

        (async () => {
            const { myself, accessToken, projectId, taskId } = latestRef.current;
            const notes: TaskNoteProps[] =
                (await loadTaskNotes(
                    myself,
                    projectId as number,
                    taskId as number,
                    accessToken
                )) ?? [];

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
            placeholder={t.notes.autocomplete.searchTaskNotes}
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

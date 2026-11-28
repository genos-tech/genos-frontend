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

    // One load per time the box starts loading; who asks and for which task are read then.
    const latestRef = useLatestRef({
        myself,
        accessToken,
        projectId: useNM.currentTaskNote?.projectId,
        taskId: useNM.currentTaskNote?.taskId,
    });

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const { myself, accessToken, projectId, taskId } = latestRef.current;
            const loadedUsers: TaskNoteProps[] =
                (await loadTaskNotes(
                    myself,
                    projectId as number,
                    taskId as number,
                    accessToken
                )) ?? [];

            if (active) {
                setOptions([...loadedUsers]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading, latestRef]);

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

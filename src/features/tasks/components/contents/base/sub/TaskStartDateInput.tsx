import { Button, Input, Stack, useColorScheme } from "@mui/joy";

import { TaskProps } from "../../../../../../types/tasks";
import { getFormattedDateStr } from "../../../../../../utils/dateUtils";

type Props = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};

// Sibling of TaskDueDateInput for the optional start_date field. No
// today-min on the input — a start date can legitimately be in the
// past (e.g. when scheduling for a task already in progress).
export const TaskStartDateInput = ({ taskContent, setTaskContent, setTaskUpdated }: Props) => {
    const { mode } = useColorScheme();
    return (
        <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5}>
            <Input
                color="neutral"
                size="sm"
                type="date"
                value={taskContent.startDate ?? ""}
                variant="outlined"
                sx={{
                    "& input::-webkit-calendar-picker-indicator": {
                        filter: mode === "dark" ? "invert()" : "none",
                        cursor: "pointer",
                    },
                }}
                onChange={(e) => {
                    setTaskContent({
                        ...taskContent,
                        startDate: e.target.value
                            ? getFormattedDateStr(new Date(e.target.value))
                            : null,
                    });
                    if (setTaskUpdated) setTaskUpdated(true);
                }}
            />
            <Button
                color="neutral"
                size="sm"
                variant="outlined"
                onClick={() => {
                    setTaskContent({ ...taskContent, startDate: null });
                    if (setTaskUpdated) setTaskUpdated(true);
                }}
            >
                Clear
            </Button>
        </Stack>
    );
};

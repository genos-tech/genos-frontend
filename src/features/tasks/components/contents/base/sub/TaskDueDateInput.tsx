import { Button, Input, Stack, useColorScheme } from "@mui/joy";

import { TaskProps } from "../../../../../../types/tasks";
import { getFormattedDateStr, getFormattedTodayDateStr } from "../../../../../../utils/dateUtils";

type TaskDueDateInputProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const TaskDueDateInput = (props: TaskDueDateInputProps) => {
    const { taskContent, setTaskContent, setTaskUpdated } = props;
    const { mode } = useColorScheme();
    return (
        <Stack alignItems="center" direction="row" justifyContent="center" spacing={1.5}>
            <Input
                color="neutral"
                size="sm"
                type="date"
                value={taskContent.dueDate ? taskContent.dueDate : ""}
                variant="outlined"
                slotProps={{
                    input: {
                        min: getFormattedTodayDateStr(),
                    },
                }}
                sx={{
                    "& input::-webkit-calendar-picker-indicator": {
                        filter: mode === "dark" ? "invert()" : "none",
                        cursor: "pointer",
                    },
                }}
                onChange={(e) => {
                    setTaskContent({
                        ...taskContent,
                        dueDate: getFormattedDateStr(new Date(e.target.value)),
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }}
            />
            <Button
                color="neutral"
                component="a"
                size="sm"
                variant="outlined"
                onClick={() => {
                    setTaskContent({
                        ...taskContent,
                        dueDate: "",
                        // Drop any cached days-left so downstream
                        // consumers (table, sprint card, IDB row) don't
                        // briefly render "Expired" for an unscheduled
                        // task while the next backend round-trip is
                        // still in flight.
                        daysLeft: undefined,
                    });
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }}
            >
                TBD
            </Button>
        </Stack>
    );
};

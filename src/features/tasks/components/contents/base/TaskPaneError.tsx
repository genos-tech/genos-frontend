import { Sheet } from "@mui/joy";

import { ErrorState } from "../../../../../components/ui/feedback/ErrorState";
import { g } from "../../../../../theme/tokens";

// The dead-end counterpart to `TaskPaneLoading`.
//
// The create-task form can't render until its backend scaffold row exists,
// so a failed/hung bootstrap left the loading pane spinning forever with no
// way out and (on the silent paths) nothing in the console. This is the
// escape hatch: say what happened, and offer Retry / Cancel.
//
// The shared `ErrorState` (MIP-1306) draws the message and the buttons; this
// file is only the pane frame around it: the same footprint as the loader
// (`minHeight: 500` from `md`, edge to edge below it) so nothing reflows when
// it replaces the loader. Colors come from the tokens, not literals.

type TaskPaneErrorProps = {
    /** What failed. */
    title: string;
    /** Why, when the server said (a plan limit); defaults to the connection hint. */
    body?: string;
    cancelLabel: string;
    onRetry: () => void;
    onCancel: () => void;
};

export const TaskPaneError = ({
    title,
    body,
    cancelLabel,
    onRetry,
    onCancel,
}: TaskPaneErrorProps) => (
    <Sheet
        data-pane="task-error"
        sx={{
            flex: 1,
            // Full-screen frame below `md`, matching TaskPaneLoading and the
            // loaded TaskPreviewLayout (see the note on TaskPaneLoading).
            minHeight: { xs: 0, md: 500 },
            borderRadius: { xs: 0, md: g.radius.lg },
            p: 0,
            overflow: "hidden",
            background: g.surface.default,
            border: { xs: "none", md: `1px solid ${g.border.default}` },
            boxShadow: { xs: "none", md: g.shadow.md },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: 3,
        }}
    >
        <ErrorState
            body={body}
            data-error="task-bootstrap"
            secondary={{ label: cancelLabel, onClick: onCancel }}
            size="md"
            title={title}
            onRetry={onRetry}
        />
    </Sheet>
);

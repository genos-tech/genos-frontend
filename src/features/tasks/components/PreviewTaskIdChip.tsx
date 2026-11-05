import { CopyableTaskIdChip } from "./CopyableTaskId";

type PreviewTaskIdChipProps = {
    // Anything `formatTaskDisplayId` can resolve: a task, or a milestone's
    // `{ displayId, id: backing taskId }`.
    task: { displayId?: string | null; id?: number | string | null } | null | undefined;
    isDark: boolean;
};

// The id chip in the preview header, between the status button and the
// status chip. One component so the task and the milestone preview can't
// drift apart in look or position.
export const PreviewTaskIdChip = ({ task, isDark }: PreviewTaskIdChipProps) => (
    <CopyableTaskIdChip
        fallback="N/A"
        size="md"
        task={task}
        variant="soft"
        sx={{
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.75rem",
            px: 1.5,
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            border: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
        }}
    />
);

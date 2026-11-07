import { STATUS_TONE, toneBase, toneSoftBg } from "../meta/taskTone";
import { StatusLabel } from "./meta/StatusLabel";

// Soft status swatch for the dashboard (stat tiles read `.bg`, and rewrite its
// alpha by string, so it keeps the `rgba(r, g, b, 0.12)` shape). Derived from
// the one tone source (MIP-1122): Pending used to be orange here and purple in
// the table.
const softSwatch = (status: "Open" | "WIP" | "Blocked" | "Pending" | "Closed") => {
    const tone = STATUS_TONE[status];
    return { bg: toneSoftBg(tone, 0.12), text: toneBase(tone) };
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Open: softSwatch("Open"),
    WIP: softSwatch("WIP"),
    Blocked: softSwatch("Blocked"),
    Pending: softSwatch("Pending"),
    Closed: softSwatch("Closed"),
};

export { getStatusIcon } from "./meta/statusIcons";

type TaskStatusChipProps = {
    status: string;
    iconSize?: number;
};

/**
 * The dashboard status: the color in the icon, the words neutral (MIP-1122; it was
 * a soft-filled colored chip). Used by the "Up Next" / "Top by Weight" rows and
 * the "Assigned Milestones" card; milestone statuses share the vocabulary.
 */
export const TaskStatusChip = ({ status, iconSize = 12 }: TaskStatusChipProps) => (
    <StatusLabel iconSize={iconSize} status={status} />
);

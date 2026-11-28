import { BUILTIN_STATUSES } from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";

/** The built-in names. A team's status cannot take one, so a recorded label that equals one is
 *  that built-in, still unrenamed, and is translated like it. */
const BUILTIN_KEYS = new Set(BUILTIN_STATUSES.map((s) => s.key));

/**
 * One side of a status change in the activity feed (MIP-2493). The row snapshots the name and
 * colour the project had, so it still reads after a rename or delete; a side with none was the
 * category's default.
 */
export const ActivityStatusChip = ({
    category,
    label,
    color,
    projectId,
}: {
    category: string;
    label?: string | null;
    color?: string | null;
    projectId?: number | null;
}) => (
    <StatusLabel
        projectId={label ? null : projectId}
        status={category}
        row={
            label
                ? {
                      name: label,
                      builtinKey: BUILTIN_KEYS.has(label) ? label : null,
                      color: color ?? "",
                      category,
                  }
                : null
        }
    />
);

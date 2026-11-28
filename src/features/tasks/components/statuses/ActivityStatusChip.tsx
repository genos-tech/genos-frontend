import { BUILTIN_STATUSES, builtinName, IN_REVIEW_KEY } from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";

/** The built-in names. A team's status cannot take one, so a recorded label that equals one is
 *  that built-in, still unrenamed, and is translated like it. "In Review", the earlier name of
 *  Ready, keeps its built-in colour and reads as it was recorded. */
const BUILTIN_KEY_BY_LABEL = new Map([
    ...BUILTIN_STATUSES.map((s) => [builtinName(s.key), s.key] as const),
    [IN_REVIEW_KEY, IN_REVIEW_KEY] as const,
]);

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
                      builtinKey: BUILTIN_KEY_BY_LABEL.get(label) ?? null,
                      color: color ?? "",
                      category,
                  }
                : null
        }
    />
);

import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { displayIdMatches } from "../../utils/taskDisplayId";

// A task matches by title or by display id ("MIP-739", "mip739", "739").
export const filterTaskSearchOptions = (
    options: SearchTeamTasksResponse[],
    input: string
): SearchTeamTasksResponse[] => {
    const q = input.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
        (o) => (o.title ?? "").toLowerCase().includes(q) || displayIdMatches(q, o.displayId)
    );
};

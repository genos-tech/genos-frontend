import { createFilterOptions } from "@mui/joy/Autocomplete";

import type { SearchListProps } from "../../../../types/chat";
import { orderBySection } from "../../../../utils/mentionOrder";

const matchSearchOptions = createFilterOptions<SearchListProps>({
    stringify: (option) =>
        option.type === "People" ? `${option.name} ${option.email ?? ""}` : option.name,
});

// Groups before people (MIP-1701). The Autocomplete `groupBy` header only
// merges neighbouring options of one kind (it repeats the header otherwise),
// so all groups come first, then all people; an exact-name match is first
// inside its own section (MIP-1922).
type SearchFilterState = Parameters<ReturnType<typeof createFilterOptions<SearchListProps>>>[1];
export const filterSearchOptions = (
    options: SearchListProps[],
    state: SearchFilterState
): SearchListProps[] =>
    orderBySection(matchSearchOptions(options, state), state.inputValue, (option) => ({
        label: option.name,
        isGroup: option.type === "Group",
    }));

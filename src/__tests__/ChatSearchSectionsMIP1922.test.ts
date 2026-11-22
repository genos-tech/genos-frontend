import { createFilterOptions } from "@mui/joy/Autocomplete";
import { describe, expect, it } from "vitest";

import { filterSearchOptions } from "../features/chat/components/sidebar/chatSearchFilter";
import type { SearchListProps } from "../types/chat";

// MIP-1922: an exact person match used to sit above the groups, so the
// Autocomplete showed People / Group / People (a duplicated header).

type State = Parameters<ReturnType<typeof createFilterOptions<SearchListProps>>>[1];
const state = (inputValue: string): State => ({ inputValue, getOptionLabel: (o) => o.name });

const options: SearchListProps[] = [
    { type: "People", name: "Kenji", email: "kenji@x.dev" },
    { type: "Group", name: "kentaro team" },
    { type: "People", name: "Ken", email: "ken@x.dev" },
];

describe("ChatSearch filterSearchOptions (MIP-1922)", () => {
    it("keeps every group before every person, so each header renders once", () => {
        const types = filterSearchOptions(options, state("ken")).map((o) => o.type);
        expect(types).toEqual(["Group", "People", "People"]);
    });

    it("puts an exact-name person first inside the People section", () => {
        const names = filterSearchOptions(options, state("ken")).map((o) => o.name);
        expect(names).toEqual(["kentaro team", "Ken", "Kenji"]);
    });

    it("keeps an exact-name group first inside the Group section", () => {
        const names = filterSearchOptions(
            [
                { type: "Group", name: "kentaro team" },
                { type: "Group", name: "ken" },
            ],
            state("ken")
        ).map((o) => o.name);
        expect(names).toEqual(["ken", "kentaro team"]);
    });
});

// The pieces of a member dropdown that the member pickers share (MIP-1916).
//
// "Member's Tasks" and the Agent Activity "Person" filter are different controls, but a
// person must look like themself in both: the same option row (avatar, name, an optional
// count) and the same rules for matching a typed word and for telling two options apart.
// They live here once, the way `ProjectPickerParts` does for projects, so the two cannot drift.

import type { HTMLAttributes, Key } from "react";
import {
    AutocompleteOption,
    Chip,
    ListItemContent,
    ListItemDecorator,
    Typography,
} from "@mui/joy";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";

export type MemberOption = { id: string; name: string; count?: number };

/** The text type-to-filter matches on and the closed field shows. */
export const memberOptionLabel = (option: Pick<MemberOption, "name">): string => option.name;

/** Options are told apart by id: two members can share a name. */
export const isSameMember = (
    option: Pick<MemberOption, "id">,
    value: Pick<MemberOption, "id">
): boolean => option.id === value.id;

/**
 * One option row: avatar, name, and the count chip when the option has one.
 * MUI derives the option key from `getOptionLabel` (the NAME), so two members with the same
 * name collide; the key is dropped from the spread and set from the unique member id.
 */
export const renderMemberOption = <T extends MemberOption>() =>
    function MemberOptionRow(optionProps: Omit<HTMLAttributes<HTMLLIElement>, "color">, o: T) {
        const { key: _labelKey, ...rest } = optionProps as typeof optionProps & { key?: Key };
        void _labelKey;
        return (
            <AutocompleteOption key={o.id} {...rest}>
                <ListItemDecorator>
                    <UserAvatar clickable={false} showPulseDot={false} size={22} userId={o.id} />
                </ListItemDecorator>
                <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }} noWrap>
                        <bdi className="g-bidi-island">{o.name}</bdi>
                    </Typography>
                </ListItemContent>
                {o.count !== undefined && (
                    <Chip size="sm" variant="soft">
                        {o.count}
                    </Chip>
                )}
            </AutocompleteOption>
        );
    };

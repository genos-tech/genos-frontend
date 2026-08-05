import { useMemo, useState } from "react";
import { AutocompleteOption, ListItemContent, Stack, Typography } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { useTranslation } from "../../i18n";
import { sortMembersMyselfFirst } from "../editors/Mention";
import { UserAvatar } from "./avatars/UserAvatar";

/**
 * The narrowest thing a person needs to be to be pickable. Deliberately not
 * `UserProps`: the guest-side roster arrives from the share endpoints as three
 * fields, and a picker that demanded the full profile would have forced those
 * callers to invent the rest.
 */
export type PickablePerson = {
    userId: string;
    userName: string;
    userEmail?: string;
};

type Props = {
    /** Who can still be picked. Callers exclude whoever is already in. */
    options: PickablePerson[];
    /** Fires once per pick; the field clears itself for the next one. */
    onPick: (person: PickablePerson) => void;
    placeholder: string;
    /** The reader, so they read as "(You)" rather than as a stranger. */
    myUserId?: string;
    disabled?: boolean;
};

/**
 * "Add a person" — type to filter, one pick at a time.
 *
 * Same shape as the assignee / reporter pickers on a task
 * (`ACTeamUsers`, `MultiMemberPicker`): self first, then alphabetical,
 * avatar beside "Name - email". The surfaces that add people to a share or
 * a folder used to render the whole roster as a row of buttons, which is
 * fine for four colleagues and unusable for forty.
 *
 * It avatars through `UserAvatar`, which resolves the profile from context,
 * where the task pickers pass `AvatarWithStatus` a profile plus four hooks.
 * That is the reason this is a separate component rather than a re-use: it
 * can be dropped into a modal that has no access to those hooks, which is
 * every sharing surface. `clickable={false}` because inside an option the
 * avatar is a picture of a person, not a way to open them.
 */
export const PersonPicker = ({ options, onPick, placeholder, myUserId, disabled }: Props) => {
    const { t } = useTranslation();
    const youSuffix = t.common.personPicker.youSuffix;

    // Controlled and always `null`: a pick is an action here, not a
    // selection to display, so the field has to come back empty. Joy
    // otherwise leaves the chosen name behind as text, which reads as
    // "this person is still pending" when they have already been added.
    const [inputValue, setInputValue] = useState("");

    const sorted = useMemo(
        () => sortMembersMyselfFirst(options, myUserId ?? ""),
        [options, myUserId]
    );

    const label = (person: PickablePerson) => {
        const name =
            person.userId === myUserId ? `${person.userName} ${youSuffix}` : person.userName;
        return person.userEmail ? `${name} - ${person.userEmail}` : name;
    };

    return (
        <Autocomplete
            disabled={disabled}
            getOptionLabel={label}
            inputValue={inputValue}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            noOptionsText={t.common.personPicker.noMatches}
            options={sorted}
            placeholder={placeholder}
            size="sm"
            sx={{ width: "100%" }}
            value={null}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`person-option-${option.userId}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <UserAvatar
                                clickable={false}
                                showPulseDot={false}
                                size={26}
                                userId={option.userId}
                            />
                            <Typography level="body-sm">{label(option)}</Typography>
                        </Stack>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            clearOnBlur
            onInputChange={(_, next) => setInputValue(next)}
            onChange={(_, picked) => {
                if (!picked) return;
                onPick(picked);
                setInputValue("");
            }}
        />
    );
};

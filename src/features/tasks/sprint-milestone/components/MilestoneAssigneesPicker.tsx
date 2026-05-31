import { Autocomplete, Chip, Stack } from "@mui/joy";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";

type Props = {
    teamMembers: UserProps[];
    selected: UserProps[];
    onChange: (next: UserProps[]) => void;
    placeholder?: string;
    disabled?: boolean;
};

export const MilestoneAssigneesPicker = ({
    teamMembers,
    selected,
    onChange,
    placeholder,
    disabled,
}: Props) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t.tasks.picker.addAssignees;
    return (
        <Autocomplete
            disabled={disabled}
            getOptionLabel={(o) => o.userName || o.userEmail || String(o.userId)}
            isOptionEqualToValue={(o, v) => o.userId === v.userId}
            options={teamMembers}
            placeholder={resolvedPlaceholder}
            size="sm"
            sx={{ width: "100%" }}
            value={selected}
            renderOption={(optionProps, user) => (
                <li {...optionProps} key={String(user.userId)}>
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <UserAvatar
                            clickable={false}
                            showPulseDot={false}
                            size={22}
                            userId={user.userId}
                        />
                        <span>{user.userName || user.userEmail}</span>
                    </Stack>
                </li>
            )}
            renderTags={(value, getTagProps) =>
                value.map((user, index) => {
                    const { key: _key, ...tagProps } = getTagProps({ index });
                    return (
                        <Chip
                            key={String(user.userId)}
                            {...tagProps}
                            size="sm"
                            variant="soft"
                            startDecorator={
                                <UserAvatar
                                    clickable={false}
                                    showPulseDot={false}
                                    size={18}
                                    userId={user.userId}
                                />
                            }
                        >
                            {user.userName}
                        </Chip>
                    );
                })
            }
            multiple
            onChange={(_, v) => onChange(v as UserProps[])}
        />
    );
};

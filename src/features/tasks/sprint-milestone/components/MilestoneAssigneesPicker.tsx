import { Autocomplete, Avatar, Chip, Stack } from "@mui/joy";

import { UserProps } from "../../../../types/admin";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type Props = {
    teamMembers: UserProps[];
    selected: UserProps[];
    onChange: (next: UserProps[]) => void;
    placeholder?: string;
    disabled?: boolean;
};

const initial = (u: UserProps) => (u.userName?.[0] || u.userEmail?.[0] || "?").toUpperCase();

export const MilestoneAssigneesPicker = ({
    teamMembers,
    selected,
    onChange,
    placeholder = "Add assignees",
    disabled,
}: Props) => {
    return (
        <Autocomplete
            multiple
            size="sm"
            value={selected}
            options={teamMembers}
            placeholder={placeholder}
            disabled={disabled}
            isOptionEqualToValue={(o, v) => o.userId === v.userId}
            getOptionLabel={(o) => o.userName || o.userEmail || String(o.userId)}
            onChange={(_, v) => onChange(v as UserProps[])}
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
                                <Avatar
                                    size="sm"
                                    src={
                                        user.avatarImgPath
                                            ? `${media_url}/${user.avatarImgPath}`
                                            : undefined
                                    }
                                    sx={{ width: 18, height: 18, fontSize: 11 }}
                                >
                                    {initial(user)}
                                </Avatar>
                            }
                        >
                            {user.userName}
                        </Chip>
                    );
                })
            }
            renderOption={(optionProps, user) => (
                <li {...optionProps} key={String(user.userId)}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                            size="sm"
                            src={
                                user.avatarImgPath
                                    ? `${media_url}/${user.avatarImgPath}`
                                    : undefined
                            }
                            sx={{ width: 22, height: 22, fontSize: 12 }}
                        >
                            {initial(user)}
                        </Avatar>
                        <span>{user.userName || user.userEmail}</span>
                    </Stack>
                </li>
            )}
            sx={{ width: "100%" }}
        />
    );
};

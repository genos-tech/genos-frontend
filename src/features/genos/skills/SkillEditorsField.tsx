import { useState } from "react";
import {
    Box,
    Button,
    Chip,
    ChipDelete,
    FormControl,
    FormHelperText,
    FormLabel,
    Option,
    Select,
    Typography,
} from "@mui/joy";

import { toast } from "../../../components/ui/feedback/toastStore";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import type { UserProps } from "../../../types/admin";
import { addSkillEditor, removeSkillEditor, type SkillPerson, type SkillRow } from "./skillsApi";

type Props = {
    skill: SkillRow;
    /** The signed-in member, so an editor can leave and the owner is not offered themself. */
    myId: string;
    /** Everyone on the team: the owner picks the editors from here. */
    teamMembers: UserProps[];
    /** The editors as the server now has them; `left` = the member stopped editing. */
    onChange: (editors: SkillPerson[], left: boolean) => void;
};

/**
 * "Editors" in a skill's details (MIP-2043): the teammates who edit it with its owner.
 *
 * The owner adds and removes; a co-editor sees the list and can stop editing; a reader never gets
 * this field (the server sends no list). Each change is its own request, not part of the details'
 * Save: an invitation is not a draft.
 */
export const SkillEditorsField = ({ skill, myId, teamMembers, onChange }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosSkills.team;
    const { accessToken } = useAuth();
    const [busy, setBusy] = useState(false);

    const taken = new Set([...skill.editors.map((e) => e.id)]);
    const choices = teamMembers.filter(
        (member) =>
            member.userId !== myId && !taken.has(member.userId) && member.userName.trim() !== ""
    );

    const add = async (userId: string) => {
        if (busy) return;
        setBusy(true);
        const res = await addSkillEditor(accessToken, skill.id, userId);
        setBusy(false);
        if (res.ok) onChange(res.data, false);
        else toast.error(res.message || m.editorsFailed);
    };

    const remove = async (userId: string) => {
        if (busy) return;
        setBusy(true);
        const res = await removeSkillEditor(accessToken, skill.id, userId);
        setBusy(false);
        if (!res.ok) {
            toast.error(res.message || m.editorsFailed);
            return;
        }
        if (userId === myId) toast.success(m.editorLeft);
        onChange(res.data, userId === myId);
    };

    return (
        <FormControl>
            <FormLabel id="skill-editors">{m.editors}</FormLabel>
            <Box
                aria-labelledby="skill-editors"
                role="group"
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 0.75,
                    minWidth: 0,
                }}
            >
                {skill.editors.length === 0 ? (
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {m.editorsNone}
                    </Typography>
                ) : (
                    skill.editors.map((person) => {
                        const removable = skill.canManage;
                        return (
                            <Chip
                                key={person.id}
                                size="md"
                                variant="soft"
                                endDecorator={
                                    removable ? (
                                        <ChipDelete
                                            disabled={busy}
                                            aria-label={fmt(m.editorRemove, {
                                                name: person.username,
                                            })}
                                            onDelete={() => void remove(person.id)}
                                        />
                                    ) : undefined
                                }
                                sx={{
                                    maxWidth: "100%",
                                    "& .MuiChip-label": { overflowWrap: "anywhere" },
                                }}
                            >
                                {person.username}
                            </Chip>
                        );
                    })
                )}
            </Box>
            {skill.canManage ? (
                <Box sx={{ mt: 1, maxWidth: 360 }}>
                    <Select<string>
                        aria-label={m.editorsAdd}
                        disabled={busy || choices.length === 0}
                        placeholder={choices.length === 0 ? m.editorsEveryone : m.editorsChoose}
                        size="sm"
                        value={null}
                        onChange={(_e, value) => {
                            if (value) void add(value);
                        }}
                    >
                        {choices.map((member) => (
                            <Option key={member.userId} value={member.userId}>
                                {member.userName}
                            </Option>
                        ))}
                    </Select>
                </Box>
            ) : (
                <Box sx={{ mt: 1 }}>
                    <Button
                        disabled={busy}
                        size="sm"
                        variant="outlined"
                        onClick={() => void remove(myId)}
                    >
                        {m.editorLeave}
                    </Button>
                </Box>
            )}
            <FormHelperText>{m.editorsHelp}</FormHelperText>
        </FormControl>
    );
};

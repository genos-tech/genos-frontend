import { useMemo, type ReactElement } from "react";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import {
    Box,
    Chip,
    ChipDelete,
    FormControl,
    FormHelperText,
    FormLabel,
    Option,
    Select,
    Typography,
} from "@mui/joy";

import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { PersonPicker } from "../../../components/ui/PersonPicker";
import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import { fmt, useTranslation } from "../../../i18n";
import type { UserProps } from "../../../types/admin";
import type { AllChatProps } from "../../../types/chat";
import { ownTeamOnly } from "../../../utils/teamRoster";
import { shareKey } from "./skillDraft";
import { SKILL_LIMITS, type SkillShare, type SkillShareKind } from "./skillsApi";

type Props = {
    shares: SkillShare[];
    onChange: (next: SkillShare[]) => void;
    /** The signed-in member: the owner is never offered themself. */
    myId: string;
    /** Everyone on the team, from the list the app already holds. */
    teamMembers: UserProps[];
    /** The chats the member is in (group chats, and the chat of each project they are in). */
    allChats: AllChatProps[];
    disabled?: boolean;
    /** The sentence under the field when nobody is chosen yet and a save asked. */
    problem?: string | null;
};

/** A group the member may add: one row of the "Add a group" menu. */
type GroupChoice = SkillShare & { key: string };

const ICONS: Record<SkillShareKind, ReactElement> = {
    user: <GroupRoundedIcon fontSize="small" />,
    mentionGroup: <AlternateEmailRoundedIcon fontSize="small" />,
    groupChat: <ForumRoundedIcon fontSize="small" />,
    project: <FolderRoundedIcon fontSize="small" />,
};

/**
 * "Specific people" under "Who can use it" (MIP-2212): the people, mention groups, group chats and
 * projects a skill is shared with. People come from the same person picker (avatar + name) the task
 * preview and the sharing dialogs use; the quick adds are the mention groups, group chats and
 * projects the app already holds, so there is no new list to learn.
 *
 * A group is a LIVE link: the chip says so ("N people now"), and who is in it is asked every time
 * the skill is used. The list is part of the details' Save, not a request of its own, so a
 * half-chosen list never reaches the server. The server checks every new entry again.
 */
export const SkillSharesField = ({
    shares,
    onChange,
    myId,
    teamMembers,
    allChats,
    disabled = false,
    problem = null,
}: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosSkills.shares;
    const { mentionGroups } = useMentionGroupsContext();

    const taken = useMemo(() => new Set(shares.map(shareKey)), [shares]);
    const full = shares.length >= SKILL_LIMITS.sharesMax;

    const people = useMemo(
        () =>
            ownTeamOnly(teamMembers).filter(
                (member) =>
                    member.userId !== myId &&
                    member.userName.trim() !== "" &&
                    !taken.has(shareKey({ kind: "user", id: member.userId }))
            ),
        [teamMembers, myId, taken]
    );

    // The three group kinds, in one menu: mention groups from the context, projects through their
    // project chat (one per project the member is in), group chats from the chat list. A chat shared
    // with another team is left out: a skill never reaches outside the team.
    const groups = useMemo<GroupChoice[]>(() => {
        const out: GroupChoice[] = mentionGroups.map((g) => ({
            key: `mentionGroup:${g.groupId}`,
            kind: "mentionGroup",
            id: String(g.groupId),
            name: `@${g.groupName}`,
            memberCount: g.memberCount,
            available: true,
        }));
        for (const chat of allChats) {
            if (chat.isExternal === true) continue;
            if (chat.chatType === 3 && chat.project?.projectId != null) {
                out.push({
                    key: `project:${chat.project.projectId}`,
                    kind: "project",
                    id: String(chat.project.projectId),
                    name: chat.chatName,
                    memberCount: null,
                    available: true,
                });
            } else if (chat.chatType === 2) {
                out.push({
                    key: `groupChat:${chat.chatId}`,
                    kind: "groupChat",
                    id: String(chat.chatId),
                    name: chat.chatName,
                    memberCount: null,
                    available: true,
                });
            }
        }
        return out.filter((g) => !taken.has(shareKey(g)));
    }, [mentionGroups, allChats, taken]);

    const kindLabel: Record<SkillShareKind, string> = {
        user: m.kindUser,
        mentionGroup: m.kindMentionGroup,
        groupChat: m.kindGroupChat,
        project: m.kindProject,
    };

    const add = (share: SkillShare) => {
        if (full || taken.has(shareKey(share))) return;
        onChange([...shares, share]);
    };
    const remove = (share: SkillShare) =>
        onChange(shares.filter((s) => shareKey(s) !== shareKey(share)));

    return (
        <FormControl error={!!problem}>
            <FormLabel id="skill-shares">{m.label}</FormLabel>
            <Box
                aria-labelledby="skill-shares"
                role="group"
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 0.75,
                    minWidth: 0,
                }}
            >
                {shares.length === 0 ? (
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {m.nobody}
                    </Typography>
                ) : (
                    shares.map((share) => {
                        const name =
                            share.available || share.name !== "" ? share.name : m.unavailable;
                        const detail =
                            share.kind === "user" || !share.available
                                ? null
                                : share.memberCount !== null
                                  ? fmt(m.peopleNow, { count: share.memberCount })
                                  : kindLabel[share.kind];
                        return (
                            <Chip
                                key={shareKey(share)}
                                size="md"
                                variant="soft"
                                color={
                                    share.available || share.name !== "" ? "neutral" : "warning"
                                }
                                endDecorator={
                                    disabled ? undefined : (
                                        <ChipDelete
                                            aria-label={fmt(m.remove, { name })}
                                            onDelete={() => remove(share)}
                                        />
                                    )
                                }
                                startDecorator={
                                    share.kind === "user" ? (
                                        <UserAvatar
                                            clickable={false}
                                            fallbackName={name}
                                            showPulseDot={false}
                                            size={20}
                                            userId={share.id}
                                        />
                                    ) : (
                                        ICONS[share.kind]
                                    )
                                }
                                sx={{
                                    maxWidth: "100%",
                                    "& .MuiChip-label": { overflowWrap: "anywhere" },
                                }}
                            >
                                {detail ? `${name} · ${detail}` : name}
                            </Chip>
                        );
                    })
                )}
            </Box>
            {!disabled && (
                <Box
                    sx={{
                        mt: 1,
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "minmax(0, 1fr)",
                            sm: "repeat(2, minmax(0, 1fr))",
                        },
                        gap: 1,
                        maxWidth: 560,
                    }}
                >
                    {/* The shared person picker (avatar + name, type to search). */}
                    <PersonPicker
                        ariaLabel={m.addPerson}
                        disabled={full || people.length === 0}
                        myUserId={myId}
                        options={people}
                        placeholder={people.length === 0 ? m.everyone : m.addPerson}
                        onPick={(person) =>
                            add({
                                kind: "user",
                                id: person.userId,
                                name: person.userName,
                                memberCount: null,
                                available: true,
                            })
                        }
                    />
                    <Select
                        aria-label={m.addGroup}
                        disabled={full || groups.length === 0}
                        placeholder={groups.length === 0 ? m.noGroups : m.addGroup}
                        size="md"
                        value={null}
                        onChange={(_e, key) => {
                            const choice = groups.find((g) => g.key === key);
                            if (choice) add(choice);
                        }}
                    >
                        {groups.map((g) => (
                            <Option key={g.key} value={g.key}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    {ICONS[g.kind]}
                                    <Typography level="body-sm" noWrap>
                                        {g.name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                        {g.memberCount !== null
                                            ? fmt(m.peopleNow, { count: g.memberCount })
                                            : kindLabel[g.kind]}
                                    </Typography>
                                </Box>
                            </Option>
                        ))}
                    </Select>
                </Box>
            )}
            <FormHelperText aria-live="polite">
                {problem ?? (full ? fmt(m.max, { max: SKILL_LIMITS.sharesMax }) : m.help)}
            </FormHelperText>
        </FormControl>
    );
};

/**
 * What a cross-team request is ABOUT, as chips.
 *
 * Types 7 and 8 name their subject in the body — bold and coloured, from
 * `cross_team_notices.py` — but the body is a sentence, and these two cards
 * are the ones where the subject is the whole decision: an owner is being
 * asked to let another ORGANIZATION in, and "which one, to what" should not
 * have to be read out of prose.
 *
 * Deliberately not clickable, unlike `InboxTargetChip`. The reader has no
 * access to the offered object yet — that is the point of the card — so
 * there is nothing to open, and that component's own rule applies: a chip
 * that opens nothing is worse than no chip.
 *
 * Driven entirely by `itemOptionals`, which both notice types have carried
 * since they shipped, so no card needs rewriting and rows already in
 * people's inboxes gain the chips too.
 */
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Chip, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import { InboxItemProps } from "../../../types/common";

/** `item_type`s this component renders for. Mirrors `InboxBubble`. */
const TEAM_CONNECTION = 7;
const EXTERNAL_SHARE = 8;

/** `ExternalGrant.ObjectType` values, as they arrive in the optionals. */
type ObjectType = "channel" | "project" | "note_folder";

const OBJECT_ICONS: Record<ObjectType, React.ReactNode> = {
    channel: <ChatRoundedIcon sx={{ fontSize: 14 }} />,
    project: <FolderRoundedIcon sx={{ fontSize: 14 }} />,
    note_folder: <StickyNote2RoundedIcon sx={{ fontSize: 14 }} />,
};

// Teal for the team, matching the request-type badge on these two cards, so
// the chip reads as part of the same thought. The object keeps its own
// per-kind hue from the rest of the inbox (project green, chat pink, note
// amber) so the KIND of thing is legible before its name is read.
const TEAM_COLOR = { dark: "#2dd4bf", light: "#0d9488" };
const OBJECT_COLORS: Record<ObjectType, { dark: string; light: string }> = {
    channel: { dark: "#f472b6", light: "#ec4899" },
    project: { dark: "#4ade80", light: "#22c55e" },
    note_folder: { dark: "#fbbf24", light: "#f59e0b" },
};

const isObjectType = (value: unknown): value is ObjectType =>
    value === "channel" || value === "project" || value === "note_folder";

type InboxCrossTeamChipsProps = {
    inboxItem: InboxItemProps;
};

export const InboxCrossTeamChips = (props: InboxCrossTeamChipsProps) => {
    const { inboxItem } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const optionals = inboxItem.itemOptionals ?? {};
    const isConnection = inboxItem.itemType === TEAM_CONNECTION;
    const isShare = inboxItem.itemType === EXTERNAL_SHARE;
    if (!isConnection && !isShare) return null;

    const teamName = String(
        (isConnection ? optionals.requesting_team_name : optionals.owner_team_name) ?? ""
    );
    const rawObjectType = optionals.object_type;
    const objectType = isObjectType(rawObjectType) ? rawObjectType : null;
    // Falls back to the kind ("project", "chat", "note folder") when the
    // name is missing, which happens for an object deleted between the
    // offer and the reading of it. A chip saying what KIND of thing was
    // offered still beats no chip at all.
    const objectName =
        String(optionals.object_name ?? "") ||
        (objectType ? t.inbox.crossTeam.objectKinds[objectType] : "");

    if (!teamName && !objectName) return null;

    const chipSx = (color: { dark: string; light: string }) => ({
        maxWidth: "100%",
        borderRadius: "8px",
        fontWeight: 600,
        fontSize: "0.7rem",
        background: isDark ? `${color.dark}15` : `${color.light}12`,
        color: isDark ? color.dark : color.light,
        border: "1px solid",
        borderColor: isDark ? `${color.dark}25` : `${color.light}20`,
        "& .MuiChip-startDecorator": { color: "inherit" },
        "& .MuiChip-label": {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        },
    });

    return (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
            {teamName !== "" && (
                <Chip
                    size="sm"
                    startDecorator={<GroupsRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={chipSx(TEAM_COLOR)}
                    variant="soft"
                >
                    {teamName}
                </Chip>
            )}
            {isShare && objectName !== "" && (
                <Chip
                    size="sm"
                    startDecorator={objectType ? OBJECT_ICONS[objectType] : undefined}
                    sx={chipSx(objectType ? OBJECT_COLORS[objectType] : TEAM_COLOR)}
                    variant="soft"
                >
                    {objectName}
                </Chip>
            )}
        </Stack>
    );
};

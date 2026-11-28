import { ReactNode } from "react";
import { Box } from "@mui/joy";

import { ResolvedUserName } from "../../../components/ui/avatars/AvatarContext";
import { formatRelativeTime } from "../../../components/ui/dashboard/relativeTime";
import { ViaChip } from "../../../components/ui/misc/ViaChip";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { parseCalendarDate } from "../../../utils/calendarDate";
import { AssigneeAvatar, DueText, MilestoneFlag } from "../../tasks/components/card/parts";
import { StatusLabel } from "../../tasks/components/meta/StatusLabel";
import { formatDueLabel } from "../../tasks/utils/dashboardRowFormat";
import type { ViaApp } from "../../tasks/utils/viaSource";
import { factSx, metaSx } from "./cardStyles";
import type { CardPerson } from "./taskCardTypes";

export const Row = ({ children, sx }: { children: ReactNode; sx?: object }) => (
    <Box
        sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: 1.5,
            rowGap: 0.5,
            minWidth: 0,
            ...sx,
        }}
    >
        {children}
    </Box>
);

/** One line of text that gives way with an ellipsis, in its own direction. */
export const Clip = ({ children, max }: { children: ReactNode; max?: number }) => (
    <Box
        component="bdi"
        sx={{
            minWidth: 0,
            maxWidth: max,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        }}
    >
        {children}
    </Box>
);

/** The first line: which task, where it stands, when its message was sent. */
export const CardHeader = ({
    displayId,
    status,
    projectId,
    customStatusId,
    isMilestone,
    sentAt,
    viaApp,
}: {
    displayId: string;
    status: string | null | undefined;
    /** Of the live task: its project's names for statuses (MIP-2493). */
    projectId?: number | null;
    customStatusId?: number | null;
    isMilestone: boolean;
    sentAt: string;
    viaApp?: ViaApp;
}) => {
    const { t } = useTranslation();
    return (
        <Row sx={{ columnGap: 1 }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                {isMilestone && <MilestoneFlag />}
                <Box
                    component="bdi"
                    sx={{ ...metaSx, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                >
                    {displayId}
                </Box>
                {isMilestone && (
                    <Box component="span" sx={{ ...metaSx, fontWeight: 500 }}>
                        {t.chat.taskCard.milestone}
                    </Box>
                )}
            </Box>
            {status && (
                <StatusLabel
                    customStatusId={customStatusId}
                    projectId={projectId}
                    status={status}
                />
            )}
            <Box sx={{ marginInlineStart: "auto", display: "inline-flex", gap: 0.75 }}>
                <Box component="span" sx={metaSx}>
                    {sentAt}
                </Box>
                {viaApp && <ViaChip source={{ kind: "mcp", name: null, app: viaApp }} />}
            </Box>
        </Row>
    );
};

export const CardTitle = ({ children }: { children: ReactNode }) => (
    <Box
        dir="auto"
        sx={{
            ...type("title-md"),
            color: g.text.primary,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
        }}
    >
        {children}
    </Box>
);

export const Excerpt = ({ text }: { text: string }) =>
    text ? (
        <Box
            dir="auto"
            sx={{
                ...type("body-sm"),
                color: g.text.secondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {text}
        </Box>
    ) : null;

export const Person = ({ person }: { person: CardPerson | null }) => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <AssigneeAvatar name={person?.userName} size="xs" userId={person?.userId} />
            <Box
                component="span"
                sx={{
                    ...factSx,
                    ...(person ? {} : { color: g.text.tertiary }),
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {person ? (
                    <ResolvedUserName fallbackName={person.userName} userId={person.userId} />
                ) : (
                    t.tasks.board.unassigned
                )}
            </Box>
        </Box>
    );
};

/** The due date, red only while the work can still be late. */
export const Due = ({ dueDate, done }: { dueDate: string | null; done: boolean }) => {
    const { locale, t } = useTranslation();
    if (!dueDate) return null;
    const day = parseCalendarDate(dueDate);
    if (day == null) return null;
    const label = done
        ? {
              text: fmt(t.tasks.dueLabel.dueOn, {
                  when: day.toLocaleDateString(locale, { month: "short", day: "numeric" }),
              }),
              tone: "later" as const,
          }
        : formatDueLabel(dueDate, locale);
    return <DueText text={label.text} tone={label.tone} icon />;
};

/** "Created by …", and when it changed since. */
export const CardFooter = ({
    creator,
    createdAt,
    updatedAt,
}: {
    creator: CardPerson | null;
    createdAt: string | null;
    updatedAt: string | null;
}) => {
    const { locale, t } = useTranslation();
    const updated = updatedAt ? Date.parse(updatedAt) : NaN;
    // The rows are saved more than once while being made; a minute is not an update.
    const changed = createdAt != null && updated - Date.parse(createdAt) > 60_000;
    if (!creator && !changed) return null;
    const [before, after] = t.chat.taskCard.createdBy.split("{name}");
    return (
        <Row
            sx={{
                justifyContent: "space-between",
                borderTop: "1px solid",
                borderColor: g.border.subtle,
                pt: 0.75,
                mt: 0.25,
            }}
        >
            <Box component="span" sx={metaSx}>
                {creator && (
                    <>
                        {before}
                        <ResolvedUserName
                            fallbackName={creator.userName}
                            userId={creator.userId}
                        />
                        {after}
                    </>
                )}
            </Box>
            {changed && (
                <Box component="span" sx={metaSx}>
                    {fmt(t.chat.taskCard.updated, { time: formatRelativeTime(updated, locale) })}
                </Box>
            )}
        </Row>
    );
};

/**
 * The quick status buttons of a task or milestone preview header (MIP-2603): the first action
 * of the item's current status is the button, any others sit in the ▾ menu beside it. Pressing
 * one is the same pick as choosing that status in the status picker; the host saves it.
 */
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { Box, Button, ButtonGroup, Dropdown, IconButton, MenuButton } from "@mui/joy";

import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { touchTargetSx } from "../../../../components/ui/touchTargets";
import { useAuth } from "../../../../context/authState";
import { useProjectStatusActions } from "../../../../hooks/tasks/useProjectStatusActions";
import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../../i18n";
import { useIsProjectArchived } from "../../../archive/archiveState";
import { actionTitle, QuickAction, quickActionsFor } from "../../utils/quickActions";
import { quickActionLook } from "./quickActionIcon";

type Props = {
    kind: "task" | "milestone";
    projectId: number | null | undefined;
    status: string | null | undefined;
    customStatusId?: number | null;
    /** The host dialog's layer, when the preview is itself in one. */
    hostZIndex?: number;
    /** `statusId` is undefined in a project without status rows. */
    onPick: (category: string, statusId?: number) => void;
};

const labelSx = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: { xs: 180, sm: 220 },
} as const;

export const QuickStatusButtons = ({
    kind,
    projectId,
    status,
    customStatusId,
    hostZIndex,
    onPick,
}: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const statuses = useProjectStatuses(projectId, customStatusId);
    const entry = useProjectStatusActions(projectId, accessToken);
    const archived = useIsProjectArchived(projectId);

    // Not until both lists are in: a button that changes under the pointer is worse than one
    // that arrives a moment later.
    if (archived || !entry.canAct || !statuses.loaded || statuses.failed) return null;

    const offered = quickActionsFor(entry.actions, statuses.statuses, status, customStatusId);
    const [first, ...rest] = offered;
    if (!first) return null;

    const title = (quick: QuickAction) => actionTitle(quick.action, kind, t.tasks.preview);
    const pick = (quick: QuickAction) => onPick(quick.category, quick.statusId);
    const { Icon, color } = quickActionLook(first);

    const button = (
        <Button
            color={color}
            data-testid="quick-status-button"
            size="sm"
            startDecorator={<Icon sx={{ fontSize: 16 }} />}
            sx={{ minWidth: 0, ...touchTargetSx("&") }}
            title={title(first)}
            variant="soft"
            onClick={() => pick(first)}
        >
            <Box component="span" sx={labelSx}>
                {title(first)}
            </Box>
        </Button>
    );

    if (!rest.length) return button;

    return (
        <ButtonGroup
            color={color}
            size="sm"
            sx={{ minWidth: 0, "--ButtonGroup-separatorSize": "1px" }}
            variant="soft"
        >
            {button}
            <Dropdown>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            "aria-label": t.tasks.preview.moreStatusActions,
                            color,
                            variant: "soft",
                            sx: { ...touchTargetSx("&") },
                        },
                    }}
                >
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
                </MenuButton>
                <MenuSurface
                    placement="bottom-start"
                    sx={{ minWidth: 180, maxWidth: "calc(100vw - 32px)" }}
                    zIndex={hostZIndex != null ? hostZIndex + 1 : undefined}
                >
                    {rest.map((quick) => {
                        const { Icon: RowIcon } = quickActionLook(quick);
                        return (
                            <MenuRow
                                key={`${quick.action.actionId}-${quick.category}-${quick.statusId}`}
                                icon={<RowIcon />}
                                onClick={() => pick(quick)}
                            >
                                {title(quick)}
                            </MenuRow>
                        );
                    })}
                </MenuSurface>
            </Dropdown>
        </ButtonGroup>
    );
};

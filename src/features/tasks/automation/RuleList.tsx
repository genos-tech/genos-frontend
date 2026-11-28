/** The project's rules in the order they are tried, each as its sentence. */
import { KeyboardEvent, useId } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import AutoModeRoundedIcon from "@mui/icons-material/AutoModeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, Chip, Switch } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { Spinner } from "../../../components/ui/feedback/Skeleton";
import { MoreMenu, MoreMenuItem } from "../../../components/ui/MoreMenu";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import { rowSx } from "../components/statuses/listStyles";
import { MAX_RULES } from "./draft";
import { forMilestones, isHidden, unnamedDestination } from "./helpers";
import { useLookups } from "./lookups";
import { RuleSummary } from "./RuleSentence";
import type { AutomationRule } from "./types";
import { useLater } from "./useLater";
import { reasonText, useAutomationWords } from "./words";

const PlanNote = ({ kept, onLeave }: { kept: boolean; onLeave: () => void }) => {
    const words = useAutomationWords();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const plans = t.settings.schedules;
    return (
        <Box
            data-testid="automation-plan"
            sx={{
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                borderRadius: g.radius.lg,
                border: `1px solid ${g.accent.border}`,
                background: g.accent.subtle,
            }}
        >
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                <Box component="h3" sx={{ ...type("title-sm"), m: 0 }}>
                    {words.planTitle}
                </Box>
                <Chip color="primary" size="sm" variant="soft">
                    {plans.upgradeChip}
                </Chip>
            </Box>
            <Box sx={{ ...type("body-sm"), color: g.text.secondary }}>
                {words.planBody}
                {kept && ` ${words.planKept}`}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                <Button
                    size="sm"
                    sx={{ "@media (pointer: coarse)": { minHeight: 44 } }}
                    onClick={() => {
                        // The dialog would otherwise stay open on top of the plans page.
                        onLeave();
                        navigate("/workspace/plans");
                    }}
                >
                    {plans.upgradeCta}
                </Button>
                <Box sx={{ ...type("body-xs"), color: g.text.secondary, flex: "1 1 12rem" }}>
                    {plans.upgradeHint}
                </Box>
            </Box>
        </Box>
    );
};

type Props = {
    rules: AutomationRule[];
    planAllows: boolean;
    busyId: number | null;
    onNew: () => void;
    onEdit: (rule: AutomationRule) => void;
    onPreview: (rule: AutomationRule) => void;
    onRuns: (rule: AutomationRule) => void;
    onMove: (rule: AutomationRule, step: -1 | 1) => void;
    onDelete: (rule: AutomationRule) => void;
    onSwitch: (rule: AutomationRule, on: boolean) => void;
    onLeave: () => void;
};

export const RuleList = (props: Props) => {
    const { rules, planAllows, busyId, onNew, onLeave } = props;
    const words = useAutomationWords();
    const lookups = useLookups();
    const ids = useId();
    const later = useLater();
    const full = rules.length >= MAX_RULES;

    const newButton = (
        <Button
            color="neutral"
            data-slot="new-rule"
            disabled={full}
            size="sm"
            startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ flexShrink: 0, "@media (pointer: coarse)": { minHeight: 44 } }}
            variant="plain"
            onClick={onNew}
        >
            {words.newRule}
        </Button>
    );

    const menuFor = (rule: AutomationRule, index: number): MoreMenuItem[] => {
        const hidden = isHidden(rule);
        const unnamed = unnamedDestination(rule);
        const milestone = forMilestones(rule);
        return [
            {
                id: "edit",
                label: words.edit,
                icon: <EditOutlinedIcon />,
                visible: !milestone && planAllows,
                disabled: hidden,
                hint: hidden ? words.hiddenHint : undefined,
                // After the menu has handed focus back to its trigger.
                onClick: () => later(() => props.onEdit(rule), 0),
            },
            {
                id: "preview",
                label: words.preview,
                icon: <VisibilityOutlinedIcon />,
                // Without a destination there is nothing true to preview: it is edited first.
                visible: !milestone && planAllows && !(unnamed && !hidden),
                disabled: hidden,
                hint: hidden ? words.hiddenHint : undefined,
                onClick: () => later(() => props.onPreview(rule), 0),
            },
            {
                id: "runs",
                label: words.recentRuns,
                icon: <HistoryRoundedIcon />,
                onClick: () => later(() => props.onRuns(rule), 0),
            },
            {
                id: "up",
                label: words.moveUp,
                icon: <ArrowUpwardRoundedIcon />,
                visible: index > 0,
                onClick: () => props.onMove(rule, -1),
            },
            {
                id: "down",
                label: words.moveDown,
                icon: <ArrowDownwardRoundedIcon />,
                visible: index < rules.length - 1,
                onClick: () => props.onMove(rule, 1),
            },
            {
                id: "delete",
                label: words.delete,
                icon: <DeleteOutlineRoundedIcon />,
                danger: true,
                onClick: () => props.onDelete(rule),
            },
        ];
    };

    const row = (rule: AutomationRule, index: number) => {
        const nameId = `${ids}-${rule.ruleId}`;
        const hidden = isHidden(rule);
        const milestone = forMilestones(rule);
        const editable = planAllows && !hidden && !milestone;
        // Turning on needs the plan and a rule the reader may save; turning off never does.
        const locked = !rule.enabled && (!planAllows || hidden || milestone);
        const lockedWhy = !planAllows
            ? words.planSwitchHint
            : milestone
              ? words.milestoneRule
              : words.hiddenHint;
        return (
            <Box
                key={rule.ruleId}
                component="li"
                data-rule-id={rule.ruleId}
                sx={{ ...rowSx, alignItems: "flex-start", py: 1, gap: 1 }}
                onKeyDown={(e: KeyboardEvent<HTMLLIElement>) => {
                    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                    e.preventDefault();
                    props.onMove(rule, e.key === "ArrowUp" ? -1 : 1);
                }}
            >
                <Box
                    aria-hidden="true"
                    sx={{
                        ...type("body-xs"),
                        color: g.text.tertiary,
                        fontVariantNumeric: "tabular-nums",
                        minWidth: 16,
                        textAlign: "end",
                        lineHeight: "24px",
                    }}
                >
                    {index + 1}
                </Box>
                <Box
                    title={locked ? lockedWhy : undefined}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 24,
                        "@media (pointer: coarse)": {
                            minWidth: 44,
                            minHeight: 44,
                            mt: "-10px",
                        },
                    }}
                >
                    <Switch
                        checked={rule.enabled}
                        disabled={locked || busyId === rule.ruleId}
                        size="sm"
                        slotProps={{
                            input: {
                                role: "switch",
                                "aria-labelledby": nameId,
                                "aria-describedby": locked ? `${nameId}-why` : undefined,
                                "data-slot": `switch-${rule.ruleId}`,
                            },
                        }}
                        onChange={(e) => props.onSwitch(rule, e.target.checked)}
                    />
                    {locked && (
                        <Box component="span" id={`${nameId}-why`} hidden>
                            {lockedWhy}
                        </Box>
                    )}
                </Box>
                <Box
                    component={editable ? "button" : "div"}
                    data-slot={`rule-${rule.ruleId}`}
                    type={editable ? "button" : undefined}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        display: "block",
                        background: "none",
                        border: 0,
                        borderRadius: g.radius.sm,
                        p: 0.5,
                        mt: "-4px",
                        font: "inherit",
                        color: "inherit",
                        textAlign: "start",
                        ...(editable && {
                            cursor: "pointer",
                            "&:hover": { background: g.hover },
                            "&:focus:not(:focus-visible)": { outline: "none" },
                            "&:focus-visible": focusRing,
                        }),
                    }}
                    onClick={editable ? () => props.onEdit(rule) : undefined}
                >
                    <Box
                        component="span"
                        id={nameId}
                        sx={{
                            ...type("title-sm"),
                            display: "block",
                            color: rule.enabled ? g.text.primary : g.text.secondary,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {rule.name}
                    </Box>
                    <RuleSummary rule={rule} />
                    {!rule.enabled && rule.disabledReason && (
                        <Box
                            component="span"
                            data-testid="rule-turned-off"
                            sx={{
                                ...type("body-xs"),
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 0.5,
                                mt: 0.5,
                                color: g.warning.text,
                            }}
                        >
                            <WarningAmberRoundedIcon sx={{ fontSize: 14, color: "inherit" }} />
                            {fmt(words.turnedOff, {
                                reason: reasonText(words, rule.disabledReason),
                            })}
                        </Box>
                    )}
                </Box>
                <Box
                    data-rule-menu={rule.ruleId}
                    sx={{
                        flexShrink: 0,
                        mt: "-4px",
                        "@media (pointer: coarse)": { "& button": { width: 44, height: 44 } },
                    }}
                >
                    {busyId === rule.ruleId ? (
                        <Box sx={{ width: 32, height: 32, display: "grid", placeItems: "center" }}>
                            <Spinner />
                        </Box>
                    ) : (
                        <MoreMenu
                            ariaLabel={fmt(words.moreActions, { name: rule.name })}
                            items={menuFor(rule, index)}
                            placement="bottom-end"
                            triggerSize={32}
                            zIndex={lookups.popupZ}
                        />
                    )}
                </Box>
            </Box>
        );
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            {!planAllows && <PlanNote kept={rules.length > 0} onLeave={onLeave} />}
            {rules.length === 0 ? (
                planAllows && (
                    <EmptyState
                        action={{ label: words.newRule, onClick: onNew }}
                        body={words.emptyBody}
                        icon={<AutoModeRoundedIcon />}
                        size="sm"
                        title={words.emptyTitle}
                    />
                )
            ) : (
                <>
                    {(planAllows || full) && (
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 1,
                                mb: -0.5,
                            }}
                        >
                            {/* The count speaks up only near the limit. */}
                            {rules.length >= MAX_RULES - 5 && (
                                <Box
                                    sx={{
                                        ...type("body-xs"),
                                        color: full ? g.warning.text : g.text.tertiary,
                                        flex: "1 1 12rem",
                                    }}
                                >
                                    {fmt(full ? words.limitHint : words.count, {
                                        n: rules.length,
                                        max: MAX_RULES,
                                    })}
                                </Box>
                            )}
                            {planAllows && newButton}
                        </Box>
                    )}
                    <Box
                        component="ul"
                        sx={{
                            listStyle: "none",
                            m: 0,
                            p: 0,
                            border: `1px solid ${g.border.subtle}`,
                            borderRadius: g.radius.md,
                        }}
                    >
                        {rules.map(row)}
                    </Box>
                </>
            )}
        </Box>
    );
};

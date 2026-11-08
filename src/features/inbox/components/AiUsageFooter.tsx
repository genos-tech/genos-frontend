// The foot of an AI-made Inbox card: what the item cost, and "Turn this off" (MIP-1227; the card
// half of genos-api MIP-1209). Ken: "Must not spend a user's AI usage silently."
//
// Drawn only for a digest or a report that carries a valid `itemOptionals.ai` (see
// `readAiUsage`, which refuses a forged blob on any other item type); everything else draws
// nothing, not even a "0 credits" line. The cost is in AI credits, formatted by the same
// `formatCredits` as Plan & usage. The digest is not billed, so its line says what it used and
// that none was deducted; a charge is never claimed that did not happen.
//
// The switch acts on the item's SOURCE (the digest, or that schedule), which the server reads
// from the item itself. Turning off says what was turned off and offers Undo only when the
// source was on before (Undo calls "on", which would otherwise switch on something that was
// already off). What the member has switched lives in `inboxAiStore`, keyed by source, so every
// card of the same source agrees and a row Virtuoso recycles keeps its Undo.
//
// Cost on a long Inbox: no request until a button is pressed, one `useSyncExternalStore` per
// footer, and the component is memoized on the item's own objects.

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { Box, Button, Link, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import type { Messages } from "../../../i18n/types";
import { g, type } from "../../../theme/tokens";
import type { InboxItemProps } from "../../../types/common";
import { formatCredits } from "../../../utils/formatCredits";
import {
    getSourceState,
    getSwitchNotice,
    setSourceState,
    setSwitchNotice,
    subscribeInboxAi,
} from "../inboxAiStore";
import { switchInboxAi } from "../services/inboxAi";
import { patchInboxAiSource } from "../services/patchInboxAiSource";
import { readAiUsage, type AiCost, type AiSourceView } from "../utils/inboxAi";

type Copy = Messages["inbox"]["aiUsage"];

/** Hundredths of a credit, so a figure reads exactly as it would in Settings ("1.83", "2"). */
const credits = (milli: number): string => formatCredits(Math.round(milli / 10) / 100);

/** The cost line: what it used, and (when it is known) what was taken from the balance. */
export const costText = (cost: AiCost, c: Copy): string => {
    if (!cost.metered) return c.unmeasured;
    // Under a hundredth of a credit a figure would print as "0", which is not true of a cost.
    // With unpriced calls the true cost may be more, so "less than 0.01" would be wrong too.
    if (cost.creditsMilli < 5 && cost.lowerBound) return c.unmeasured;
    const used =
        cost.creditsMilli < 5
            ? c.usedTiny
            : fmt(cost.lowerBound ? c.usedAtLeast : c.used, {
                  credits: credits(cost.creditsMilli),
              });
    const deducted =
        cost.deductedMilli === 0
            ? c.deductedNone
            : fmt(c.deducted, {
                  credits: formatCredits(Math.max(Math.round(cost.deductedMilli / 10), 1) / 100),
              });
    return `${used} · ${deducted}`;
};

type Props = Pick<InboxItemProps, "itemId" | "itemType" | "itemOptionals" | "aiSource"> & {
    /** The member, so a key is never shared between two people using one browser session. */
    userId: string;
};

export const AiUsageFooter = memo(
    ({ itemId, itemType, itemOptionals, aiSource, userId }: Props) => {
        const usage = useMemo(
            () => readAiUsage({ itemType, itemOptionals, aiSource }),
            [itemType, itemOptionals, aiSource]
        );
        if (usage === null) return null;
        return <Footer itemId={itemId} usage={usage} userId={userId} />;
    }
);
AiUsageFooter.displayName = "AiUsageFooter";

const Footer = ({
    itemId,
    usage,
    userId,
}: {
    itemId: number;
    usage: NonNullable<ReturnType<typeof readAiUsage>>;
    userId: string;
}) => {
    const { t } = useTranslation();
    const c = t.inbox.aiUsage;
    return (
        <Box
            data-ai-usage=""
            // The row around a card opens the item on click: the switch is not part of that.
            // An event boundary in the shape the clickable-element guard (MIP-1129) accepts: the
            // whole handler is `stopPropagation()`, written inline (a named `stop` is not seen as
            // one). The footer is not itself a control; the buttons inside it are.
            sx={{
                borderTop: "1px solid",
                borderColor: g.border.subtle,
                pt: 1,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                columnGap: 1.5,
                rowGap: 0.5,
                minWidth: 0,
            }}
            onClick={(event) => event.stopPropagation()}
        >
            <Typography
                data-ai-usage-cost=""
                level="body-xs"
                startDecorator={<BoltRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{
                    ...type("body-xs"),
                    color: g.text.secondary,
                    flex: "1 1 14rem",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                }}
            >
                {costText(usage.cost, c)}
            </Typography>
            {usage.source && <Switch itemId={itemId} source={usage.source} userId={userId} />}
        </Box>
    );
};

// One read of the shared store: every read returns the stored object itself, so a snapshot
// changes (and the footer re-renders) only when its own entry was replaced.
const useStore = <T,>(read: () => T): T => useSyncExternalStore(subscribeInboxAi, read, read);

const Switch = ({
    itemId,
    source,
    userId,
}: {
    itemId: number;
    source: AiSourceView;
    userId: string;
}) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const c = t.inbox.aiUsage;
    const key = `${userId}|${source.key}`;
    const shared = useStore(() => getSourceState(key));
    const notice = useStore(() => getSwitchNotice(itemId));
    const [busy, setBusy] = useState(false);
    const undoRef = useRef<HTMLButtonElement>(null);
    const focusUndo = useRef(false);

    const enabled = shared ? shared.enabled : source.enabled;
    const gone = source.gone || shared?.gone === true;
    const name =
        source.kind === "digest" ? t.inbox.requestTypes.digest : source.name || c.scheduleFallback;

    // The button the member pressed is replaced by Undo: keep focus on the same spot.
    useEffect(() => {
        if (focusUndo.current && notice?.kind === "off" && notice.undoable) {
            focusUndo.current = false;
            undoRef.current?.focus();
        }
    }, [notice]);

    const run = async (on: boolean) => {
        setBusy(true);
        const res = await switchInboxAi(accessToken, itemId, on);
        setBusy(false);
        if (!res.ok) {
            if (res.reason === "gone") setSourceState(key, { enabled: false, gone: true });
            setSwitchNotice(itemId, { kind: "error", reason: res.reason, error: res.error });
            return;
        }
        setSourceState(key, { enabled: on, gone: false });
        // The stored rows learn it too, so a reload does not undo what was just said.
        void patchInboxAiSource({
            kind: source.kind,
            scheduleId:
                source.kind === "schedule" ? source.key.slice("schedule:".length) : undefined,
            enabled: on,
        }).catch(() => undefined);
        if (on) setSwitchNotice(itemId, { kind: "on" });
        else if (res.wasEnabled) {
            focusUndo.current = true;
            setSwitchNotice(itemId, { kind: "off", undoable: true });
        } else setSwitchNotice(itemId, { kind: "already-off" });
    };

    if (gone) {
        return (
            <Typography
                level="body-xs"
                role="status"
                sx={{ ...type("body-xs"), color: g.text.tertiary, flexBasis: "100%" }}
            >
                {c.gone}
            </Typography>
        );
    }

    let message: string | null = null;
    if (notice?.kind === "off") {
        message = fmt(source.kind === "digest" ? c.offDigest : c.offSchedule, { name });
    } else if (notice?.kind === "already-off") message = fmt(c.alreadyOff, { name });
    else if (notice?.kind === "on") message = fmt(c.onAgain, { name });
    else if (!enabled) message = fmt(c.restingOff, { name });

    const undoable = notice?.kind === "off" && notice.undoable && !enabled;
    const failure = notice?.kind === "error" ? notice : null;

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {enabled ? (
                    <Button
                        aria-label={fmt(c.turnOffNamed, { name })}
                        color="neutral"
                        disabled={busy}
                        loading={busy}
                        size="sm"
                        variant="outlined"
                        onClick={() => void run(false)}
                    >
                        {c.turnOff}
                    </Button>
                ) : (
                    <Button
                        ref={undoRef}
                        aria-label={fmt(undoable ? c.undoNamed : c.turnBackOnNamed, { name })}
                        color="neutral"
                        disabled={busy}
                        loading={busy}
                        size="sm"
                        variant="outlined"
                        onClick={() => void run(true)}
                    >
                        {undoable ? c.undo : c.turnBackOn}
                    </Button>
                )}
            </Box>
            {message && !failure && (
                <Typography
                    data-ai-usage-status=""
                    level="body-xs"
                    role="status"
                    sx={{
                        ...type("body-xs"),
                        color: g.text.secondary,
                        flexBasis: "100%",
                        overflowWrap: "anywhere",
                    }}
                >
                    {message}
                </Typography>
            )}
            {failure && (
                <Typography
                    level="body-xs"
                    role="alert"
                    sx={{
                        ...type("body-xs"),
                        color: g.danger.text,
                        flexBasis: "100%",
                        overflowWrap: "anywhere",
                    }}
                >
                    {failure.reason === "gone"
                        ? c.gone
                        : failure.reason === "plan"
                          ? c.planNeeded
                          : (failure.error ?? c.failed)}
                    {failure.reason === "plan" && (
                        <>
                            {" "}
                            <Link
                                component="button"
                                level="body-xs"
                                onClick={() => navigate("/workspace/plans")}
                            >
                                {t.settings.planUsage.seePlans}
                            </Link>
                        </>
                    )}
                </Typography>
            )}
        </>
    );
};

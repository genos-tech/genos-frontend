import { useEffect, useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Typography } from "@mui/joy";

import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import type { SkillRunRequest } from "./skillRunCardStore";
import { confirmSkillRun, fetchRunCard, type RunCard } from "./skillsApi";

type Props = {
    /** The skill version the person is asked about, or null while the card is closed. */
    request: SkillRunRequest | null;
    /** `true` once "Run this skill" was recorded by the server; `false` on Cancel, Escape or the
     *  backdrop. Called once per request. */
    onResolve: (confirmed: boolean) => void;
};

/**
 * The first-run card (MIP-2192): before an outside author's skill, or a copy of a skill an operator
 * took down as harmful, runs for the first time, the person reads what it says and what it may do.
 *
 * What it shows, and what it never does:
 *  - the author's public handle and nothing else about them;
 *  - the whole skill text as PLAIN TEXT in a scrollable block. It is never parsed as HTML or
 *    markdown, so it cannot load an image, draw a link or hide a line from the person who is about
 *    to trust it;
 *  - what the skill may propose, in words. Each proposal still needs the person's approval when it
 *    happens; the card says so;
 *  - for a copy of a harmful skill, a fixed sentence of ours. Nothing the operator wrote is shown.
 *
 * Built on `ConfirmDialog`, so focus is trapped, Escape and the backdrop cancel, and a half-sent
 * confirmation cannot be dismissed out of sight.
 */
export const SkillRunCardDialog = ({ request, onResolve }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const r = t.settings.genosSkills.runCard;
    const [card, setCard] = useState<RunCard | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setCard(null);
        setLoadError(null);
        setError(null);
        if (!request) return;
        let cancelled = false;
        void fetchRunCard(accessToken, request.skillId, request.teamId, request.versionNo).then(
            (res) => {
                if (cancelled) return;
                if (res.ok) setCard(res.data);
                else
                    setLoadError(
                        res.reason === "bad_input" && res.message ? res.message : r.loadFailed
                    );
            }
        );
        return () => {
            cancelled = true;
        };
        // `r.loadFailed` is a string of the active locale; the card is fetched per request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request?.skillId, request?.versionNo, request?.teamId, accessToken]);

    const run = async () => {
        if (!request || !card) return false;
        setError(null);
        const res = await confirmSkillRun(
            accessToken,
            request.skillId,
            request.teamId,
            request.versionNo
        );
        if (res.ok) {
            onResolve(true);
            return true;
        }
        setError(r.confirmFailed);
        return false;
    };

    return (
        <ConfirmDialog
            cancelLabel={t.common.actions.cancel}
            confirmDisabled={card === null}
            confirmLabel={r.run}
            description={r.intro}
            entityName={card?.title || undefined}
            error={error}
            open={request !== null}
            title={r.title}
            zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
            onClose={() => onResolve(false)}
            onConfirm={run}
        >
            {card === null && (
                <Typography
                    level="body-sm"
                    role={loadError ? "alert" : "status"}
                    sx={{ color: loadError ? g.danger.text : g.text.secondary }}
                >
                    {loadError ?? r.loading}
                </Typography>
            )}
            {card && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
                    {card.harmful && (
                        <Alert
                            color="danger"
                            size="sm"
                            startDecorator={<WarningAmberIcon />}
                            sx={{ overflowWrap: "anywhere" }}
                        >
                            {r.harmful}
                        </Alert>
                    )}
                    <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                        {card.author ? (
                            <>
                                {r.writtenBy}{" "}
                                <Box
                                    component="span"
                                    sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
                                    translate="no"
                                >
                                    @{card.author.handle}
                                </Box>
                            </>
                        ) : (
                            r.noAuthor
                        )}
                        {" · "}
                        {fmt(r.version, { n: card.versionNo })}
                    </Typography>
                    <Box>
                        <Typography
                            id="skill-run-card-text-label"
                            level="title-sm"
                            sx={{ mb: 0.5 }}
                        >
                            {r.textLabel}
                        </Typography>
                        {/* Plain text on purpose: a text child is escaped by React, and `pre-wrap`
                            keeps every line the author wrote. Focusable so the keyboard can scroll it. */}
                        <Box
                            aria-labelledby="skill-run-card-text-label"
                            component="pre"
                            dir="auto"
                            role="region"
                            tabIndex={0}
                            sx={{
                                ...type("body-sm"),
                                m: 0,
                                p: 1.25,
                                maxHeight: { xs: 220, sm: 280 },
                                overflow: "auto",
                                overscrollBehavior: "contain",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                                fontFamily: g.font.mono,
                                color: g.text.primary,
                                background: g.hover,
                                border: `1px solid ${g.border.subtle}`,
                                borderRadius: g.radius.md,
                                "&:focus-visible": {
                                    outline: `2px solid ${g.focus}`,
                                    outlineOffset: 2,
                                },
                            }}
                        >
                            {card.bodyMarkdown || r.emptyText}
                        </Box>
                    </Box>
                    <Box>
                        <Typography level="title-sm" sx={{ mb: 0.5 }}>
                            {r.mayLabel}
                        </Typography>
                        {card.mayPropose.length === 0 ? (
                            <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                {r.readOnly}
                            </Typography>
                        ) : (
                            <>
                                <Box
                                    component="ul"
                                    sx={{
                                        m: 0,
                                        ps: 2.5,
                                        ...type("body-sm"),
                                        color: g.text.primary,
                                    }}
                                >
                                    {card.mayPropose.map((tool) => (
                                        <li key={tool}>{r.propose[tool]}</li>
                                    ))}
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{ mt: 0.5, color: g.text.secondary }}
                                >
                                    {r.approveFirst}
                                </Typography>
                            </>
                        )}
                    </Box>
                </Box>
            )}
        </ConfirmDialog>
    );
};

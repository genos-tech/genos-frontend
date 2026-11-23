import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import {
    Box,
    Checkbox,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Typography,
} from "@mui/joy";

import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { toast } from "../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import {
    fetchPublishCheck,
    publishToHub,
    type PublishCheckResult,
    type SkillRow,
} from "./skillsApi";

/** The handle the server accepts: 3 to 30 lower-case letters, digits and single hyphens. */
export const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export const handleProblem = (raw: string): "short" | "long" | "shape" | null => {
    const handle = raw.trim().toLowerCase().replace(/^@/, "");
    if (handle.length < HANDLE_MIN) return "short";
    if (handle.length > HANDLE_MAX) return "long";
    return HANDLE_RE.test(handle) ? null : "shape";
};

type Props = {
    /** The skill to make public, or null while the dialog is closed. */
    skill: SkillRow | null;
    onClose: () => void;
    /** The skill as the server now has it (public, with its first public version). */
    onPublished: (skill: SkillRow) => void;
};

type CheckState =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "ready"; data: PublishCheckResult };

/**
 * "Publish to the Hub" (MIP-2047): the owner's confirmation before a skill is readable by every
 * signed-in Genos user. It shows the server's own checklist (plan, verified email, account age,
 * title / description / tag, no secrets or personal data, the automatic safety check), asks for the
 * public handle the first time, and for the owner's confirmation of the content terms. Nothing is
 * public until the confirm button is pressed, and the server checks everything again then.
 */
export const SkillPublishDialog = ({ skill, onClose, onPublished }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const p = t.settings.genosSkills.hub.publish;
    const [state, setState] = useState<CheckState>({ status: "loading" });
    const [handle, setHandle] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [terms, setTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [problems, setProblems] = useState<string[]>([]);

    const skillId = skill?.id ?? null;
    useEffect(() => {
        if (!skillId) {
            setState({ status: "loading" });
            setTerms(false);
            setError(null);
            setProblems([]);
            return;
        }
        let live = true;
        // The checklist is a fetch whose answer sets the state; the first render has nothing to draw.
        void fetchPublishCheck(accessToken, skillId).then((res) => {
            if (!live) return;
            setState(res.ok ? { status: "ready", data: res.data } : { status: "failed" });
        });
        return () => {
            live = false;
        };
    }, [accessToken, skillId]);

    const ready = state.status === "ready" ? state.data : null;
    const needsHandle = ready !== null && ready.profile.handle === null;
    const handleIssue = needsHandle ? handleProblem(handle) : null;
    // The handle row of the checklist turns green by typing a handle here: every OTHER row must
    // already be green (an account row is not something this dialog can fix).
    // The automatic safety check is not a blocker: a flagged text is held for an operator.
    const othersOk =
        ready?.checks.every((c) => c.ok || c.key === "handle" || c.key === "automatic-check") ??
        false;
    const canConfirm = othersOk && terms && (!needsHandle || handleIssue === null);

    const confirm = async () => {
        if (!skill || !ready) return false;
        setError(null);
        setProblems([]);
        const res = await publishToHub(accessToken, skill.id, {
            acceptTerms: true,
            ...(needsHandle ? { handle: handle.trim().toLowerCase().replace(/^@/, "") } : {}),
            ...(needsHandle && displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
        if (res.ok) {
            toast.success(p.done);
            onPublished(res.data);
            return true;
        }
        setError(res.message || p.failed);
        setProblems(res.problems ?? []);
        return false;
    };

    return (
        <ConfirmDialog
            cancelLabel={t.common.actions.cancel}
            confirmDisabled={!canConfirm}
            confirmLabel={p.confirm}
            description={p.body}
            entityName={skill?.title}
            error={error}
            open={skill !== null}
            title={p.title}
            zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
            onClose={onClose}
            onConfirm={confirm}
        >
            {state.status === "loading" && <SkeletonRows count={3} label={p.checking} />}
            {state.status === "failed" && (
                <Typography color="danger" level="body-sm" role="alert" sx={{ mt: 1.5 }}>
                    {p.checkFailed}
                </Typography>
            )}
            {ready && (
                <>
                    <Box
                        aria-label={p.checklist}
                        component="ul"
                        role="list"
                        sx={{ listStyle: "none", m: 0, mt: 1.5, p: 0, display: "grid", gap: 0.75 }}
                    >
                        {ready.checks.map((check) => {
                            const ok =
                                check.ok || (check.key === "handle" && handleIssue === null);
                            return (
                                <Box
                                    key={check.key}
                                    component="li"
                                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                                >
                                    {ok ? (
                                        <CheckCircleRoundedIcon
                                            color="success"
                                            fontSize="small"
                                            titleAccess={p.passed}
                                        />
                                    ) : (
                                        <RadioButtonUncheckedRoundedIcon
                                            color="warning"
                                            fontSize="small"
                                            titleAccess={p.notYet}
                                        />
                                    )}
                                    <Typography
                                        level="body-sm"
                                        sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                                    >
                                        {check.text}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                    {needsHandle && (
                        <>
                            <FormControl
                                error={handle !== "" && handleIssue !== null}
                                sx={{ mt: 2 }}
                            >
                                <FormLabel>{p.handleLabel}</FormLabel>
                                <Input
                                    autoComplete="off"
                                    size="sm"
                                    slotProps={{ input: { maxLength: HANDLE_MAX + 1 } }}
                                    startDecorator="@"
                                    value={handle}
                                    onChange={(event) => setHandle(event.target.value)}
                                />
                                <FormHelperText>
                                    {handle !== "" && handleIssue
                                        ? p.handleProblem[handleIssue]
                                        : p.handleHelp}
                                </FormHelperText>
                            </FormControl>
                            <FormControl sx={{ mt: 1.5 }}>
                                <FormLabel>{p.displayNameLabel}</FormLabel>
                                <Input
                                    autoComplete="off"
                                    size="sm"
                                    slotProps={{ input: { maxLength: 60 } }}
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                />
                            </FormControl>
                        </>
                    )}
                    <Checkbox
                        checked={terms}
                        label={p.terms}
                        size="sm"
                        sx={{ mt: 2, alignItems: "flex-start" }}
                        onChange={(event) => setTerms(event.target.checked)}
                    />
                    {problems.length > 0 && (
                        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                            {problems.map((problem) => (
                                <Typography key={problem} component="li" level="body-xs">
                                    {problem}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </>
            )}
        </ConfirmDialog>
    );
};

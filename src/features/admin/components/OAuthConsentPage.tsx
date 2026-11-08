import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Radio,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";

import { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import {
    ConsentContext,
    ConsentError,
    getConsentContext,
    submitConsentDecision,
} from "../../../services/mcpConnections";
import { rememberReturn, takeReturn } from "../../../utils/pendingReturn";
import {
    actionForFailure,
    chooseDefaultTeam,
    clientAddress,
    initialChoice,
    initialTeamIds,
    isSafeRedirect,
    normalizeChoice,
    paramsFromSearch,
    pickDefault,
    scopesFor,
    toggleTeam,
} from "../consent/consentLogic";

type Phase =
    | { kind: "loading" }
    | { kind: "invalid" }
    | { kind: "failed"; failure: ConsentError }
    | { kind: "ready"; context: ConsentContext }
    | { kind: "leaving"; host: string };

/**
 * `/oauth/consent?<authorization query>`: where an AI app (Claude, ChatGPT…)
 * sends the member's browser to ask for access. The page shows who is asking,
 * what for, and which teams it may use, and sends the decision to the API,
 * which validates the whole request again and answers where to send the
 * browser next (back to the app, which gets the code or the refusal).
 *
 * Nothing here is trusted by the server, and nothing is navigated to unless
 * the API said so and the address is https (or loopback http): a refusal
 * whose address the API doesn't vouch for is shown on this page and stays.
 */
export const OAuthConsentPage = () => {
    const { t } = useTranslation();
    const c = t.admin.consent;
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const { search } = useLocation();
    const { mode } = useColorScheme();
    const styles = mode === "dark" ? SignInFormStyles.dark : SignInFormStyles.light;

    const params = useMemo(() => paramsFromSearch(search), [search]);
    const signedIn = localStorage.getItem("isSigningIn") === "yes";

    const [phase, setPhase] = useState<Phase>({ kind: "loading" });
    const [write, setWrite] = useState(false);
    const [destructive, setDestructive] = useState(false);
    const [teamIds, setTeamIds] = useState<string[]>([]);
    const [defaultTeamId, setDefaultTeamId] = useState("");
    const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [planBlocked, setPlanBlocked] = useState(false);

    // Signed out: sign in first, then come back here with the query intact.
    useEffect(() => {
        if (signedIn) return;
        rememberReturn(`/oauth/consent${search}`);
        navigate("/signin", { replace: true });
    }, [signedIn, search, navigate]);

    useEffect(() => {
        if (!signedIn || !accessToken) return;
        if (!params) {
            setPhase({ kind: "invalid" });
            return;
        }
        let cancelled = false;
        void getConsentContext(accessToken, params).then((res) => {
            if (cancelled) return;
            if (res.ok) {
                const { context } = res;
                const requested = context.scopes.map((s) => s.name);
                const choice = initialChoice(requested, context.existing);
                const team = chooseDefaultTeam(
                    context.teams,
                    localStorage.getItem("teamId"),
                    context.existing
                );
                setWrite(choice.write);
                setDestructive(choice.destructive);
                setDefaultTeamId(team);
                setTeamIds(initialTeamIds(context.teams, team, context.existing));
                setPhase({ kind: "ready", context });
                return;
            }
            // The session ran out while the page was open: sign in, come back.
            if (res.failure.status === 401) {
                rememberReturn(`/oauth/consent${search}`);
                navigate("/signin", { replace: true });
                return;
            }
            leaveOrShow(res.failure);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signedIn, accessToken, params]);

    const leave = (url: string) => {
        takeReturn();
        let host = "";
        try {
            host = new URL(url).hostname;
        } catch {
            // isSafeRedirect already parsed it.
        }
        setPhase({ kind: "leaving", host });
        // A full navigation, not the router: the client's callback is another site (or an app).
        window.location.assign(url);
    };

    // A refusal the API vouches for goes back to the app (it learns the outcome);
    // any other stays here and is shown.
    const leaveOrShow = (failure: ConsentError) => {
        const action = actionForFailure(failure);
        if (action.kind === "navigate") leave(action.url);
        else setPhase({ kind: "failed", failure });
    };

    if (!signedIn) return null;

    const choice = normalizeChoice({ write, destructive });
    const ready = phase.kind === "ready" ? phase.context : null;
    const requested = ready?.scopes.map((s) => s.name) ?? [];
    const canWrite = requested.includes("mcp:write");
    const canDelete = canWrite && requested.includes("mcp:destructive");

    const decide = async (allow: boolean) => {
        if (!params || !ready) return;
        setBusy(allow ? "allow" : "deny");
        setProblem(null);
        const res = await submitConsentDecision(
            accessToken,
            params,
            allow
                ? {
                      allow: true,
                      scopes: scopesFor(choice, requested),
                      teamIds,
                      defaultTeamId,
                  }
                : { allow: false }
        );
        setBusy(null);
        if (res.ok) {
            if (isSafeRedirect(res.redirectTo)) leave(res.redirectTo);
            else setProblem(c.errors.generic);
            return;
        }
        const { failure } = res;
        if (failure.status === 403 && failure.error === "plan_required") {
            setPlanBlocked(true);
            return;
        }
        if (failure.status === 401) {
            rememberReturn(`/oauth/consent${search}`);
            navigate("/signin", { replace: true });
            return;
        }
        if (failure.error === "invalid_teams") setProblem(c.errors.invalidTeams);
        else if (failure.redirectTo) leaveOrShow(failure);
        else setProblem(failure.description || c.errors.generic);
    };

    const name = ready?.client.name?.trim() ?? "";
    const showPlan = ready && (!ready.planAllowed || planBlocked);
    const noTeams = ready && ready.teams.length === 0;
    const host = ready?.client.redirectHost ?? "";

    return (
        <Box
            component="main"
            sx={{
                my: "auto",
                py: 2,
                pb: 5,
                display: "flex",
                flexDirection: "column",
                width: { xs: "100%", md: 460 },
                maxWidth: "100%",
                mx: "auto",
            }}
        >
            <Box
                sx={{
                    background: styles.cardBg,
                    border: `1px solid ${styles.cardBorder}`,
                    borderRadius: "20px",
                    boxShadow: styles.cardShadow,
                    p: { xs: 2.5, md: 4 },
                    backdropFilter: "blur(12px)",
                    minWidth: 0,
                }}
            >
                {(phase.kind === "loading" || phase.kind === "leaving") && (
                    <Stack alignItems="center" role="status" sx={{ gap: 2, py: 2 }}>
                        <CircularProgress size="md" />
                        <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                            {phase.kind === "leaving"
                                ? phase.host
                                    ? fmt(c.leaving, { host: phase.host })
                                    : c.leavingNoHost
                                : c.loading}
                        </Typography>
                    </Stack>
                )}

                {phase.kind === "invalid" && (
                    <Stack sx={{ gap: 2 }}>
                        <Title styles={styles}>{c.invalidTitle}</Title>
                        <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                            {c.invalidBody}
                        </Typography>
                    </Stack>
                )}

                {phase.kind === "failed" && (
                    <Stack sx={{ gap: 2 }}>
                        <Title styles={styles}>{c.failedTitle}</Title>
                        <Alert color="danger" role="alert" sx={{ borderRadius: "12px" }}>
                            {phase.failure.description || c.errors.generic}
                        </Alert>
                        <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                            {c.failedBody}
                        </Typography>
                    </Stack>
                )}

                {ready && (
                    <Stack sx={{ gap: 2.5 }}>
                        <Stack sx={{ gap: 0.75 }}>
                            <Title styles={styles}>
                                {name ? fmt(c.title, { name }) : c.titleUnnamed}
                            </Title>
                            <Typography
                                level="body-sm"
                                sx={{ color: styles.subtitleColor, overflowWrap: "anywhere" }}
                            >
                                {clientAddress(ready.client)
                                    ? fmt(c.identifiedBy, { url: clientAddress(ready.client) })
                                    : c.registeredNote}
                            </Typography>
                            {host && (
                                <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                    {fmt(c.sendBack, { host })}
                                </Typography>
                            )}
                        </Stack>

                        {ready.client.kind === "registered" && (
                            <Alert color="warning" sx={{ borderRadius: "12px" }} variant="soft">
                                {c.anyoneCanRegister}
                            </Alert>
                        )}

                        {ready.existing?.active && (
                            <Alert color="neutral" sx={{ borderRadius: "12px" }} variant="soft">
                                {c.alreadyConnected}
                            </Alert>
                        )}

                        {showPlan && (
                            <Alert
                                color="warning"
                                role="alert"
                                sx={{
                                    borderRadius: "12px",
                                    alignItems: "flex-start",
                                    flexDirection: "column",
                                    gap: 0.5,
                                }}
                            >
                                <Typography level="title-sm">{c.planTitle}</Typography>
                                <Typography level="body-sm">{c.planBody}</Typography>
                            </Alert>
                        )}

                        {noTeams && (
                            <Alert color="warning" sx={{ borderRadius: "12px" }} variant="soft">
                                {c.noTeams}
                            </Alert>
                        )}

                        <Stack component="fieldset" sx={{ gap: 1, border: 0, p: 0, m: 0 }}>
                            <Typography component="legend" level="title-sm" sx={{ mb: 0.5 }}>
                                {c.accessTitle}
                            </Typography>
                            <Checkbox label={c.readLabel} checked disabled />
                            {canWrite && (
                                <Checkbox
                                    checked={write}
                                    disabled={busy !== null}
                                    label={c.writeLabel}
                                    onChange={(e) => {
                                        setWrite(e.target.checked);
                                        if (!e.target.checked) setDestructive(false);
                                    }}
                                />
                            )}
                            {canDelete && (
                                <Checkbox
                                    checked={choice.destructive}
                                    color="danger"
                                    disabled={!write || busy !== null}
                                    label={c.deleteLabel}
                                    sx={{ ml: 3 }}
                                    onChange={(e) => setDestructive(e.target.checked)}
                                />
                            )}
                        </Stack>

                        {ready.teams.length > 0 && (
                            <Stack component="fieldset" sx={{ gap: 1, border: 0, p: 0, m: 0 }}>
                                <Typography component="legend" level="title-sm">
                                    {c.teamsTitle}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: styles.subtitleColor }}>
                                    {c.teamsHint}
                                </Typography>
                                {ready.teams.map((team) => {
                                    const ticked = teamIds.includes(team.id);
                                    return (
                                        <Stack
                                            key={team.id}
                                            direction="row"
                                            sx={{ gap: 1, alignItems: "center", minWidth: 0 }}
                                        >
                                            <Checkbox
                                                checked={ticked}
                                                disabled={busy !== null}
                                                label={team.name}
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    wordBreak: "break-word",
                                                }}
                                                onChange={() => {
                                                    const next = toggleTeam(
                                                        teamIds,
                                                        defaultTeamId,
                                                        team.id
                                                    );
                                                    setTeamIds(next.teamIds);
                                                    setDefaultTeamId(next.defaultTeamId);
                                                }}
                                            />
                                            <Radio
                                                checked={defaultTeamId === team.id}
                                                disabled={busy !== null}
                                                label={c.defaultTeam}
                                                name="default-team"
                                                size="sm"
                                                slotProps={{
                                                    input: {
                                                        "aria-label": fmt(c.defaultTeamFor, {
                                                            team: team.name,
                                                        }),
                                                    },
                                                }}
                                                onChange={() => {
                                                    const next = pickDefault(teamIds, team.id);
                                                    setTeamIds(next.teamIds);
                                                    setDefaultTeamId(next.defaultTeamId);
                                                }}
                                            />
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        )}

                        {problem && (
                            <Alert color="danger" role="alert" sx={{ borderRadius: "12px" }}>
                                {problem}
                            </Alert>
                        )}

                        <Stack direction={{ xs: "column-reverse", sm: "row" }} sx={{ gap: 1.5 }}>
                            <Button
                                color="neutral"
                                disabled={busy !== null}
                                loading={busy === "deny"}
                                size="lg"
                                variant="outlined"
                                fullWidth
                                onClick={() => void decide(false)}
                            >
                                {c.deny}
                            </Button>
                            <Button
                                loading={busy === "allow"}
                                size="lg"
                                disabled={
                                    busy !== null ||
                                    !!showPlan ||
                                    !!noTeams ||
                                    teamIds.length === 0
                                }
                                fullWidth
                                onClick={() => void decide(true)}
                            >
                                {c.allow}
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

const Title = ({
    children,
    styles,
}: {
    children: React.ReactNode;
    styles: typeof SignInFormStyles.light;
}) => (
    <Typography
        component="h1"
        level="h3"
        sx={{
            background: styles.titleGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
        }}
    >
        {children}
    </Typography>
);

import { useEffect, useState } from "react";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { Alert, Box, Button, CircularProgress, Link, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SignUpFormStyles } from "../../../components/ui/styles/commonStyle";
import { AUTH_LOCAL_STORAGE_KEYS, useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import { previewInvite } from "../services/teamInvite";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Phase = "loading" | "invalid" | "mismatch";

/**
 * Public landing page for an invite link (`/accept-invite?token=...`).
 * Sits OUTSIDE both auth guards — the visitor may be logged in or not.
 * It only *previews* the token (a public call) and then routes; it never
 * needs an access token, so AuthProvider deliberately skips its refresh /
 * force-sign-out cycle for this path (see AuthContext). The actual accept
 * is performed by the JoinTeam consume funnel (existing accounts) or the
 * signup endpoint (new accounts) — both places where a token is available.
 *
 * Branch order is login-state FIRST, then preview status, so we never
 * blind-redirect a logged-in visitor into GuestGuard. The token is stashed
 * in localStorage so it survives the signup/signin round-trip.
 */
export const AcceptInviteHandler = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { setAccessToken } = useAuth();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [phase, setPhase] = useState<Phase>(token ? "loading" : "invalid");
    const [invitedEmail, setInvitedEmail] = useState("");
    const [currentEmail, setCurrentEmail] = useState("");

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignUpFormStyles.dark : SignUpFormStyles.light;

    useEffect(() => {
        if (!token) {
            setPhase("invalid");
            return;
        }
        let cancelled = false;
        (async () => {
            const preview = await previewInvite(token);
            if (cancelled) return;

            if (!preview.valid) {
                // invalid OR expired — clear any stale stash and stop.
                localStorage.removeItem("pendingInviteToken");
                localStorage.removeItem("pendingInviteEmail");
                setPhase("invalid");
                return;
            }
            setInvitedEmail(preview.invited_email);

            // Stash so the token survives the auth round-trip. The consume
            // points (JoinTeam effect / signup) clear it on a terminal
            // outcome.
            localStorage.setItem("pendingInviteToken", token);
            localStorage.setItem("pendingInviteEmail", preview.invited_email);

            const isLoggedIn = localStorage.getItem("isSigningIn") === "yes";
            if (!isLoggedIn) {
                if (preview.status === "no_account") {
                    navigate(`/signup?invite_email=${encodeURIComponent(preview.invited_email)}`);
                } else {
                    navigate("/signin");
                }
                return;
            }

            const sessionEmail = (localStorage.getItem("userEmail") || "").toLowerCase();
            if (sessionEmail && sessionEmail !== preview.invited_email.toLowerCase()) {
                // Logged in as a different account than the invite is for.
                setCurrentEmail(localStorage.getItem("userEmail") || "");
                setPhase("mismatch");
                return;
            }

            // Logged in as the invited email — hand off to /jointeam, whose
            // consume funnel redeems the token with a live access token.
            navigate("/jointeam");
        })();
        return () => {
            cancelled = true;
        };
    }, [token, navigate]);

    const handleSignOutAndContinue = async () => {
        try {
            await fetch(`${base_url}/user/signout/`, {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // Best-effort: even if the server call fails, clear local auth
            // state below so the re-entry runs as a logged-out visitor.
        }
        AUTH_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, ""));
        setAccessToken(null);
        // Token is preserved in the URL; a full reload re-runs this handler
        // as a logged-out visitor, which routes to signup/signin.
        window.location.assign(`/accept-invite?token=${encodeURIComponent(token)}`);
    };

    const title =
        phase === "loading"
            ? t.admin.acceptInvite.loadingTitle
            : phase === "mismatch"
              ? t.admin.acceptInvite.mismatchTitle
              : t.admin.acceptInvite.invalidTitle;

    const body =
        phase === "invalid"
            ? t.admin.acceptInvite.invalidBody
            : phase === "mismatch"
              ? fmt(t.admin.acceptInvite.mismatchBody, {
                    current: currentEmail,
                    invited: invitedEmail,
                })
              : "";

    return (
        <Box
            component="main"
            sx={{
                my: "auto",
                py: 2,
                pb: 5,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: { xs: "100%", md: 420 },
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
                    p: 4,
                    backdropFilter: "blur(12px)",
                }}
            >
                <Stack sx={{ gap: 3, mb: 3 }}>
                    <Stack sx={{ gap: 1 }}>
                        <Typography
                            component="h1"
                            level="h2"
                            sx={{
                                background: styles.titleGradient,
                                backgroundClip: "text",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {title}
                        </Typography>
                        {body && (
                            <Typography level="body-sm" sx={{ color: styles.subtitleColor }}>
                                {body}
                            </Typography>
                        )}
                    </Stack>
                </Stack>

                {phase === "loading" && (
                    <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size="md" />
                    </Stack>
                )}

                {phase === "mismatch" && (
                    <Stack sx={{ gap: 2 }}>
                        <Alert color="warning" sx={{ borderRadius: "12px" }}>
                            {t.admin.acceptInvite.mismatchShort}
                        </Alert>
                        <Button
                            startDecorator={<LogoutRoundedIcon />}
                            sx={{
                                py: 1.5,
                                background: styles.buttonBg,
                                borderRadius: "12px",
                                fontWeight: 600,
                                fontSize: "15px",
                                boxShadow: styles.buttonShadow,
                                "&:hover": { background: styles.buttonHover },
                            }}
                            fullWidth
                            onClick={handleSignOutAndContinue}
                        >
                            {t.admin.acceptInvite.signOutAndContinue}
                        </Button>
                    </Stack>
                )}

                {phase === "invalid" && (
                    <Stack sx={{ gap: 2 }}>
                        <Typography
                            level="body-sm"
                            sx={{ color: styles.subtitleColor }}
                            textAlign="center"
                        >
                            <Link
                                level="title-sm"
                                startDecorator={<LoginRoundedIcon sx={{ fontSize: 18 }} />}
                                sx={{
                                    color: styles.linkColor,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    "&:hover": { color: styles.linkHover },
                                }}
                                onClick={() => navigate("/signin")}
                            >
                                {t.admin.acceptInvite.backToSignIn}
                            </Link>
                        </Typography>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

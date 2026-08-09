import { useEffect, useState } from "react";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import { clearUserScopedLocalStorage, useAuth } from "../../../context/AuthContext";
import { DatabaseUtils } from "../../../db/utils";
import { fmt, useTranslation } from "../../../i18n";
import { authApi } from "../../../services/api";
import { purplePalette } from "../../../theme/purplePalette";

interface MeResponse {
    id: string;
    username: string;
    email: string;
    profile_image_file_name: string | null;
    is_offline_forced: boolean;
    custom_status: string | null;
    role: string | null;
    base_country: string | null;
    phone_number: string | null;
    current_location: string | null;
    about_me: string | null;
    ts_created_at: string;
}

// Reasons whose remedy is "use the method this account actually signs in
// with". The backend sends `primary` alongside them so we can name it
// instead of leaving the user to guess.
const REMEDY_IS_ANOTHER_METHOD = new Set(["email_in_use", "not_a_login_account"]);

export const OAuthSuccessHandler = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { setAccessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignInFormStyles.dark : SignInFormStyles.light;
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [error, setError] = useState<string | null>(null);
    const oauth = t.admin.auth.oauth;

    const failureMessage = (reason: string, primary: string | null): string => {
        const reasonKey = reason as keyof typeof oauth.failureReasons;
        const base = Object.prototype.hasOwnProperty.call(oauth.failureReasons, reasonKey)
            ? oauth.failureReasons[reasonKey]
            : oauth.failureReasons.fallback;
        if (!REMEDY_IS_ANOTHER_METHOD.has(reason)) return base;

        const methodKey = primary as keyof typeof oauth.methods;
        const method =
            primary && Object.prototype.hasOwnProperty.call(oauth.methods, methodKey)
                ? oauth.methods[methodKey]
                : oauth.methods.fallback;
        return `${base} ${fmt(oauth.useAnotherMethod, { method })}`;
    };

    useEffect(() => {
        let cancelled = false;

        const query = new URLSearchParams(window.location.search);
        const failureFromQuery = query.get("error");
        if (failureFromQuery) {
            setError(failureMessage(failureFromQuery, query.get("primary")));
            return;
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access = hashParams.get("access");
        // Mirror the email/password sign-in flow: new users go to
        // /jointeam to pick or create a team before the team-scoped
        // workspace requests fire (otherwise an empty `teamId` crashes
        // the various history endpoints).
        const next = hashParams.get("next") || "/jointeam";

        if (!access) {
            // Neither success-fragment nor failure-query — landed
            // here directly. Send the user back to /signin.
            navigate("/signin", { replace: true });
            return;
        }

        // Clear the hash so the JWT isn't sitting in window.location
        // after we navigate away. History replaceState is silent —
        // no extra browser history entry.
        window.history.replaceState({}, "", window.location.pathname);

        const completeSession = async () => {
            const api = authApi(access);
            if (!api) {
                if (!cancelled) setError(oauth.apiClientFailed);
                return;
            }
            try {
                const res = await api.get<MeResponse>("/user/me/");
                if (cancelled) return;
                const me = res.data;

                // Mirror the email/password sign-in flow's
                // localStorage handling — same keys, same
                // user-change wipe + IndexedDB clear logic.
                const previousUserId = localStorage.getItem("userId");
                const isDifferentUser = previousUserId !== me.id;
                if (isDifferentUser) {
                    clearUserScopedLocalStorage();
                }

                setAccessToken(access);
                localStorage.setItem("isSigningIn", "yes");
                localStorage.setItem("userName", me.username || "");
                localStorage.setItem("userId", me.id || "");
                localStorage.setItem("tsJoined", me.ts_created_at || "");
                localStorage.setItem("isOfflineForced", me.is_offline_forced ? "true" : "false");
                localStorage.setItem("role", me.role || "");
                localStorage.setItem("baseCountry", me.base_country || "");
                localStorage.setItem("phoneNumber", me.phone_number || "");
                localStorage.setItem("currentLocation", me.current_location || "");
                localStorage.setItem("aboutMe", me.about_me || "");
                localStorage.setItem("customStatus", me.custom_status || "");
                localStorage.setItem("userEmail", me.email || "");
                localStorage.setItem("avatarImgPath", me.profile_image_file_name || "");

                if (isDifferentUser) {
                    await DatabaseUtils.clearTeamScopedStores();
                }

                navigate(next, { replace: true });
            } catch (err) {
                console.error("OAuth post-login user fetch failed:", err);
                if (!cancelled) setError(oauth.profileFailed);
            }
        };

        void completeSession();

        return () => {
            cancelled = true;
        };
    }, [navigate, setAccessToken, t]);

    return (
        <Box
            component="main"
            sx={{
                my: "auto",
                width: { xs: "100%", md: 420 },
                mx: "auto",
                py: 4,
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
                {error ? (
                    <Stack spacing={2}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ErrorOutlineRoundedIcon
                                sx={{ color: palette.dangerTintBorder, fontSize: 28 }}
                            />
                            <Typography level="h4" sx={{ fontWeight: 700 }}>
                                {oauth.title}
                            </Typography>
                        </Stack>
                        <Alert
                            color="danger"
                            sx={{
                                borderRadius: "12px",
                                border: `1px solid ${palette.dangerTintBorder}`,
                            }}
                        >
                            {error}
                        </Alert>
                        <Button
                            sx={{
                                py: 1.25,
                                borderRadius: "12px",
                                fontWeight: 600,
                                background: styles.buttonBg,
                                "&:hover": { background: styles.buttonHover },
                            }}
                            onClick={() => navigate("/signin", { replace: true })}
                        >
                            {oauth.backToSignIn}
                        </Button>
                    </Stack>
                ) : (
                    <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                        <CircularProgress size="lg" />
                        <Typography level="body-md" sx={{ color: styles.subtitleColor }}>
                            {oauth.finishing}
                        </Typography>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

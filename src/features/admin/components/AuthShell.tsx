import { Box, CssBaseline, GlobalStyles, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Outlet } from "react-router-dom";

import { SignInFormStyles } from "../../../components/ui/styles/commonStyle";
import { fmt, I18nProvider, useTranslation } from "../../../i18n";
import { ColorThemeProvider } from "../../../theme/ColorThemeProvider";
import { AdminHeader } from "./Header";

// Shared chrome for every admin-auth route (sign in, sign up, reset
// password, verify email, OAuth bounce, join team). Owns the providers
// (theme + i18n), the gradient background, AdminHeader, and the footer.
// Nested routes render their own inner column via <Outlet />, so they can
// pick their own width / gap / stack of cards.
//
// Mounted once via <Route element={<AuthShell />}> in main.tsx — moving
// between these routes only swaps the <Outlet /> child, so providers and
// the header don't re-init and the screen no longer flashes.
const AuthShellInner = () => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? SignInFormStyles.dark : SignInFormStyles.light;

    return (
        <Box
            sx={(theme) => ({
                backdropFilter: "blur(12px)",
                backgroundColor: "rgba(255 255 255 / 0.2)",
                display: "flex",
                justifyContent: "flex-end",
                position: "relative",
                transition: "width var(--Transition-duration)",
                transitionDelay: "calc(var(--Transition-duration) + 0.1s)",
                width: { xs: "100%", md: "100vw" },
                zIndex: 1,
                [theme.getColorSchemeSelector("dark")]: {
                    backgroundColor: "rgba(19 19 24 / 0.4)",
                },
            })}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100dvh",
                    px: 2,
                    width: "100%",
                }}
            >
                <AdminHeader />
                <Outlet />
                <Box component="footer" sx={{ py: 3 }}>
                    <Typography
                        level="body-xs"
                        sx={{ textAlign: "center", color: styles.subtitleColor }}
                    >
                        {fmt(t.admin.brand.copyright, { year: new Date().getFullYear() })}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

// Signed-out routes follow the saved color theme too — the preference is
// localStorage, so it's readable before auth, and someone who picked Teal
// shouldn't get bounced back to purple at the sign-in screen. A brand-new
// visitor has nothing stored and sees the default.
export const AuthShell = () => (
    <ColorThemeProvider>
        <CssBaseline />
        <GlobalStyles
            styles={{
                ":root": {
                    "--Form-maxWidth": "800px",
                    "--Transition-duration": "0.4s",
                },
            }}
        />
        <I18nProvider>
            <AuthShellInner />
        </I18nProvider>
    </ColorThemeProvider>
);

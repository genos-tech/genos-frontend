import "@fontsource-variable/geist/index.css";
import "./index.css";

import { useEffect } from "react";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createRoot } from "react-dom/client";

import { AuthContext } from "./context/authState";
import { SkillRunCardDialog } from "./features/genos/skills/SkillRunCardDialog";
import { SkillUpdateDiffDialog } from "./features/genos/skills/SkillUpdateDiffDialog";

import { I18nProvider } from "./i18n";
import { ColorThemeProvider } from "./theme/ColorThemeProvider";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "dark" ? "dark" : "light";
const which = params.get("d") === "diff" ? "diff" : "run";

const ModeSetter = () => {
    const { setMode } = useColorScheme();
    useEffect(() => setMode(mode), [setMode]);
    return null;
};
const noop = () => {};

const Page = () => (
    <AuthContext.Provider value={{ accessToken: "tok", setAccessToken: noop }}>
        <ColorThemeProvider>
            <I18nProvider>
                <ModeSetter />
                <Box sx={{ p: 3 }}>
                    <Typography level="h3">Skills</Typography>
                    <Typography>Page behind the dialog.</Typography>
                </Box>
                {which === "run" ? (
                    <SkillRunCardDialog
                        request={{ teamId: "t1", skillId: "s1", versionNo: 3 }}
                        onResolve={noop}
                    />
                ) : (
                    <SkillUpdateDiffDialog
                        skill={{ id: "s1", title: "Weekly update" }}
                        onClose={noop}
                    />
                )}
            </I18nProvider>
        </ColorThemeProvider>
    </AuthContext.Provider>
);

createRoot(document.getElementById("root")!).render(<Page />);

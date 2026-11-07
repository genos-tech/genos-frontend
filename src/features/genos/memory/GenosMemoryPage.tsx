import { useState } from "react";
import { Box, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { ConversationsSection } from "./ConversationsSection";
import { McpUseSection } from "./McpUseSection";
import { SettingsGenosUsesSection } from "./SettingsGenosUsesSection";
import { SharedAnswersSection } from "./SharedAnswersSection";

interface Props {
    // The team the workspace is showing. Every list on this page is scoped
    // to it (the person may belong to several; see "One team at a time" in
    // the README), and delete-all names it explicitly.
    teamId: string;
    onOpenLanguageSettings?: () => void;
}

/**
 * "What Genos remembers".
 *
 * Genos keeps no separate store of "memories". What it draws on is a small
 * set of things the person already owns, and this page is a stack of one
 * section per thing so each can be read, and where it makes sense deleted,
 * on its own:
 *
 *   1. their Genos conversations,
 *   2. the answers of theirs that teammates may see,
 *   3. a note of which items their connected AI apps opened (one switch; references only,
 *      and NOT something Genos's own answers use),
 *   4. the settings Genos reads.
 *
 * Sections are independent siblings that share only `teamId` and the token.
 * That is the seam a further section (a profile Genos is allowed to use)
 * would slot into: add a sibling here, touch nothing else.
 */
export const GenosMemoryPage = ({ teamId, onOpenLanguageSettings }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const m = t.settings.genosMemory;
    // Deleting a conversation also deletes the answer built from it, so the
    // shared-answers list refetches rather than guess which rows went.
    const [sharedRefreshKey, setSharedRefreshKey] = useState(0);

    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography level="title-lg" sx={{ overflowWrap: "anywhere" }}>
                    {m.title}
                </Typography>
                <Typography level="body-sm" sx={{ mt: 0.5 }}>
                    {m.intro}
                </Typography>
            </Box>
            <ConversationsSection
                accessToken={accessToken}
                teamId={teamId}
                onChanged={() => setSharedRefreshKey((k) => k + 1)}
            />
            <SharedAnswersSection
                accessToken={accessToken}
                refreshKey={sharedRefreshKey}
                teamId={teamId}
            />
            <McpUseSection />
            <SettingsGenosUsesSection
                accessToken={accessToken}
                onOpenLanguageSettings={onOpenLanguageSettings}
            />
        </Stack>
    );
};

import Box from "@mui/joy/Box";
import { useLocation } from "react-router-dom";

import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useTranslation } from "../../i18n";
import { visuallyHidden } from "../ui/a11y/visuallyHidden";

const SECTION_KEYS = ["genos", "chat", "tasks", "notes", "plans", "integrations"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const isSectionKey = (value: string | undefined): value is SectionKey =>
    SECTION_KEYS.includes(value as SectionKey);

/**
 * The first heading of the signed-in app's `<main>` and the document title (MIP-1826). Most
 * screens drew no heading at all, so a screen reader's heading list was empty and every tab was
 * titled "Genos". Inbox draws its own visible h1 (`PageHeader`), so it gets none from here.
 */
export function ScreenHeading() {
    const { t } = useTranslation();
    const section = useLocation().pathname.split("/")[2];
    const name = isSectionKey(section) ? t.app.features[section] : null;
    useDocumentTitle(name ? `${name} | Genos` : "Genos");
    if (!name) return null;
    return (
        <Box component="h1" sx={visuallyHidden}>
            {name}
        </Box>
    );
}

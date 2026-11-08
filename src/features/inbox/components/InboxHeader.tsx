import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";

import { PageHeader } from "../../../components/ui/page/PageHeader";
import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { InboxSyncButton } from "./InboxSyncButton";

/** The Inbox's page header: the shared bar, with its icon and one line of context. */
export const InboxHeader = () => {
    const { t } = useTranslation();

    return (
        <PageHeader
            actions={<InboxSyncButton />}
            data-testid="inbox-header"
            leading={<AllInboxRoundedIcon sx={{ fontSize: 20, color: g.text.secondary }} />}
            subtitle={t.inbox.header.subtitle}
            title={t.inbox.header.title}
        />
    );
};

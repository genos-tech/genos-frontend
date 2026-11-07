import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { Panel } from "react-resizable-panels";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../../i18n";

interface SelectChatPanelProps {
    setMainChatPanelSize: (size: number) => void;
}

export const SelectChatPanel = ({ setMainChatPanelSize }: SelectChatPanelProps) => {
    const { t } = useTranslation();

    return (
        <Panel
            defaultSize={70}
            id={"9"}
            maxSize={80}
            minSize={30}
            order={9}
            onResize={setMainChatPanelSize}
        >
            <EmptyState
                body={t.chat.emptyPane.subtitle}
                data-empty="chat-pane"
                icon={<ChatBubbleOutlineRoundedIcon />}
                title={t.chat.emptyPane.title}
                fill
            />
        </Panel>
    );
};

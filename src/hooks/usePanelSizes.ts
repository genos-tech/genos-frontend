import { useState } from "react";

export const usePanelSizes = () => {
    const [mainChatPanelSize, setMainChatPanelSize] = useState(50);
    const [subChatPanelSize, setSubChatPanelSize] = useState(50);

    return {
        mainChatPanelSize,
        setMainChatPanelSize,
        subChatPanelSize,
        setSubChatPanelSize,
    };
};

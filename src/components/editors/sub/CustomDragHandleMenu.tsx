import { BlockColorsItem, DragHandleMenu, RemoveBlockItem } from "@blocknote/react";

import { useTranslation } from "../../../i18n";
import { ResetBlockTypeItem } from "./ResetBlockTypeItem";

/**
 * Shared drag-handle menu for the collaborative editors.
 *
 * Lives at module scope so its component identity is stable: the editors
 * previously each defined this inline, which minted a new component type on
 * every render and forced React to unmount/remount the menu subtree whenever
 * the host editor re-rendered.
 */
export const CustomDragHandleMenu = () => {
    const { t } = useTranslation();
    return (
        <DragHandleMenu>
            <RemoveBlockItem>{t.common.editor.delete}</RemoveBlockItem>
            <BlockColorsItem>{t.common.editor.colors}</BlockColorsItem>
            {/* Item which resets the hovered block's type. */}
            <ResetBlockTypeItem>{t.common.editor.resetType}</ResetBlockTypeItem>
        </DragHandleMenu>
    );
};

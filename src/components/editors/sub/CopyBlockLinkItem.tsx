import { ReactNode } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";

import { useTranslation } from "../../../i18n";
import { useNoteLink } from "./NoteLinkContext";

/**
 * "Copy link to block" in a block's drag-handle menu (MIP-146). Offered only inside a note that
 * provides a link (`NoteLinkContext`); anywhere else this renders nothing.
 */
export function CopyBlockLinkItem(props: { children?: ReactNode }) {
    const editor = useBlockNoteEditor();
    const { t } = useTranslation();
    const noteLink = useNoteLink();
    const Components = useComponentsContext()!;

    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!noteLink || block === undefined) {
        return null;
    }

    return (
        <Components.Generic.Menu.Item
            onClick={() => {
                const url = noteLink.blockLink(block.id);
                if (url) void noteLink.copy(url);
            }}
        >
            {props.children || t.common.editor.noteLink.copyBlockLink}
        </Components.Generic.Menu.Item>
    );
}

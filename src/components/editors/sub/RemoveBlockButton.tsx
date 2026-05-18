import { SideMenuExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { MdDelete } from "react-icons/md";

import { useTranslation } from "../../../i18n";

export function RemoveBlockButton() {
    const editor = useBlockNoteEditor<any, any, any>();
    const { t } = useTranslation();

    const Components = useComponentsContext()!;

    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (block === undefined) {
        return null;
    }

    return (
        <Components.SideMenu.Button
            label={t.common.editor.removeBlock}
            icon={
                <MdDelete
                    size={24}
                    onClick={() => {
                        editor.removeBlocks([block]);
                    }}
                />
            }
        />
    );
}

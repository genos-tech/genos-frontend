import { ReactNode } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";

import { useTranslation } from "../../../i18n";

export function ResetBlockTypeItem(props: { children?: ReactNode }) {
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
        <Components.Generic.Menu.Item
            onClick={() => {
                editor.updateBlock(block, { type: "paragraph" });
            }}
        >
            {props.children || t.common.editor.resetType}
        </Components.Generic.Menu.Item>
    );
}

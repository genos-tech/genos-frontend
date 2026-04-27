import { SideMenuExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor, useComponentsContext, useExtensionState } from "@blocknote/react";
import { MdDelete } from "react-icons/md";

export function RemoveBlockButton() {
    const editor = useBlockNoteEditor<any, any, any>();

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
            label="Remove block"
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

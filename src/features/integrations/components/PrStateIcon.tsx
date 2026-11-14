import { prStateColor, type PrState } from "../utils/prState";
import { PrClosedIcon, PrDraftIcon, PrMergedIcon, PrOpenIcon } from "./icons/Octicons";

// The PR state octicon in GitHub's state color. One place for the task table's chip,
// the linked PR card and the hover card, so a state never reads differently between them.
export const PrStateIcon = ({
    state,
    size = 14,
    color: colorOverride,
}: {
    state: PrState;
    size?: number;
    /** Ink to use instead of GitHub's state color, for a surface where that is too dim. */
    color?: string;
}) => {
    const color = colorOverride ?? prStateColor(state);
    const common = { width: size, height: size, style: { color } };
    switch (state) {
        case "merged":
            return <PrMergedIcon {...common} />;
        case "draft":
            return <PrDraftIcon {...common} />;
        case "closed":
            return <PrClosedIcon {...common} />;
        case "open":
        default:
            return <PrOpenIcon {...common} />;
    }
};

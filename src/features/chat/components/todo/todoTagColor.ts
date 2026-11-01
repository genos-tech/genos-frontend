import { TodoCategoryProps } from "../../../../types/chat";

// The neutral gray every tag starts with (matches the API's default).
export const DEFAULT_TODO_TAG_COLOR = "#808080";

/**
 * The colour a tag's chip is drawn in. Falls back to the neutral default for
 * a payload without one (an older API, or a cached category list from before
 * tags had colours) so the chip never renders with an undefined colour.
 */
export const todoTagColor = (category: Pick<TodoCategoryProps, "color">): string =>
    category.color || DEFAULT_TODO_TAG_COLOR;

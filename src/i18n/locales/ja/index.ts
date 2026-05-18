import type { DeepPartial, Messages } from "../../types";

/**
 * Japanese dictionary stub. Add keys here as translations land; any missing
 * key automatically falls back to the English value via deepMerge in the
 * I18nProvider. The shape is enforced as `DeepPartial<Messages>` so partial
 * coverage is a type-safe state rather than a build error.
 */
export const ja: DeepPartial<Messages> = {};

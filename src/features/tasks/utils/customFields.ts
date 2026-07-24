import {
    CustomFieldOption,
    CustomFieldValue,
    CustomFieldValues,
    ProjectCustomFieldDef,
} from "../../../types/tasks";
// type-only: DraggableTaskTable imports helpers from this module, so a
// value import here would create a runtime cycle. The type is erased.
import type { ColumnDef } from "../components/table/DraggableTaskTable";

// Table-column field keys for custom fields are namespaced so they can
// never collide with a built-in column ("status", "tags", …). The
// numeric suffix is the server-side fieldId — globally unique
// (BigAutoField), so keys from different projects can coexist in the
// per-device column preferences without clashing.
export const CUSTOM_FIELD_COL_PREFIX = "cf_";

export const customFieldColKey = (fieldId: number): string =>
    `${CUSTOM_FIELD_COL_PREFIX}${fieldId}`;

/** Inverse of customFieldColKey. Null for non-custom column keys. */
export const parseCustomFieldColKey = (field: string): number | null => {
    if (!field.startsWith(CUSTOM_FIELD_COL_PREFIX)) return null;
    const suffix = field.slice(CUSTOM_FIELD_COL_PREFIX.length);
    if (suffix === "") return null;
    const id = Number(suffix);
    return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Build table ColumnDefs for a project's custom fields. Visible by
 * default (the user hides/reorders them via Customize columns — the
 * per-device preference store keys on `field`, which is stable across
 * sessions because it embeds the server fieldId).
 *
 * No `headerLabelKey`: the header label is the user-defined field name,
 * so `visibleColumns`' i18n resolution leaves `headerName` untouched.
 */
export const buildCustomFieldColumns = (defs: ProjectCustomFieldDef[]): ColumnDef[] =>
    [...defs]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.fieldId - b.fieldId)
        .map((def) => ({
            field: customFieldColKey(def.fieldId),
            headerName: def.fieldName,
            width: def.fieldType === "date" ? 120 : 140,
            minWidth: 80,
            maxWidth: 400,
            align: def.fieldType === "text" ? ("left" as const) : ("center" as const),
            editable: true,
            resizable: true,
        }));

/** The stored value for one field, normalized to its per-type shape. */
export const getCustomFieldValue = (
    values: CustomFieldValues | undefined,
    fieldId: number
): CustomFieldValue | undefined => values?.[String(fieldId)];

/** Tag-type reader: stored option ids → live option objects. Orphaned
 *  ids (option/field deleted since the value was written) are dropped —
 *  the server deliberately never rewrites task rows on option edits. */
export const resolveTagOptions = (
    def: ProjectCustomFieldDef,
    value: CustomFieldValue | undefined
): CustomFieldOption[] => {
    if (!Array.isArray(value) || value.length === 0) return [];
    const byId = new Map(def.options.map((o) => [o.id, o]));
    return value.map((id) => byId.get(id)).filter((o): o is CustomFieldOption => o != null);
};

/** Text/date/member reader: the stored string, or "" when unset (or
 *  when the stored shape doesn't match the field type). */
export const getCustomFieldString = (
    values: CustomFieldValues | undefined,
    fieldId: number
): string => {
    const value = getCustomFieldValue(values, fieldId);
    return typeof value === "string" ? value : "";
};

/**
 * Immutably set one field's value in a task's value map. Empty values
 * (null / "" / []) DELETE the key — absence is the canonical "unset",
 * matching the server-side sanitizer which drops empties too.
 */
export const setCustomFieldValue = (
    values: CustomFieldValues | undefined,
    fieldId: number,
    value: CustomFieldValue | null
): CustomFieldValues => {
    const next: CustomFieldValues = { ...(values ?? {}) };
    const key = String(fieldId);
    const isEmpty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
        delete next[key];
    } else {
        next[key] = value;
    }
    return next;
};

/** Shallow value-map equality (order-insensitive keys, order-SENSITIVE
 *  tag lists — reordering chips is not a meaningful edit and the UI
 *  never reorders them, so this stays cheap). */
export const customFieldValuesEqual = (
    a: CustomFieldValues | undefined,
    b: CustomFieldValues | undefined
): boolean => {
    const ka = Object.keys(a ?? {});
    const kb = Object.keys(b ?? {});
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
        const va = (a ?? {})[k];
        const vb = (b ?? {})[k];
        if (Array.isArray(va) || Array.isArray(vb)) {
            if (!Array.isArray(va) || !Array.isArray(vb) || va.length !== vb.length) return false;
            for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
        } else if (va !== vb) {
            return false;
        }
    }
    return true;
};

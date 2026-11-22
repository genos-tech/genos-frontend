import { MdCancel, MdCheckCircle, MdError, MdInfo } from "react-icons/md";

// The types of alerts that users can choose from. The `titleKey` is
// resolved against `t.common.editor.alert*` at render time so the labels
// reflect the active locale.
export const alertTypes = [
    {
        titleKey: "alertWarning",
        value: "warning",
        icon: MdError,
        color: "#e69819",
        backgroundColor: {
            light: "#fff6e6",
            dark: "#805d20",
        },
    },
    {
        titleKey: "alertError",
        value: "error",
        icon: MdCancel,
        color: "#d80d0d",
        backgroundColor: {
            light: "#ffe6e6",
            dark: "#802020",
        },
    },
    {
        titleKey: "alertInfo",
        value: "info",
        icon: MdInfo,
        color: "#507aff",
        backgroundColor: {
            light: "#e6ebff",
            dark: "#203380",
        },
    },
    {
        titleKey: "alertSuccess",
        value: "success",
        icon: MdCheckCircle,
        color: "#0bc10b",
        backgroundColor: {
            light: "#e6ffe6",
            dark: "#208020",
        },
    },
] as const;

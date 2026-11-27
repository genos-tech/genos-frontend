import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";

type PlanStrings = Messages["settings"]["planUsage"];

const UNITS = [
    { bytes: 1024 ** 3, key: "matrixGb", slot: "gb", places: 2 },
    { bytes: 1024 ** 2, key: "matrixMb", slot: "mb", places: 1 },
] as const;

/**
 * A number of bytes as "512 KB", "199.9 MB" or "1 GB" (binary units, as the server counts them).
 * Rounds DOWN, so what is shown as left is never more than is left.
 */
export const storageLabel = (bytes: number, p: PlanStrings, locale: string): string => {
    for (const unit of UNITS) {
        if (bytes >= unit.bytes) {
            const scale = 10 ** unit.places;
            const value = Math.floor((bytes / unit.bytes) * scale) / scale;
            return fmt(p[unit.key], { [unit.slot]: value.toLocaleString(locale) });
        }
    }
    return fmt(p.matrixKb, { kb: Math.ceil(bytes / 1024).toLocaleString(locale) });
};

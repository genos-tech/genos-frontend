/** Format bytes as a human-readable size. Mirrors the production
 *  formatter (KB/MB/GB with one decimal, dropped for whole numbers). */
export function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i += 1;
    }
    if (i === 0) return `${n} ${units[i]}`;
    const rounded = Math.round(n * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${units[i]}`;
}

import { getMessages } from "../i18n";

export const getLocalCurrentTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const getLocalCurrentDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/** Tomorrow's local calendar date as `YYYY-MM-DD`.
 *
 *  The partner of `getLocalCurrentDate` above, and it has to be built the
 *  same way: to-do groups are keyed by the date the CLIENT says it is, so a
 *  "tomorrow" that disagrees with that function's "today" by one day — which
 *  is what `getFormattedNDaysAfterDateStr(1)` gives you, since it formats
 *  through `toISOString()` in UTC — files the to-do under today's date for
 *  anyone west of UTC, and two days out for anyone far enough east.
 *
 *  `new Date(y, m, d + 1)` is deliberate rather than arithmetic on the day
 *  number: the Date constructor rolls the month and year over for you, so
 *  the 31st and Dec 31 need no special case. */
export const getLocalTomorrowDate = (): string => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const formatDateLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");

    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
};

const convertAlmostIsoUtcToLocalFormatted = (utcTimestamp: string): string => {
    const isoTimestamp = utcTimestamp.replace(" ", "T");
    const date = new Date(isoTimestamp);

    if (isNaN(date.getTime())) {
        throw new Error("Invalid timestamp format");
    }

    return formatDateLocal(date);
};

const checkTimestampDay = (
    utcTimestamp: string
): "today" | "yesterday" | "withinAYear" | "other" => {
    // Replace space with 'T' to make ISO 8601
    const isoTimestamp = utcTimestamp.replace(" ", "T");
    const date = new Date(isoTimestamp);

    if (isNaN(date.getTime())) {
        throw new Error("Invalid timestamp format");
    }

    const now = new Date();

    // Local dates (no time)
    const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Difference in milliseconds
    const diffMs = inputDate.getTime() - todayDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24); // convert ms to days

    if (diffDays === 0) {
        return "today";
    } else if (diffDays === -1) {
        return "yesterday";
    } else if (diffDays >= -365) {
        return "withinAYear";
    } else {
        return "other";
    }
};

const monthNameLookUp: { [key: string]: string } = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
};

export const extractMMDDHHMMSSs = (ts: string) => {
    if (!ts || ts.trim() === "") return "";
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    return tsLocal;
};

export const extractYYYYMMDDHHMM = (ts: string) => {
    if (!ts || ts.trim() === "") return "";
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    const tsDay: string = checkTimestampDay(ts);

    if (tsDay === "today") {
        return `${getMessages().app.dates.today} ${tsLocal.slice(11, 16)}`;
    } else if (tsDay === "yesterday") {
        return `${getMessages().app.dates.yesterday} ${tsLocal.slice(11, 16)}`;
    } else if (tsDay === "withinAYear") {
        const month: string = monthNameLookUp[tsLocal.slice(5, 7)];
        return `${month}. ${+tsLocal.slice(8, 10)}, ${tsLocal.slice(10, 16)}`;
    }
    const month: string = monthNameLookUp[tsLocal.slice(5, 7)];
    return `${tsLocal.slice(0, 4)} ${month}. ${+tsLocal.slice(8, 10)}, ${tsLocal.slice(10, 16)}`;
};

export const extractMMDD = (ts: string) => {
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    const tsDay: string = checkTimestampDay(ts);

    if (tsDay === "today") {
        return getMessages().app.dates.today;
    } else if (tsDay === "yesterday") {
        return getMessages().app.dates.yesterday;
    } else if (tsDay === "withinAYear") {
        const month: string = monthNameLookUp[tsLocal.slice(5, 7)];
        return `${month}. ${+tsLocal.slice(8, 10)}`;
    }
    const month: string = monthNameLookUp[tsLocal.slice(5, 7)];
    return `${month}. ${+tsLocal.slice(8, 10)}, ${tsLocal.slice(0, 4)}`;
};

export const extractYYYYMMDD = (ts: string) => {
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    const tsDay: string = checkTimestampDay(ts);

    if (tsDay === "today") {
        return getMessages().app.dates.today;
    } else if (tsDay === "yesterday") {
        return getMessages().app.dates.yesterday;
    }
    const month: string = monthNameLookUp[tsLocal.slice(5, 7)];
    return `${month}. ${+tsLocal.slice(8, 10)}, ${tsLocal.slice(0, 4)}`;
};

export const getFormattedTodayDateStr = (): string => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

export const getFormattedNDaysAfterDateStr = (n: number): string => {
    const today = new Date();
    today.setDate(today.getDate() + n);
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

export const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

export const getTimeDiffSeconds = (ts1: string, ts2: string): number => {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);

    // difference in milliseconds → convert to seconds
    return Math.abs((d2.getTime() - d1.getTime()) / 1000);
};

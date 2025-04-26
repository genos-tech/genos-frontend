export const getCurrentTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const formatDateLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const convertAlmostIsoUtcToLocalFormatted = (utcTimestamp: string): string => {
    const isoTimestamp = utcTimestamp.replace(' ', 'T');
    const date = new Date(isoTimestamp);

    if (isNaN(date.getTime())) {
        throw new Error("Invalid timestamp format");
    }

    return formatDateLocal(date);
}

const checkTimestampDay = (utcTimestamp: string): "today" | "yesterday" | "other" => {
    // Replace space with 'T' to make ISO 8601
    const isoTimestamp = utcTimestamp.replace(' ', 'T');
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
    } else {
        return "other";
    }
}


export const extractMMDDHHMM = (ts: string) => {
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    const tsDay: string = checkTimestampDay(ts);

    if (tsDay === "today") {
        return `Today ${tsLocal.slice(11, 16)}`;
    } else if (tsDay === "yesterday") {
        return `Yesterday ${tsLocal.slice(11, 16)}`;
    }
    return `${tsLocal.slice(0, 10)} ${tsLocal.slice(11, 16)}`;
}

export const extractHHMM = (ts: string) => {
    const tsLocal = convertAlmostIsoUtcToLocalFormatted(ts);
    const tsDay: string = checkTimestampDay(ts);

    if (tsDay === "today") {
        return `Today ${tsLocal.slice(11, 16)}`;
    } else if (tsDay === "yesterday") {
        return `Yesterday ${tsLocal.slice(11, 16)}`;
    }
    return `${tsLocal.slice(5, 10)} ${tsLocal.slice(11, 16)}`;
}

export const getFormattedTodayDateStr = (): string => {
    let today = new Date();
    today.setDate(today.getDate() + 7);
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

export const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

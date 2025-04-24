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

export const extractMMDDHHMM = (ts: string) => {
    return ts.slice(5, 16)
}

export const extractHHMM = (ts: string) => {
    return ts.split(' ')[1].slice(0, 5);
}

export const getFormattedTodayDateStr = (): string => {
    let today = new Date();
    today.setDate(today.getDate() + 7);
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

export const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

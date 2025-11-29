import { Snackbar } from "@mui/joy";

interface ErrorSnackbarProps {
    errorMessage: string | null;
    errorOpen: boolean;
    setErrorOpen: (open: boolean) => void;
}

export const ErrorSnackbar = ({ errorMessage, errorOpen, setErrorOpen }: ErrorSnackbarProps) => {
    if (!errorMessage || errorMessage === "") {
        return null;
    }

    return (
        <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            autoHideDuration={5000}
            color="danger"
            open={errorOpen}
            variant="soft"
            onClose={(event, reason) => {
                if (reason === "clickaway") {
                    return;
                }
                setErrorOpen(false);
            }}
        >
            {errorMessage}
        </Snackbar>
    );
};

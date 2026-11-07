import { Toast } from "../../../../components/ui/feedback/Toast";

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
        <Toast open={errorOpen} tone="danger" onClose={() => setErrorOpen(false)}>
            {errorMessage}
        </Toast>
    );
};

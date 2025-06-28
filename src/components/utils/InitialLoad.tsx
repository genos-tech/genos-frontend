import { CircularProgress, Typography, Box } from "@mui/joy";

import { loadInitialData } from "../../services/loadInitialData";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { useAuth } from "../../context/AuthContext";

type InitialLoadProps = {
    myself: UserProps;
    setIsLoading: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
};

export const InitialLoad = (props: InitialLoadProps) => {
    const { myself, setIsLoading, setCurrentMainChat } = props;
    const { accessToken } = useAuth();

    loadInitialData(myself, accessToken, setIsLoading, setCurrentMainChat);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                width: "100vw",
                backgroundColor: "background.level1",
            }}
        >
            <CircularProgress size="lg" />
            <Typography level="h4" sx={{ mt: 2 }}>
                Loading...
            </Typography>
        </Box>
    );
};

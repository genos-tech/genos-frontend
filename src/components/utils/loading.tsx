import { CircularProgress, Typography, Box } from "@mui/joy";
import { InitialLoad } from './initialLoad';
import {
    UserProps,
    ChatProps,
} from "../../types";
import { useAuth } from "../../components/admin/AuthContext";

type LoadingProps = {
    myself: UserProps;
    setIsLoading: (value: boolean) => void;
    setCurrentMainChat: (value: ChatProps) => void;
}

export default function Loading(props: LoadingProps) {
    const {
        myself,
        setIsLoading,
        setCurrentMainChat,
    } = props
    const { accessToken } = useAuth();

    InitialLoad(
        myself,
        accessToken,
        setIsLoading,
        setCurrentMainChat,
    );

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

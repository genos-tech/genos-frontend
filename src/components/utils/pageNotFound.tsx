import React from 'react';
import { Box, Button, Typography } from '@mui/joy';
import { useNavigate } from "react-router-dom";

const Error: React.FC = () => {
    const navigate = useNavigate();

    const handleBackHome = (): void => {
        navigate("/");
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh', // Full viewport height
                width: '100vw',
                textAlign: 'center' // Center text
            }}
        >
            <Typography level="h1" style={{ color: 'white' }}>
                404
            </Typography>
            <Typography level="h4" style={{ color: 'white' }}>
                The page you’re looking for doesn’t exist.
            </Typography>
            <Button onClick={handleBackHome}>Back Home</Button>
        </Box>
    );
};

export default Error;

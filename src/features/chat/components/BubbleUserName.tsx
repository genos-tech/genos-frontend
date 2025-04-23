import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';

type BubbleUserNameTypes = {
    userName: string,
    isSent: boolean,
    tsSent: string,
}
export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const { userName, isSent, tsSent } = props
    return (
        <Box sx={{ flex: 1 }}>
            <Typography
                level="body-xs"
                sx={[
                    {
                        lineHeight: 2
                    },
                    isSent
                        ? {
                            color: 'background.body',
                        }
                        : {
                            color: 'var(--joy-palette-text-primary)',
                        },
                ]}
            >
                {userName} &nbsp;  {tsSent}
            </Typography>
        </Box>
    )
}
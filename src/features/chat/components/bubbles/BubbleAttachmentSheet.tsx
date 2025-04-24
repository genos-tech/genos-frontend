import { Avatar, Stack, Sheet, Typography } from '@mui/joy';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';

type BubbleAttachmentSheetTypes = {
    fileName: string,
    fileSize: string,
    isSent: boolean,
}
export const BubbleAttachmentSheet = (props: BubbleAttachmentSheetTypes) => {
    const { fileName, fileSize, isSent } = props
    return (
        <Sheet
            variant="outlined"
            sx={[
                {
                    px: 1.75,
                    py: 1.25,
                    borderRadius: 'lg',
                },
                isSent ? { borderTopRightRadius: 0 } : { borderTopRightRadius: 'lg' },
                isSent ? { borderTopLeftRadius: 'lg' } : { borderTopLeftRadius: 0 },
            ]}
        >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Avatar color="primary" size="lg">
                    <InsertDriveFileRoundedIcon />
                </Avatar>
                <div>
                    <Typography sx={{ fontSize: 'sm' }}>{fileName}</Typography>
                    <Typography level="body-sm">{fileSize}</Typography>
                </div>
            </Stack>
        </Sheet>
    )
}
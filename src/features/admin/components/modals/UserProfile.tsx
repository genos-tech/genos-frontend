import {
    Modal,
    ModalDialog,
    AspectRatio,
    Box,
    FormControl,
    FormLabel,
    IconButton,
    Stack,
    Typography,
    Card,
    Chip
} from "@mui/joy";
import CircleIcon from '@mui/icons-material/Circle';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import EditIcon from '@mui/icons-material/Edit';
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import QuestionAnswerRoundedIcon from '@mui/icons-material/QuestionAnswerRounded';

import { UserProps } from '../../../../types/admin'
import { CountrySelector } from '../../../../components/utils/CountrySelector';

type UserProfileProps = {
    myself: UserProps;
    openUserProfile: boolean;
    setOpenUserProfile: (value: boolean) => void;
    setOpeningService: (value: number) => void;
}

export const UserProfile = (props: UserProfileProps) => {
    const {
        myself,
        openUserProfile,
        setOpenUserProfile,
        setOpeningService
    } = props

    return (
        <>
            <Modal open={openUserProfile} onClose={() => setOpenUserProfile(false)}>
                <ModalDialog>
                    <Box sx={{ flex: 1, width: '900px' }}>
                        <Box
                            sx={{
                                position: 'sticky',
                                top: { sm: -100, md: -110 },
                                zIndex: 9995,
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 3,
                                }}
                            >
                                <Typography level="h2" component="h1" sx={{ mt: 1, mb: 1 }}>
                                    My profile
                                </Typography>
                                <IconButton
                                    component="p"
                                    variant="outlined"
                                    size="sm"
                                    sx={{
                                        fontSize: '18px',
                                        paddingX: '10px',
                                        paddingY: '5px',
                                    }}
                                    onClick={() => {
                                        console.log("Open DM");
                                    }}
                                >
                                    <EditIcon />
                                    &nbsp;Edit
                                </IconButton>
                            </Box>
                        </Box>

                        <Stack
                            spacing={4}
                            sx={{
                                display: 'flex',
                                maxWidth: '800px',
                                mx: 'auto',
                                px: { xs: 2, md: 6 },
                                py: { xs: 2, md: 3 },
                            }}
                        >
                            <Card>
                                <Stack
                                    direction="row"
                                    spacing={3}
                                    sx={{ display: { xs: 'none', md: 'flex' }, my: 1 }}
                                >
                                    <AspectRatio
                                        ratio="1"
                                        maxHeight={200}
                                        sx={{ flex: 1, minWidth: 120, borderRadius: '100%' }}
                                    >
                                        <img
                                            src="myprofile.jpg"
                                            loading="lazy"
                                            alt=""
                                        />
                                    </AspectRatio>
                                    <Stack spacing={2} sx={{ flexGrow: 1 }}>
                                        <Typography
                                            fontSize={28}
                                            fontWeight="bold"
                                            noWrap
                                            endDecorator={
                                                <Chip
                                                    variant="outlined"
                                                    size="lg"
                                                    color="neutral"
                                                    sx={{ borderRadius: 'sm' }}
                                                    startDecorator={
                                                        <CircleIcon sx={{ fontSize: 8 }} color="success" />
                                                    }
                                                    slotProps={{ root: { component: 'span' } }}
                                                    onClick={() => { console.log("Set custom status") }}
                                                >
                                                    Online
                                                </Chip>
                                            }
                                        >
                                            {myself.userName}
                                        </Typography>
                                        <Stack direction={'row'} spacing={2}>
                                            <Typography startDecorator={<EmailRoundedIcon fontSize="small" />}>
                                                {myself.userEmail}
                                            </Typography>
                                            <Typography startDecorator={<LocalPhoneIcon fontSize="small" />}>
                                                +81 999-888-777
                                            </Typography>
                                        </Stack>
                                        <Stack direction="column" spacing={2}>
                                            <FormControl>
                                                <FormLabel>Team</FormLabel>
                                                <Typography fontWeight={'bold'}>
                                                    {myself.teamName}
                                                </Typography>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Role</FormLabel>
                                                <Typography fontWeight={'bold'}>
                                                    Data Engineer
                                                </Typography>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel>Country</FormLabel>
                                                <CountrySelector />
                                            </FormControl>
                                        </Stack>
                                        <Stack direction="column" spacing={2}>
                                            <FormControl>
                                                <FormLabel>Joined since</FormLabel>
                                                <Typography fontWeight={'bold'}>
                                                    2025/04/01
                                                </Typography>
                                            </FormControl>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Card>
                        </Stack>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'flex-end', // Push content to the right
                                px: 3,
                            }}
                        >
                            <IconButton
                                component="p"
                                variant="outlined"
                                size="sm"
                                sx={{
                                    fontSize: '18px',
                                    paddingX: '10px',
                                    paddingY: '5px',
                                }}
                                onClick={() => {
                                    setOpeningService(1);
                                    setOpenUserProfile(false);
                                }}
                            >
                                <QuestionAnswerRoundedIcon />
                                &nbsp;DM
                            </IconButton>
                            <IconButton
                                component="p"
                                variant="outlined"
                                size="sm"
                                sx={{
                                    fontSize: '18px',
                                    paddingX: '10px',
                                    paddingY: '5px',
                                    ml: 1
                                }}
                                onClick={() => {
                                    console.log("Calling...");
                                    setOpenUserProfile(false);
                                }}
                            >
                                <PhoneInTalkRoundedIcon />
                                &nbsp;Call
                            </IconButton>
                        </Box>
                    </Box>
                </ModalDialog>
            </Modal>
        </>
    );
}
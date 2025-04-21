import { useNavigate } from 'react-router-dom';
import GlobalStyles from '@mui/joy/GlobalStyles';
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import IconButton from '@mui/joy/IconButton';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton, { listItemButtonClasses } from '@mui/joy/ListItemButton';
import Sheet from '@mui/joy/Sheet';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import QuestionAnswerRoundedIcon from '@mui/icons-material/QuestionAnswerRounded';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useAuth } from "../../context/AuthContext";
import TeamDropdown from '../../features/admin/teamDropdown';
import ColorSchemeToggle from './colorSchemeToggle';
import { closeSidebar } from '../../utils';
import { UserProps } from '../../types';

const base_url = import.meta.env.VITE_API_BASE_URL;

type SidebarProps = {
  myself: UserProps;
  setMyself: (me: UserProps) => void;
  setOpeningService: (service: number) => void;
};

export default function Sidebar(props: SidebarProps) {
  const { myself, setMyself, setOpeningService } = props
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch(`${base_url}/user/signout/`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Redirect to home page after successful logout
        localStorage.setItem("isSigningIn", "no");
        localStorage.setItem("userEmail", "");
        localStorage.setItem("userName", "");
        localStorage.setItem("userId", "");
        setAccessToken(null);
        navigate("/");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleMoveToChat = (): void => {
    setOpeningService(1);
  };

  const handleMoveToTask = (): void => {
    setOpeningService(2);
  };


  return (
    <Sheet
      className="Sidebar"
      sx={{
        position: { xs: 'fixed', md: 'sticky' },
        transform: {
          xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))',
          md: 'none',
        },
        transition: 'transform 0.4s, width 0.4s',
        zIndex: 10000,
        height: '100dvh',
        width: 'var(--Sidebar-width)',
        top: 0,
        p: 2,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <GlobalStyles
        styles={(theme) => ({
          ':root': {
            '--Sidebar-width': '65px',
            [theme.breakpoints.up('lg')]: {
              '--Sidebar-width': '65px',
            },
          },
        })}
      />
      <Box
        className="Sidebar-overlay"
        sx={{
          position: 'fixed',
          zIndex: 9998,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          opacity: 'var(--SideNavigation-slideIn)',
          backgroundColor: 'var(--joy-palette-background-backdrop)',
          transition: 'opacity 0.4s',
          transform: {
            xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--Sidebar-width, 0px)))',
            lg: 'translateX(-100%)',
          },
        }}
        onClick={() => closeSidebar()}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
        <TeamDropdown myself={myself} setMyself={setMyself} />
        <ColorSchemeToggle />
      </Box>

      <Box
        sx={{
          minHeight: 0,
          overflow: 'hidden auto',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          [`& .${listItemButtonClasses.root}`]: {
            gap: 1.5,
          },
          alignItems: 'center'
        }}
      >
        <List
          size="sm"
          sx={{
            gap: 0,
            '--List-nestedInsetStart': '30px',
            '--ListItem-radius': (theme) => theme.vars.radius.sm,
          }}
        >
          <ListItem>
            <ListItemButton onClick={handleMoveToChat} title='Chats'>
              <Box sx={{ display: 'flex', alignItems: 'center', p: '5px' }}>
                <QuestionAnswerRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton onClick={handleMoveToTask} title='Tasks'>
              <Box sx={{ display: 'flex', alignItems: 'center', p: '5px' }}>
                <AssignmentRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton onClick={() => { console.log("Open Note") }} title='Notes'>
              <Box sx={{ display: 'flex', alignItems: 'center', p: '5px' }}>
                <NoteAltIcon sx={{ fontSize: 20 }} />
              </Box>
            </ListItemButton>
          </ListItem>
        </List>
        <List
          size="sm"
          sx={{
            mt: 'auto',
            flexGrow: 0,
            '--ListItem-radius': (theme) => theme.vars.radius.sm,
            '--List-gap': '3px',
            mb: 0,
          }}
        >
          <ListItem>
            <ListItemButton title='Settings'>
              <SettingsRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <IconButton
        component='a'
        onClick={handleLogout}
        size="sm"
        variant="plain"
        color="neutral"
        title='Sign out'
      >
        <LogoutRoundedIcon />
      </IconButton>


      <Divider />

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Avatar
          variant="solid"
          size="sm"
        >
          {myself.userName[0]}
        </Avatar>
      </Box>
    </Sheet>
  );
}

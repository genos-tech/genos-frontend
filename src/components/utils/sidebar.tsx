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
import CircleIcon from '@mui/icons-material/Circle';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import BrightnessAutoRoundedIcon from '@mui/icons-material/BrightnessAutoRounded';

import ColorSchemeToggle from './colorSchemeToggle';
import { closeSidebar } from '../../utils';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    navigate("/");
  };

  const handleMoveToChat = (): void => {
    navigate("/App");
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
        <IconButton component='a' variant="soft" color="primary" size="sm">
          <BrightnessAutoRoundedIcon />
        </IconButton>
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
            <ListItemButton onClick={handleMoveToChat}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <QuestionAnswerRoundedIcon sx={{ fontSize: 20 }} />
                <CircleIcon sx={{ fontSize: 7 }} color="primary" />
              </Box>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AssignmentRoundedIcon sx={{ fontSize: 20 }} />
                <CircleIcon sx={{ fontSize: 7 }} color="primary" />
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
            <ListItemButton>
              <SettingsRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
      <IconButton component='a' onClick={handleLogout} size="sm" variant="plain" color="neutral">
        <LogoutRoundedIcon />
      </IconButton>
      <Divider />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Avatar
          variant="outlined"
          size="sm"
          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=286"
        />
      </Box>
    </Sheet>
  );
}

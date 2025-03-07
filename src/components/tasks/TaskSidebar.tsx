import * as React from 'react';
import GlobalStyles from '@mui/joy/GlobalStyles';
import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import Input from '@mui/joy/Input';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton, { listItemButtonClasses } from '@mui/joy/ListItemButton';
import ListItemContent from '@mui/joy/ListItemContent';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import WorkIcon from '@mui/icons-material/Work';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


function Toggler({
  defaultExpanded = false,
  renderToggle,
  children,
}: {
  defaultExpanded?: boolean;
  children: React.ReactNode;
  renderToggle: (params: {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  }) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultExpanded);
  return (
    <React.Fragment>
      {renderToggle({ open, setOpen })}
      <Box
        sx={[
          {
            display: 'grid',
            transition: '0.2s ease',
            '& > *': {
              overflow: 'hidden',
            },
          },
          open ? { gridTemplateRows: '1fr' } : { gridTemplateRows: '0fr' },
        ]}
      >
        {children}
      </Box>
    </React.Fragment>
  );
}

export default function TaskSidebar() {
  return (
    <Sheet
      className="TaskSidebar"
      sx={{
        position: { xs: 'fixed', md: 'sticky' },
        transform: {
          xs: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))',
          md: 'none',
        },
        transition: 'transform 0.4s, width 0.4s',
        zIndex: 10000,
        height: '100dvh',
        width: '100%',
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
            '--TaskSidebar-width': '220px',
            [theme.breakpoints.up('lg')]: {
              '--TaskSidebar-width': '240px',
            },
          },
        })}
      />
      <Input size="sm" startDecorator={<SearchRoundedIcon />} placeholder="Search" />
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
        }}
      >
        <List
          size="sm"
          sx={{
            gap: 1,
            '--List-nestedInsetStart': '30px',
            '--ListItem-radius': (theme) => theme.vars.radius.sm,
          }}
        >
          <ListItem nested>
            <Toggler
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => setOpen(!open)}>
                  <WorkIcon />
                  <ListItemContent>
                    <Typography level="title-sm">Projects</Typography>
                  </ListItemContent>
                  <KeyboardArrowDownIcon
                    sx={[
                      open
                        ? {
                          transform: 'rotate(180deg)',
                        }
                        : {
                          transform: 'none',
                        },
                    ]}
                  />
                </ListItemButton>
              )}
            >
              <List sx={{ gap: 0.5 }}>
                <ListItem sx={{ mt: 0.5 }}>
                  <ListItemButton>Project-X</ListItemButton>
                </ListItem>
                <ListItem>
                  <ListItemButton>Project-Y</ListItemButton>
                </ListItem>
                <ListItem>
                  <ListItemButton>Project-Z</ListItemButton>
                </ListItem>
              </List>
            </Toggler>
          </ListItem>

          <ListItem nested>
            <Toggler
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => setOpen(!open)}>
                  <AssignmentRoundedIcon />
                  <ListItemContent>
                    <Typography level="title-sm">Recent Tasks</Typography>
                  </ListItemContent>
                  <KeyboardArrowDownIcon
                    sx={[
                      open
                        ? {
                          transform: 'rotate(180deg)',
                        }
                        : {
                          transform: 'none',
                        },
                    ]}
                  />
                </ListItemButton>
              )}
            >
              <List sx={{ gap: 0.5 }}>
                <ListItem sx={{ mt: 0.5 }}>
                  <ListItemButton>task-001</ListItemButton>
                </ListItem>
                <ListItem>
                  <ListItemButton>task-002</ListItemButton>
                </ListItem>
                <ListItem>
                  <ListItemButton>task-003</ListItemButton>
                </ListItem>
              </List>
            </Toggler>
          </ListItem>

        </List>
      </Box>
      <Divider />
    </Sheet>
  );
}

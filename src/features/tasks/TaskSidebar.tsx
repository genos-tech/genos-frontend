import * as React from 'react';
import { useState, useEffect } from 'react';
import GlobalStyles from '@mui/joy/GlobalStyles';
import Box from '@mui/joy/Box';
import Divider from '@mui/joy/Divider';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton, { listItemButtonClasses } from '@mui/joy/ListItemButton';
import ListItemContent from '@mui/joy/ListItemContent';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import Autocomplete from '@mui/joy/Autocomplete';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import FreeCancellationIcon from '@mui/icons-material/FreeCancellation';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useAuth } from "../../context/AuthContext";
import { SearchTeamTasksResponse, ProjectProps, UserProps } from '../../types/types'
import loadTaskSearchList from './services/loadTaskSearchList';
import loadTeamProjects from './services/loadTeamProjects';
import CircularProgress from '@mui/joy/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import { loadAllTeams } from '../admin/services/loadAllTeams';
import { Team } from '../../types/admin';

function Toggler({
  defaultExpanded,
  renderToggle,
  children,
}: {
  defaultExpanded: boolean;
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

type TaskSidebarProps = {
  myself: UserProps,
  setMyself: (value: UserProps) => void,
  currentProject: ProjectProps | null,
  setCurrentProject: (value: ProjectProps) => void,
  currentPreviewTaskId: number,
  setCurrentPreviewTaskId: (value: number) => void,
  setOpenCreateTeam: (value: boolean) => void,
  setOpenCreateProject: (value: boolean) => void,
}

export default function TaskSidebar(props: TaskSidebarProps) {
  const { myself,
    setMyself,
    currentProject,
    setCurrentProject,
    currentPreviewTaskId,
    setCurrentPreviewTaskId,
    setOpenCreateTeam,
    setOpenCreateProject
  } = props
  const { accessToken } = useAuth();

  // =======================================================================
  const [openSearch, setOpenSearch] = useState(false);
  const [teamTaskOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);
  const loading = openSearch && teamTaskOptions.length === 0;
  useEffect(() => {
    let active = true;

    if (!loading) {
      return undefined;
    }

    (async () => {
      const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTaskSearchList({
        myself: myself, accessToken: accessToken || ""
      });

      if (active) {
        setTeamTaskOptions([...loadedTeamTasks]);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading]);


  function onChangeHandler(value: any) {
    if (value !== null) {
      setOpenSearch(false);
      setCurrentPreviewTaskId(value.taskId)
    }
  }
  // =======================================================================

  const [recentTasks, setRecentTasks] = useState<SearchTeamTasksResponse[]>([]);
  const updateRecentTasks = () => {
    (async () => {
      const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTaskSearchList({
        myself: myself, accessToken: accessToken || ""
      });
      setRecentTasks([...loadedTeamTasks.slice(0, 10)]);
    })();
  };

  useEffect(() => {
    updateRecentTasks();
  }, [currentPreviewTaskId])

  const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
  const updateTeamProjects = () => {
    (async () => {
      const loadedTeamProjects: ProjectProps[] = await loadTeamProjects({
        myself: myself, accessToken: accessToken || ""
      });
      setTeamProjects([...loadedTeamProjects]);
    })();
  }

  useEffect(() => {
    updateTeamProjects();
  }, [currentProject])

  const [teams, setTeams] = useState<Team[]>([]);
  const loadTeams = () => {
    (async () => {
      const loadedTeams: Team[] = await loadAllTeams(accessToken);
      setTeams(loadedTeams)
    })();
  };

  useEffect(() => {
    loadTeams();
  }, [myself])

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

      {/* ============================================================================ */}

      <Box>
        <Autocomplete
          placeholder={"Search"}
          open={openSearch}
          onOpen={() => {
            setOpenSearch(true);
          }}
          onClose={() => {
            setOpenSearch(false);
          }}
          isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
          getOptionLabel={(option) => `[${option.taskId}] ${option.title}`}
          options={teamTaskOptions}
          loading={loading}
          endDecorator={
            loading ? (
              <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
            ) : null
          }
          slotProps={{
            listbox: {
              sx: {
                zIndex: 10020
              },
            },
          }}
          onChange={(event, value) => onChangeHandler(value)}
          size="sm"
          startDecorator={<SearchRoundedIcon />}
          aria-label="Search"
          groupBy={(option) => option.projectName}
        />
      </Box>

      {/* ============================================================================ */}



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
              defaultExpanded={false}
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => {
                  setOpen(!open);
                  updateRecentTasks();
                }}>
                  <AssignmentRoundedIcon />
                  <ListItemContent>
                    <Typography level="title-sm">Recents</Typography>
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
                {recentTasks.map(({ taskId, title }, index) => {
                  return (
                    <ListItem key={taskId}>
                      <ListItemButton
                        onClick={() => { setCurrentPreviewTaskId(taskId) }}
                        sx={{ overflow: 'hidden' }} // ensure children don't overflow
                      >
                        <Typography
                          noWrap
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%', // take full width of button
                          }}
                        >
                          {`[${taskId}] ${title}`}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Toggler>
          </ListItem>

          <ListItem nested>
            <Toggler
              defaultExpanded={true}
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => {
                  setOpen(!open);
                  updateTeamProjects();
                }}>
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
                <ListItem key={"createProject"}>
                  <ListItemButton
                    color='neutral'
                    variant='soft'
                    onClick={() => { setOpenCreateProject(true) }}
                    sx={{ overflow: 'hidden' }} // ensure children don't overflow
                  >
                    <AddIcon />
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '15px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%', // take full width of button
                      }}
                    >
                      New Project
                    </Typography>
                  </ListItemButton>
                </ListItem>
                {teamProjects.map(({ projectId, projectName }) => {
                  return (
                    <ListItem key={projectId}>
                      <ListItemButton
                        color={'neutral'}
                        variant={(projectId === currentProject?.projectId) ? 'solid' : 'plain'}
                        onClick={() =>
                          setCurrentProject({
                            projectId: projectId,
                            projectName: projectName,
                          })
                        }
                        sx={{ overflow: 'hidden' }} // ensure children don't overflow
                      >
                        <Typography
                          noWrap
                          sx={{
                            color: (projectId === currentProject?.projectId) ? 'white' : 'neutral-500',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%', // take full width of button
                          }}
                        >
                          {projectName}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Toggler>
          </ListItem>


          <ListItem nested>
            <Toggler
              defaultExpanded={false}
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => {
                  setOpen(!open);
                  loadTeams();
                }}
                >
                  <FreeCancellationIcon />
                  <ListItemContent>
                    <Typography level="title-sm">To-Do (TBD)</Typography>
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
                <ListItem key={"createTeam"}>
                  <ListItemButton
                    color='neutral'
                    variant='soft'
                    onClick={() => { }}
                    sx={{ overflow: 'hidden' }} // ensure children don't overflow
                  >
                    <AddIcon />
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '15px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%', // take full width of button
                      }}
                    >
                      New To-Do
                    </Typography>
                  </ListItemButton>
                </ListItem>
              </List>
            </Toggler>
          </ListItem>


          <ListItem nested>
            <Toggler
              defaultExpanded={false}
              renderToggle={({ open, setOpen }) => (
                <ListItemButton onClick={() => {
                  setOpen(!open);
                  loadTeams();
                }}
                >
                  <BusinessIcon />
                  <ListItemContent>
                    <Typography level="title-sm">Teams</Typography>
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
                <ListItem key={"createTeam"}>
                  <ListItemButton
                    color='neutral'
                    variant='soft'
                    onClick={() => { setOpenCreateTeam(true) }}
                    sx={{ overflow: 'hidden' }} // ensure children don't overflow
                  >
                    <AddIcon />
                    <Typography
                      noWrap
                      sx={{
                        fontSize: '15px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%', // take full width of button
                      }}
                    >
                      New Team
                    </Typography>
                  </ListItemButton>
                </ListItem>
                {teams.map(({ teamId, teamName }) => {
                  return (
                    <ListItem key={teamId}>
                      <ListItemButton
                        color={'neutral'}
                        variant={(teamId === myself.teamId) ? 'solid' : 'plain'}
                        onClick={() =>
                          setMyself({ ...myself, teamId: teamId })
                        }
                        sx={{ overflow: 'hidden' }} // ensure children don't overflow
                      >
                        <Typography
                          noWrap
                          sx={{
                            color: (teamId === myself.teamId) ? 'white' : 'neutral-500',
                            borderRadius: 5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%', // take full width of button
                          }}
                        >
                          {teamName}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Toggler>
          </ListItem>

        </List>
      </Box>
      <Divider />
    </Sheet >
  );
}

import { alpha } from "@mui/system";
import { List, ListItem, ListItemContent, Typography, Chip } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectProps } from "../../../../../types/tasks";
import { Toggler } from "../common";

type OngoingsListItemProps = {
    projectId: number;
    currentProject: ProjectProps | null;
    setSelectedTagForFiltering: (value: string) => void;
    setFilterBy: (value: number) => void;
};
export const OngoingsListItem = (props: OngoingsListItemProps) => {
    const { projectId, currentProject, setSelectedTagForFiltering, setFilterBy } = props;
    const { mode } = useColorScheme();

    return (
        <Toggler
            key={`toggler-TeamProjects-tags-${projectId}`}
            defaultExpanded={false}
            renderToggle={({ open, setOpen }) => (
                <ListItemButton
                    onClick={() => {
                        setOpen(!open);
                    }}
                >
                    <ListItemContent>
                        <Typography
                            level="title-sm"
                            sx={{
                                ml: "35px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Ongoings
                        </Typography>
                    </ListItemContent>
                    <KeyboardArrowDownIcon
                        sx={[
                            {
                                mr: "8px",
                            },
                            open
                                ? {
                                      transform: "rotate(180deg)",
                                  }
                                : {
                                      transform: "none",
                                  },
                        ]}
                    />
                </ListItemButton>
            )}
        >
            <List>
                {currentProject?.projectId === projectId &&
                    currentProject !== null &&
                    currentProject.projectTags.map(
                        ({ tagName, tagColor, tagTextColor }, index) => {
                            return (
                                <ListItem key={`listitem-${tagName}-${index}`}>
                                    <ListItemButton
                                        color={"neutral"}
                                        onClick={() => {
                                            setSelectedTagForFiltering(`/${tagName}/`);
                                            setFilterBy(2);
                                        }}
                                        sx={{
                                            overflow: "hidden",
                                        }}
                                    >
                                        <Chip
                                            key={`chip-${tagName}-${index}`}
                                            variant="outlined"
                                            sx={{
                                                color: mode === "dark" ? "white" : "black",
                                                fontWeight: "bold",
                                                borderRadius: "5px",
                                                borderWidth: "3px",
                                                borderColor: alpha(
                                                    tagColor,
                                                    mode === "dark" ? 0.5 : 0.75
                                                ),
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "4px",
                                                ml: "70px",
                                            }}
                                            size="sm"
                                        >
                                            {tagName}
                                        </Chip>
                                    </ListItemButton>
                                </ListItem>
                            );
                        }
                    )}
            </List>
        </Toggler>
    );
};

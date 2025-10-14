import { Autocomplete, Button, Chip, Stack, Typography } from "@mui/joy";
import { useEffect, useState } from "react";

import { useAuth } from "../../../../../context/AuthContext";
import { UserProps } from "../../../../../types/admin";
import { updateUserProfile } from "../../../services/updateUserProfile";

type UserProfileRoleProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    user?: UserProps;
};
export const UserProfileRole = (props: UserProfileRoleProps) => {
    const { myself, setMyself, user } = props;
    const { accessToken } = useAuth();

    const [openRoleEditor, setOpenRoleEditor] = useState(false);
    const [isRoleUpdated, setIsRoleUpdated] = useState(false);
    const [roleValue, setRoleValue] = useState(
        myself.userId !== user?.userId ? "Not Set" : "Set Your Role"
    );
    useEffect(() => {
        if (isRoleUpdated === false && openRoleEditor === false) {
            if (user && user.role && user.role !== "" && user.role !== "undefined") {
                setRoleValue(user.role);
            } else {
                setRoleValue(myself.userId !== user?.userId ? "Not Set" : "Set Your Role");
            }
        }
    }, [user, isRoleUpdated]);

    const [open, setOpen] = useState(true);

    return (
        <>
            {openRoleEditor === true && (
                <Stack direction={"row"} spacing={0.3}>
                    <Autocomplete
                        getOptionLabel={(option) => option.role}
                        groupBy={(option) => option.category}
                        isOptionEqualToValue={(option, value) => option.role === value.role}
                        open={open}
                        options={templateRoleOptions}
                        placeholder="Choose a role"
                        sx={{ width: 300 }}
                        slotProps={{
                            input: {
                                autoComplete: "new-password", // disable autocomplete and autofill
                            },
                            listbox: {
                                sx: {
                                    zIndex: 10001, // Put the autocomplete to the front
                                },
                            },
                        }}
                        autoHighlight
                        onClose={() => setOpen(false)} // this fires on outside click
                        onOpen={() => setOpen(true)}
                        onChange={(event, value) => {
                            if (value) {
                                setOpenRoleEditor(false);
                                setIsRoleUpdated(true);
                                setRoleValue(value.role);
                                updateUserProfile({
                                    accessToken: accessToken,
                                    userId: myself.userId,
                                    role: value.role,
                                });
                                setMyself({
                                    ...myself,
                                    role: value.role,
                                });
                                localStorage.setItem("role", value.role);
                            }
                        }}
                    />
                    <Chip
                        color="danger"
                        size="sm"
                        variant="outlined"
                        sx={{
                            borderRadius: "sm",
                            fontWeight: "bold",
                        }}
                        onClick={() => {
                            setOpenRoleEditor(false);
                        }}
                    >
                        CANCEL
                    </Chip>
                </Stack>
            )}

            {openRoleEditor === false && (
                <Button
                    color="neutral"
                    variant="plain"
                    sx={{
                        width: "400px",
                        justifyContent: "flex-start", // left align the content
                    }}
                    onClick={() => {
                        if (myself.userId === user?.userId) {
                            setOpenRoleEditor(true);
                        }
                    }}
                >
                    <Typography fontWeight="bold">{roleValue}</Typography>
                </Button>
            )}
        </>
    );
};

const templateRoleOptions = [
    { category: "Executive & Leadership", role: "Chief Executive Officer (CEO)" },
    { category: "Executive & Leadership", role: "Chief Operating Officer (COO)" },
    { category: "Executive & Leadership", role: "Chief Financial Officer (CFO)" },
    {
        category: "Executive & Leadership",
        role: "Chief Technology Officer (CTO)",
    },
    { category: "Executive & Leadership", role: "Chief Marketing Officer (CMO)" },
    {
        category: "Executive & Leadership",
        role: "Chief Human Resources Officer (CHRO)",
    },
    { category: "Executive & Leadership", role: "Chief Data Officer (CDO)" },
    { category: "Executive & Leadership", role: "Chief Product Officer (CPO)" },
    { category: "Executive & Leadership", role: "Managing Director" },
    { category: "Executive & Leadership", role: "Board Member" },

    { category: "Technology & Engineering", role: "Software Engineer" },
    { category: "Technology & Engineering", role: "Data Engineer" },
    { category: "Technology & Engineering", role: "Data Scientist" },
    { category: "Technology & Engineering", role: "Machine Learning Engineer" },
    {
        category: "Technology & Engineering",
        role: "Site Reliability Engineer (SRE)",
    },
    { category: "Technology & Engineering", role: "Cloud Architect" },
    { category: "Technology & Engineering", role: "Security Engineer" },
    { category: "Technology & Engineering", role: "DevOps Engineer" },
    { category: "Technology & Engineering", role: "QA Engineer" },
    { category: "Technology & Engineering", role: "Frontend Engineer" },
    { category: "Technology & Engineering", role: "Backend Engineer" },
    { category: "Technology & Engineering", role: "Full-Stack Engineer" },
    { category: "Technology & Engineering", role: "Product Designer" },
    { category: "Technology & Engineering", role: "UX Designer" },
    { category: "Technology & Engineering", role: "IT Support Specialist" },

    { category: "Finance & Accounting", role: "Accountant" },
    { category: "Finance & Accounting", role: "Financial Analyst" },
    { category: "Finance & Accounting", role: "Investment Banker" },
    { category: "Finance & Accounting", role: "Portfolio Manager" },
    { category: "Finance & Accounting", role: "Auditor" },
    { category: "Finance & Accounting", role: "Controller" },
    { category: "Finance & Accounting", role: "Tax Advisor" },
    { category: "Finance & Accounting", role: "Risk Manager" },
    { category: "Finance & Accounting", role: "Actuary" },
    { category: "Finance & Accounting", role: "Treasurer" },
    { category: "Finance & Accounting", role: "Bookkeeper" },

    { category: "Business & Operations", role: "Operations Manager" },
    { category: "Business & Operations", role: "Business Analyst" },
    { category: "Business & Operations", role: "Strategy Consultant" },
    { category: "Business & Operations", role: "Supply Chain Manager" },
    { category: "Business & Operations", role: "Procurement Specialist" },
    { category: "Business & Operations", role: "Project Manager" },
    { category: "Business & Operations", role: "Program Manager" },
    { category: "Business & Operations", role: "Product Manager" },
    { category: "Business & Operations", role: "Business Development Manager" },
    { category: "Business & Operations", role: "Office Manager" },
    { category: "Business & Operations", role: "Customer Success Manager" },

    { category: "Marketing & Sales", role: "Marketing Manager" },
    { category: "Marketing & Sales", role: "Brand Strategist" },
    { category: "Marketing & Sales", role: "Digital Marketing Specialist" },
    { category: "Marketing & Sales", role: "SEO Specialist" },
    { category: "Marketing & Sales", role: "Content Strategist" },
    { category: "Marketing & Sales", role: "Copywriter" },
    { category: "Marketing & Sales", role: "Social Media Manager" },
    { category: "Marketing & Sales", role: "Graphic Designer" },
    { category: "Marketing & Sales", role: "Sales Executive" },
    { category: "Marketing & Sales", role: "Account Manager" },
    { category: "Marketing & Sales", role: "Customer Support Representative" },

    { category: "Human Resources & People", role: "HR Manager" },
    { category: "Human Resources & People", role: "Recruiter" },
    {
        category: "Human Resources & People",
        role: "Talent Acquisition Specialist",
    },
    {
        category: "Human Resources & People",
        role: "Learning & Development Specialist",
    },
    {
        category: "Human Resources & People",
        role: "Compensation & Benefits Analyst",
    },
    { category: "Human Resources & People", role: "HR Business Partner" },
    { category: "Human Resources & People", role: "Employee Relations Manager" },

    { category: "Legal & Compliance", role: "Corporate Lawyer" },
    { category: "Legal & Compliance", role: "Paralegal" },
    { category: "Legal & Compliance", role: "Compliance Officer" },
    { category: "Legal & Compliance", role: "Contract Manager" },
    { category: "Legal & Compliance", role: "Legal Counsel" },
    { category: "Legal & Compliance", role: "Intellectual Property Specialist" },

    { category: "Academia & Research", role: "Professor" },
    { category: "Academia & Research", role: "Lecturer" },
    { category: "Academia & Research", role: "Postdoctoral Researcher" },
    { category: "Academia & Research", role: "Graduate Research Assistant" },
    { category: "Academia & Research", role: "Academic Advisor" },
    { category: "Academia & Research", role: "University Dean" },
    { category: "Academia & Research", role: "Librarian" },
    { category: "Academia & Research", role: "Curriculum Developer" },
    { category: "Academia & Research", role: "Education Policy Analyst" },

    { category: "Healthcare & Life Sciences", role: "Doctor" },
    { category: "Healthcare & Life Sciences", role: "Nurse" },
    { category: "Healthcare & Life Sciences", role: "Pharmacist" },
    {
        category: "Healthcare & Life Sciences",
        role: "Research Scientist (Biotech)",
    },
    { category: "Healthcare & Life Sciences", role: "Clinical Trial Manager" },
    { category: "Healthcare & Life Sciences", role: "Healthcare Administrator" },
    { category: "Healthcare & Life Sciences", role: "Public Health Specialist" },
    { category: "Healthcare & Life Sciences", role: "Medical Lab Technician" },

    { category: "Creative & Media", role: "Journalist" },
    { category: "Creative & Media", role: "Editor" },
    { category: "Creative & Media", role: "Photographer" },
    { category: "Creative & Media", role: "Videographer" },
    { category: "Creative & Media", role: "Film Director" },
    { category: "Creative & Media", role: "Music Producer" },
    { category: "Creative & Media", role: "Animator" },
    { category: "Creative & Media", role: "Game Designer" },
    { category: "Creative & Media", role: "Art Director" },

    { category: "Manufacturing & Industry", role: "Mechanical Engineer" },
    { category: "Manufacturing & Industry", role: "Electrical Engineer" },
    { category: "Manufacturing & Industry", role: "Production Manager" },
    {
        category: "Manufacturing & Industry",
        role: "Quality Assurance Specialist",
    },
    { category: "Manufacturing & Industry", role: "Industrial Designer" },
    { category: "Manufacturing & Industry", role: "Plant Manager" },
    { category: "Manufacturing & Industry", role: "Maintenance Technician" },

    { category: "Nonprofit & Government", role: "Policy Analyst" },
    { category: "Nonprofit & Government", role: "Diplomat" },
    { category: "Nonprofit & Government", role: "NGO Program Manager" },
    { category: "Nonprofit & Government", role: "Fundraising Specialist" },
    { category: "Nonprofit & Government", role: "Social Worker" },
    { category: "Nonprofit & Government", role: "Community Organizer" },
    { category: "Nonprofit & Government", role: "Government Affairs Specialist" },

    { category: "Emerging & Future Roles", role: "AI Ethics Officer" },
    { category: "Emerging & Future Roles", role: "Sustainability Manager" },
    { category: "Emerging & Future Roles", role: "ESG Analyst" },
    {
        category: "Emerging & Future Roles",
        role: "Diversity & Inclusion Manager",
    },
    {
        category: "Emerging & Future Roles",
        role: "Crypto / Blockchain Specialist",
    },
    { category: "Emerging & Future Roles", role: "Robotics Engineer" },
    { category: "Emerging & Future Roles", role: "Climate Risk Consultant" },

    { category: "Other", role: "Student" },
    { category: "Other", role: "Entrepreneur" },
    { category: "Other", role: "Self Employed" },
    { category: "Other", role: "Other" },
];

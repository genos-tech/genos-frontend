import "./styles.css";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Menu } from "@mantine/core";
import { MdCancel, MdCheckCircle, MdError, MdInfo } from "react-icons/md";

import { useTranslation } from "../../../i18n";

// The types of alerts that users can choose from. The `titleKey` is
// resolved against `t.common.editor.alert*` at render time so the labels
// reflect the active locale.
export const alertTypes = [
    {
        titleKey: "alertWarning",
        value: "warning",
        icon: MdError,
        color: "#e69819",
        backgroundColor: {
            light: "#fff6e6",
            dark: "#805d20",
        },
    },
    {
        titleKey: "alertError",
        value: "error",
        icon: MdCancel,
        color: "#d80d0d",
        backgroundColor: {
            light: "#ffe6e6",
            dark: "#802020",
        },
    },
    {
        titleKey: "alertInfo",
        value: "info",
        icon: MdInfo,
        color: "#507aff",
        backgroundColor: {
            light: "#e6ebff",
            dark: "#203380",
        },
    },
    {
        titleKey: "alertSuccess",
        value: "success",
        icon: MdCheckCircle,
        color: "#0bc10b",
        backgroundColor: {
            light: "#e6ffe6",
            dark: "#208020",
        },
    },
] as const;

// The Alert block.
export const Alert = createReactBlockSpec(
    {
        type: "alert",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            textColor: defaultProps.textColor,
            type: {
                default: "warning",
                values: ["warning", "error", "info", "success"],
            },
        },
        content: "inline",
    },
    {
        render: (props) => {
            const alertType = alertTypes.find((a) => a.value === props.block.props.type)!;
            const Icon = alertType.icon;
            const { t } = useTranslation();
            return (
                <div className={"alert"} data-alert-type={props.block.props.type}>
                    {/*Icon which opens a menu to choose the Alert type*/}
                    <Menu withinPortal={false}>
                        <Menu.Target>
                            <div className={"alert-icon-wrapper"} contentEditable={false}>
                                <Icon
                                    className={"alert-icon"}
                                    data-alert-icon-type={props.block.props.type}
                                    size={32}
                                />
                            </div>
                        </Menu.Target>
                        {/*Dropdown to change the Alert type*/}
                        <Menu.Dropdown>
                            <Menu.Label>{t.common.editor.alertType}</Menu.Label>
                            <Menu.Divider />
                            {alertTypes.map((type) => {
                                const ItemIcon = type.icon;

                                return (
                                    <Menu.Item
                                        key={type.value}
                                        leftSection={
                                            <ItemIcon
                                                className={"alert-icon"}
                                                data-alert-icon-type={type.value}
                                            />
                                        }
                                        onClick={() =>
                                            props.editor.updateBlock(props.block, {
                                                type: "alert",
                                                props: { type: type.value },
                                            })
                                        }
                                    >
                                        {t.common.editor[type.titleKey]}
                                    </Menu.Item>
                                );
                            })}
                        </Menu.Dropdown>
                    </Menu>
                    {/*Rich text field for user to type in*/}
                    <div ref={props.contentRef} className={"inline-content"} />
                </div>
            );
        },
    }
);

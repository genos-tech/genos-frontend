import "./styles.css";

import { createReactBlockSpec } from "@blocknote/react";
import { Menu } from "@mantine/core";

import { useTranslation } from "../../../i18n";
import { ALERT_SPEC_CONFIG } from "../schemaSpecConfigs";
import { alertTypes } from "./alertTypes";

// The Alert block.
export const Alert = createReactBlockSpec(ALERT_SPEC_CONFIG, {
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
});

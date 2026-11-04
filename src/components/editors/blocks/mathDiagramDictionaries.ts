/*
 * The strings of the math and diagram blocks, in the languages of the app (ar, en, es, fr,
 * ja, zh; Hindi falls back to English like BlockNote's own dictionary).
 *
 * Copied from `@blocknote/math-block` and `@blocknote/diagram-block` 0.57.0
 * (https://github.com/TypeCellOS/BlockNote, MPL-2.0, Copyright (c) the BlockNote
 * contributors), `src/i18n/locales/*.ts`, without their exporter messages. This file is
 * covered by MPL-2.0 as well. They are kept under the same keys the packages use
 * (`dictionary.math`, `dictionary.diagram`), so `useBlockNoteDictionary` hands them to the
 * editor the way the packages expect, and a later swap back to the packages needs no change
 * there. `blocks/parity.test.ts` pins the English copy against the installed packages.
 */
export const mathDictionaries = {
    ar: {
        block: {
            add_source_text: "إضافة معادلة LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "معادلة غير صالحة (انقر للتعديل)",
        },
        inline: {
            add_source_text: "إضافة معادلة LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "معادلة غير صالحة (انقر للتعديل)",
        },
        slash_menu: {
            math_block: {
                title: "معادلة مستقلة",
                subtext: "كتلة معادلة رياضية مستقلة",
                aliases: ["رياضيات", "معادلة", "صيغة", "latex"],
                group: "متقدم",
            },
            inline_math: {
                title: "معادلة ضمن السطر",
                subtext: "رموز رياضية داخل النص",
                aliases: ["رياضيات", "معادلة", "صيغة", "latex"],
                group: "متقدم",
            },
        },
        block_type_select: {
            name: "معادلة",
        },
    },
    en: {
        block: {
            add_source_text: "Add a LaTeX equation",
            input_placeholder: "E = mc^2",
            preview_error_text: "Invalid equation (click to edit)",
        },
        inline: {
            add_source_text: "Add a LaTeX equation",
            input_placeholder: "E = mc^2",
            preview_error_text: "Invalid equation (click to edit)",
        },
        slash_menu: {
            math_block: {
                title: "Block Equation",
                subtext: "Standalone math equation block",
                aliases: ["math", "latex", "formula", "equation"],
                group: "Advanced",
            },
            inline_math: {
                title: "Inline Equation",
                subtext: "Math symbols in text",
                aliases: ["math", "latex", "formula", "equation"],
                group: "Advanced",
            },
        },
        block_type_select: {
            name: "Equation",
        },
    },
    es: {
        block: {
            add_source_text: "Agregar ecuación LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "Ecuación no válida (haz clic para editar)",
        },
        inline: {
            add_source_text: "Agregar ecuación LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "Ecuación no válida (haz clic para editar)",
        },
        slash_menu: {
            math_block: {
                title: "Bloque de Ecuación",
                subtext: "Bloque de ecuación matemática independiente",
                aliases: ["matemáticas", "latex", "fórmula", "ecuación"],
                group: "Avanzado",
            },
            inline_math: {
                title: "Ecuación en línea",
                subtext: "Símbolos matemáticos en el texto",
                aliases: ["matemáticas", "latex", "fórmula", "ecuación"],
                group: "Avanzado",
            },
        },
        block_type_select: {
            name: "Ecuación",
        },
    },
    fr: {
        block: {
            add_source_text: "Ajouter une équation LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "Équation non valide (cliquez pour modifier)",
        },
        inline: {
            add_source_text: "Ajouter une équation LaTeX",
            input_placeholder: "E = mc^2",
            preview_error_text: "Équation non valide (cliquez pour modifier)",
        },
        slash_menu: {
            math_block: {
                title: "Bloc d'équation",
                subtext: "Bloc d'équation mathématique autonome",
                aliases: ["maths", "latex", "formule", "équation"],
                group: "Avancé",
            },
            inline_math: {
                title: "Équation en ligne",
                subtext: "Symboles mathématiques dans le texte",
                aliases: ["maths", "latex", "formule", "équation"],
                group: "Avancé",
            },
        },
        block_type_select: {
            name: "Équation",
        },
    },
    ja: {
        block: {
            add_source_text: "LaTeX数式を追加",
            input_placeholder: "E = mc^2",
            preview_error_text: "無効な数式（クリックして編集）",
        },
        inline: {
            add_source_text: "LaTeX数式を追加",
            input_placeholder: "E = mc^2",
            preview_error_text: "無効な数式（クリックして編集）",
        },
        slash_menu: {
            math_block: {
                title: "数式ブロック",
                subtext: "独立した数式ブロック",
                aliases: ["数式", "すうしき", "math", "latex"],
                group: "高度なブロック",
            },
            inline_math: {
                title: "インライン数式",
                subtext: "テキスト内の数学記号",
                aliases: ["数式", "すうしき", "math", "latex"],
                group: "高度なブロック",
            },
        },
        block_type_select: {
            name: "数式",
        },
    },
    zh: {
        block: {
            add_source_text: "添加 LaTeX 公式",
            input_placeholder: "E = mc^2",
            preview_error_text: "无效的公式（点击编辑）",
        },
        inline: {
            add_source_text: "添加 LaTeX 公式",
            input_placeholder: "E = mc^2",
            preview_error_text: "无效的公式（点击编辑）",
        },
        slash_menu: {
            math_block: {
                title: "块级公式",
                subtext: "独立的数学公式块",
                aliases: ["数学", "公式", "方程", "latex"],
                group: "高级功能",
            },
            inline_math: {
                title: "行内公式",
                subtext: "文本中的数学符号",
                aliases: ["数学", "公式", "方程", "latex"],
                group: "高级功能",
            },
        },
        block_type_select: {
            name: "公式",
        },
    },
} as const;

export const diagramDictionaries = {
    ar: {
        block: {
            add_source_text: "إضافة مخطط Mermaid",
            input_placeholder: "أدخل كود المخطط",
            preview_error_text: "مخطط غير صالح (انقر للتعديل)",
            preview_label: "مخطط Mermaid",
        },
        slash_menu: {
            diagram: {
                title: "مخطط",
                subtext: "مخطط مرسوم من مصدر Mermaid",
                aliases: ["مخطط", "رسم بياني", "مخطط انسيابي", "mermaid", "flowchart"],
                group: "متقدم",
            },
        },
        block_type_select: {
            name: "مخطط",
        },
    },
    en: {
        block: {
            add_source_text: "Add a Mermaid diagram",
            input_placeholder: "Enter diagram code",
            preview_error_text: "Invalid diagram (click to edit)",
            preview_label: "Mermaid diagram",
        },
        slash_menu: {
            diagram: {
                title: "Diagram",
                subtext: "Diagram rendered from Mermaid source",
                aliases: ["mermaid", "diagram", "flowchart", "chart", "graph"],
                group: "Advanced",
            },
        },
        block_type_select: {
            name: "Diagram",
        },
    },
    es: {
        block: {
            add_source_text: "Agregar diagrama Mermaid",
            input_placeholder: "Introduce el código del diagrama",
            preview_error_text: "Diagrama no válido (haz clic para editar)",
            preview_label: "Diagrama Mermaid",
        },
        slash_menu: {
            diagram: {
                title: "Diagrama",
                subtext: "Diagrama renderizado a partir de código Mermaid",
                aliases: ["mermaid", "diagrama", "diagrama de flujo", "gráfico"],
                group: "Avanzado",
            },
        },
        block_type_select: {
            name: "Diagrama",
        },
    },
    fr: {
        block: {
            add_source_text: "Ajouter un diagramme Mermaid",
            input_placeholder: "Saisir le code du diagramme",
            preview_error_text: "Diagramme non valide (cliquez pour modifier)",
            preview_label: "Diagramme Mermaid",
        },
        slash_menu: {
            diagram: {
                title: "Diagramme",
                subtext: "Diagramme généré à partir du code Mermaid",
                aliases: ["mermaid", "diagramme", "organigramme", "graphique"],
                group: "Avancé",
            },
        },
        block_type_select: {
            name: "Diagramme",
        },
    },
    ja: {
        block: {
            add_source_text: "Mermaidダイアグラムを追加",
            input_placeholder: "ダイアグラムのコードを入力",
            preview_error_text: "無効なダイアグラム（クリックして編集）",
            preview_label: "Mermaidダイアグラム",
        },
        slash_menu: {
            diagram: {
                title: "ダイアグラム",
                subtext: "Mermaidソースから描画されるダイアグラム",
                aliases: ["ダイアグラム", "図", "フローチャート", "mermaid"],
                group: "高度なブロック",
            },
        },
        block_type_select: {
            name: "ダイアグラム",
        },
    },
    zh: {
        block: {
            add_source_text: "添加 Mermaid 图表",
            input_placeholder: "输入图表代码",
            preview_error_text: "无效的图表（点击编辑）",
            preview_label: "Mermaid 图表",
        },
        slash_menu: {
            diagram: {
                title: "图表",
                subtext: "由 Mermaid 源码渲染的图表",
                aliases: ["mermaid", "图表", "流程图", "示意图"],
                group: "高级功能",
            },
        },
        block_type_select: {
            name: "图表",
        },
    },
} as const;

export type MathDictionary = (typeof mathDictionaries)["en"];
export type DiagramDictionary = (typeof diagramDictionaries)["en"];

type WithBlockDictionaries = { math?: MathDictionary; diagram?: DiagramDictionary };

/** The math strings of an editor: its dictionary's `math` entry, or English. */
export const getMathDictionary = (editor: { dictionary: unknown }): MathDictionary =>
    (editor.dictionary as WithBlockDictionaries).math ?? mathDictionaries.en;

/** The diagram strings of an editor: its dictionary's `diagram` entry, or English. */
export const getDiagramDictionary = (editor: { dictionary: unknown }): DiagramDictionary =>
    (editor.dictionary as WithBlockDictionaries).diagram ?? diagramDictionaries.en;

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard  = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// ── Niveles de rating ─────────────────────────────────────────────────────────
export class RatingLevelsCard extends FormattingSettingsCard {
    levels = new formattingSettings.TextInput({
        name:        "levels",
        displayName: "Niveles (orden descendente, separados por coma)",
        value:       "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-,BB+,BB,BB-,B+,B,B-",
        placeholder: "AAA,AA+,AA,AA-,A+,A,A-,BBB+,BBB,BBB-"
    });

    name        = "ratingLevels";
    displayName = "Niveles de Rating (eje Y)";
    slices      = [this.levels];

    /** Devuelve el array de niveles en orden descendente (índice 0 = mejor) */
    public getLevelsArray(): string[] {
        const raw = (this.levels.value as string) ?? "";
        return raw.split(",").map(s => s.trim()).filter(s => s.length > 0);
    }
}

// ── Grupos del eje Y ──────────────────────────────────────────────────────────
export class RatingGroupsCard extends FormattingSettingsCard {
    group1Name   = new formattingSettings.TextInput({ name: "group1Name",   displayName: "Grupo 1 — Nombre",   value: "Calidad superior", placeholder: "Calidad superior" });
    group1Levels = new formattingSettings.TextInput({ name: "group1Levels", displayName: "Grupo 1 — Niveles",  value: "AAA,AA+,AA,AA-",   placeholder: "AAA,AA+,AA,AA-" });
    group2Name   = new formattingSettings.TextInput({ name: "group2Name",   displayName: "Grupo 2 — Nombre",   value: "Calidad buena", placeholder: "Calidad buena" });
    group2Levels = new formattingSettings.TextInput({ name: "group2Levels", displayName: "Grupo 2 — Niveles",  value: "A+,A,A-",          placeholder: "A+,A,A-" });
    group3Name   = new formattingSettings.TextInput({ name: "group3Name",   displayName: "Grupo 3 — Nombre",   value: "Calidad aceptable", placeholder: "Calidad aceptable" });
    group3Levels = new formattingSettings.TextInput({ name: "group3Levels", displayName: "Grupo 3 — Niveles",  value: "BBB+,BBB,BBB-",    placeholder: "BBB+,BBB,BBB-" });
    group4Name   = new formattingSettings.TextInput({ name: "group4Name",   displayName: "Grupo 4 — Nombre",   value: "Bono Basura", placeholder: "Bono Basura" });
    group4Levels = new formattingSettings.TextInput({ name: "group4Levels", displayName: "Grupo 4 — Niveles",  value: "BB+,BB,BB-,B+,B,B-", placeholder: "BB+,BB,BB-..." });
    group5Name   = new formattingSettings.TextInput({ name: "group5Name",   displayName: "Grupo 1 — Nombre",   value: "", placeholder: "" });
    group5Levels = new formattingSettings.TextInput({ name: "group5Levels", displayName: "Grupo 1 — Niveles",  value: "", placeholder: "" });

    showGroupLabels     = new formattingSettings.ToggleSwitch({ name: "showGroupLabels",     displayName: "Mostrar etiquetas de grupo",      value: true  });
    showGroupSeparators = new formattingSettings.ToggleSwitch({ name: "showGroupSeparators", displayName: "Mostrar líneas de separación",    value: true  });

    name        = "ratingGroups";
    displayName = "Grupos del eje Y";
    slices      = [
        this.group1Name, this.group1Levels,
        this.group2Name, this.group2Levels,
        this.group3Name, this.group3Levels,
        this.group4Name, this.group4Levels,
        this.group5Name, this.group5Levels,
        this.showGroupLabels, this.showGroupSeparators
    ];

    /** Devuelve los grupos activos con sus niveles como arrays */
    public getGroups(): { name: string; levels: string[] }[] {
        const raw = [
            { name: this.group1Name.value as string, levels: this.group1Levels.value as string },
            { name: this.group2Name.value as string, levels: this.group2Levels.value as string },
            { name: this.group3Name.value as string, levels: this.group3Levels.value as string },
            { name: this.group4Name.value as string, levels: this.group4Levels.value as string },
            { name: this.group5Name.value as string, levels: this.group5Levels.value as string },
        ];
        return raw
            .filter(g => g.name && g.name.trim() !== "" && g.levels && g.levels.trim() !== "")
            .map(g => ({
                name:   g.name.trim(),
                levels: g.levels.split(",").map(s => s.trim()).filter(s => s.length > 0)
            }));
    }
}

// ── Series ────────────────────────────────────────────────────────────────────
export class SeriesSettingsCard extends FormattingSettingsCard {
    lineWidth  = new formattingSettings.NumUpDown({
        name: "lineWidth", displayName: "Grosor de línea (px)", value: 3,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 } }
    });
    showDots   = new formattingSettings.ToggleSwitch({ name: "showDots",   displayName: "Mostrar puntos (vértices)",       value: true });
    dotRadius  = new formattingSettings.NumUpDown({
        name: "dotRadius", displayName: "Radio de nodos", value: 4,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 } }
    });
    showLegend = new formattingSettings.ToggleSwitch({ name: "showLegend", displayName: "Mostrar leyenda",      value: true });
    legendPosition = new formattingSettings.ItemDropdown({
        name:        "legendPosition",
        displayName: "Posición de leyenda",
        value:       { value: "bottom", displayName: "Abajo" },
        items: [
            { value: "bottom", displayName: "Abajo"   },
            { value: "top",    displayName: "Arriba"  },
            { value: "right",  displayName: "Derecha" }
        ]
    });

    name        = "seriesSettings";
    displayName = "Series";
    slices      = [this.lineWidth, this.showDots, this.dotRadius, this.showLegend, this.legendPosition];
}

// ── Colores de Serie Dinámicos ────────────────────────────────────────────────
export class SeriesColorsCard extends FormattingSettingsCard {
    color1  = new formattingSettings.ColorPicker({ name: "color1",  displayName: "Agencia 1",  value: { value: "" } });
    color2  = new formattingSettings.ColorPicker({ name: "color2",  displayName: "Agencia 2",  value: { value: "" } });
    color3  = new formattingSettings.ColorPicker({ name: "color3",  displayName: "Agencia 3",  value: { value: "" } });
    color4  = new formattingSettings.ColorPicker({ name: "color4",  displayName: "Agencia 4",  value: { value: "" } });
    color5  = new formattingSettings.ColorPicker({ name: "color5",  displayName: "Agencia 5",  value: { value: "" } });
    color6  = new formattingSettings.ColorPicker({ name: "color6",  displayName: "Agencia 6",  value: { value: "" } });
    color7  = new formattingSettings.ColorPicker({ name: "color7",  displayName: "Agencia 7",  value: { value: "" } });
    color8  = new formattingSettings.ColorPicker({ name: "color8",  displayName: "Agencia 8",  value: { value: "" } });
    color9  = new formattingSettings.ColorPicker({ name: "color9",  displayName: "Agencia 9",  value: { value: "" } });
    color10 = new formattingSettings.ColorPicker({ name: "color10", displayName: "Agencia 10", value: { value: "" } });

    name        = "seriesColors";
    displayName = "Colores de Agencias";
    slices      = [this.color1, this.color2, this.color3, this.color4, this.color5, this.color6, this.color7, this.color8, this.color9, this.color10];
}

// ── Eje X ─────────────────────────────────────────────────────────────────────
export class AxisSettingsCard extends FormattingSettingsCard {
    dateFormat = new formattingSettings.ItemDropdown({
        name:        "dateFormat",
        displayName: "Formato de fecha",
        value:       { value: "dd/mm/yyyy", displayName: "dd/mm/yyyy" },
        items: [
            { value: "dd/mm/yyyy", displayName: "dd/mm/yyyy" },
            { value: "mm/yyyy",    displayName: "mm/yyyy"    },
            { value: "yyyy",       displayName: "Solo año"   }
        ]
    });
    fontSize  = new formattingSettings.NumUpDown({ name: "fontSize",  displayName: "Tamaño fuente", value: 10 });
    fontColor = new formattingSettings.ColorPicker({ name: "fontColor", displayName: "Color fuente", value: { value: "#555555" } });
    maxTicks  = new formattingSettings.NumUpDown({
        name: "maxTicks", displayName: "Máx. etiquetas", value: 12,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 2 } }
    });

    name        = "axisSettings";
    displayName = "Eje X";
    slices      = [this.dateFormat, this.fontSize, this.fontColor, this.maxTicks];
}

// ── Eje Y ─────────────────────────────────────────────────────────────────────
export class YAxisSettingsCard extends FormattingSettingsCard {
    fontSize       = new formattingSettings.NumUpDown({ name: "fontSize",       displayName: "Tamaño fuente niveles", value: 10 });
    fontColor      = new formattingSettings.ColorPicker({ name: "fontColor",    displayName: "Color fuente principal",  value: { value: "#000000" } });
    secondaryFontColor = new formattingSettings.ColorPicker({ name: "secondaryFontColor", displayName: "Color fuente (paréntesis)", value: { value: "#005bb5" } });
    groupFontSize  = new formattingSettings.NumUpDown({ name: "groupFontSize",  displayName: "Tamaño fuente grupos",  value: 10 });
    groupFontColor = new formattingSettings.ColorPicker({ name: "groupFontColor", displayName: "Color fuente grupos", value: { value: "#888888" } });
    showDottedLines = new formattingSettings.ToggleSwitch({ name: "showDottedLines", displayName: "Líneas punteadas por nivel", value: true });

    name        = "yAxisSettings";
    displayName = "Eje Y";
    slices      = [this.fontSize, this.fontColor, this.secondaryFontColor, this.groupFontSize, this.groupFontColor, this.showDottedLines];
}

// ── Modelo principal ──────────────────────────────────────────────────────────
export class VisualSettings extends FormattingSettingsModel {
    ratingLevels = new RatingLevelsCard();
    ratingGroups = new RatingGroupsCard();
    series       = new SeriesSettingsCard();
    seriesColors = new SeriesColorsCard();
    xAxis        = new AxisSettingsCard();
    yAxis        = new YAxisSettingsCard();

    cards = [this.ratingLevels, this.ratingGroups, this.series, this.seriesColors, this.xAxis, this.yAxis];
}
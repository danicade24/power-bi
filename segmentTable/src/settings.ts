import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class ScaleSettingsCard extends FormattingSettingsCard {
    minValue = new formattingSettings.NumUpDown({ name: "minValue", displayName: "Valor mínimo (Inicio de gráfica)", value: null as any });
    maxValue = new formattingSettings.NumUpDown({ name: "maxValue", displayName: "Valor máximo (Fin de gráfica)", value: null as any });
    unit = new formattingSettings.TextInput({ name: "unit", displayName: "Unidad", value: "", placeholder: "e.g. %" });

    name = "scaleSettings";
    displayName = "Límites y Escala";
    slices = [this.minValue, this.maxValue, this.unit];
}

export class OrderSettingsCard extends FormattingSettingsCard {
    ascending    = new formattingSettings.ToggleSwitch({ name: "ascending",    displayName: "Colores Ascendentes",                 value: true  });
    invertColors = new formattingSettings.ToggleSwitch({ name: "invertColors", displayName: "Invertir Solo Colores (Alternativo)", value: false });

    name = "orderSettings";
    displayName = "Orden de Segmentos";
    slices = [this.ascending, this.invertColors];
}

export class ThresholdsCard extends FormattingSettingsCard {
    numThresholds = new formattingSettings.NumUpDown({
        name: "numThresholds",
        displayName: "¿Cuántos umbrales manuales quieres?",
        value: 0,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });
    t1  = new formattingSettings.NumUpDown({ name: "t1",  displayName: "Umbral 1",  value: null as any });
    t2  = new formattingSettings.NumUpDown({ name: "t2",  displayName: "Umbral 2",  value: null as any });
    t3  = new formattingSettings.NumUpDown({ name: "t3",  displayName: "Umbral 3",  value: null as any });
    t4  = new formattingSettings.NumUpDown({ name: "t4",  displayName: "Umbral 4",  value: null as any });
    t5  = new formattingSettings.NumUpDown({ name: "t5",  displayName: "Umbral 5",  value: null as any });
    t6  = new formattingSettings.NumUpDown({ name: "t6",  displayName: "Umbral 6",  value: null as any });
    t7  = new formattingSettings.NumUpDown({ name: "t7",  displayName: "Umbral 7",  value: null as any });
    t8  = new formattingSettings.NumUpDown({ name: "t8",  displayName: "Umbral 8",  value: null as any });
    t9  = new formattingSettings.NumUpDown({ name: "t9",  displayName: "Umbral 9",  value: null as any });
    t10 = new formattingSettings.NumUpDown({ name: "t10", displayName: "Umbral 10", value: null as any });
    t11 = new formattingSettings.NumUpDown({ name: "t11", displayName: "Umbral 11", value: null as any });
    t12 = new formattingSettings.NumUpDown({ name: "t12", displayName: "Umbral 12", value: null as any });
    t13 = new formattingSettings.NumUpDown({ name: "t13", displayName: "Umbral 13", value: null as any });
    t14 = new formattingSettings.NumUpDown({ name: "t14", displayName: "Umbral 14", value: null as any });
    t15 = new formattingSettings.NumUpDown({ name: "t15", displayName: "Umbral 15", value: null as any });
    t16 = new formattingSettings.NumUpDown({ name: "t16", displayName: "Umbral 16", value: null as any });
    t17 = new formattingSettings.NumUpDown({ name: "t17", displayName: "Umbral 17", value: null as any });
    t18 = new formattingSettings.NumUpDown({ name: "t18", displayName: "Umbral 18", value: null as any });
    t19 = new formattingSettings.NumUpDown({ name: "t19", displayName: "Umbral 19", value: null as any });
    t20 = new formattingSettings.NumUpDown({ name: "t20", displayName: "Umbral 20", value: null as any });

    name = "thresholdsSettings";
    displayName = "Configurar Umbrales Manuales";
    slices = [this.numThresholds, this.t1, this.t2, this.t3, this.t4, this.t5, this.t6, this.t7, this.t8, this.t9, this.t10, this.t11, this.t12, this.t13, this.t14, this.t15, this.t16, this.t17, this.t18, this.t19, this.t20];

    public updateVisibleSlices(hasDynamic: boolean) {
        const count = Math.max(0, Math.min(20, this.numThresholds.value ?? 0));
        const allThresholds = [this.t1, this.t2, this.t3, this.t4, this.t5, this.t6, this.t7, this.t8, this.t9, this.t10, this.t11, this.t12, this.t13, this.t14, this.t15, this.t16, this.t17, this.t18, this.t19, this.t20];
        this.slices = [this.numThresholds, ...allThresholds.slice(0, count)];
    }

    public getActiveThresholdsOrNulls(): (number | null)[] {
        const count = Math.max(0, Math.min(20, this.numThresholds.value ?? 0));
        const allThresholds = [this.t1, this.t2, this.t3, this.t4, this.t5, this.t6, this.t7, this.t8, this.t9, this.t10, this.t11, this.t12, this.t13, this.t14, this.t15, this.t16, this.t17, this.t18, this.t19, this.t20];
        return allThresholds
            .slice(0, count)
            .map(t => typeof t.value === 'number' ? t.value : null);
    }
}

export class TargetSettingsCard extends FormattingSettingsCard {
    show  = new formattingSettings.ToggleSwitch({ name: "show",  displayName: "Mostrar",       value: true });
    color = new formattingSettings.ColorPicker(  { name: "color", displayName: "Color de línea", value: { value: "#ffffff" } });
    width = new formattingSettings.NumUpDown({
        name: "width", displayName: "Grosor (px)", value: 2,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 } }
    });

    name = "targetSettings";
    displayName = "Marcador de Meta (Target)";
    slices = [this.show, this.color, this.width];
}

export class MarkerSettingsCard extends FormattingSettingsCard {
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#1a1a1a" } });
    width = new formattingSettings.NumUpDown({
        name: "width", displayName: "Alto total del marcador", value: 16,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 } }
    });
    thickness = new formattingSettings.NumUpDown({
        name: "thickness", displayName: "Ancho (grosor) del marcador", value: 3,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 } }
    });
    overrideValue = new formattingSettings.NumUpDown({ name: "overrideValue", displayName: "Valor en eje X (Manual)", value: null as any });
    showLabel     = new formattingSettings.ToggleSwitch({ name: "showLabel", displayName: "Mostrar etiqueta", value: false });

    name = "markerSettings";
    displayName = "Marcador";
    slices = [this.color, this.width, this.thickness, this.overrideValue, this.showLabel];
}

export class BarSettingsCard extends FormattingSettingsCard {
    height             = new formattingSettings.NumUpDown({ name: "height",       displayName: "Alto de barra",          value: 10 });
    borderRadius       = new formattingSettings.NumUpDown({ name: "borderRadius", displayName: "Esquinas redondeadas",   value: 4  });
    showThresholdTicks = new formattingSettings.ToggleSwitch({ name: "showThresholdTicks", displayName: "Mostrar marcas (ticks)", value: false });
    showLegend         = new formattingSettings.ToggleSwitch({ name: "showLegend",     displayName: "Mostrar leyenda",                  value: false });
    showLegendSigns    = new formattingSettings.ToggleSwitch({ name: "showLegendSigns", displayName: "Mostrar signos en leyenda (≥ / <)", value: true  });
    rowSpacing         = new formattingSettings.NumUpDown({
        name: "rowSpacing", displayName: "Espaciado entre filas (px)", value: 0,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 } }
    });

    name = "barSettings";
    displayName = "Configuración de Barra";
    slices = [this.height, this.borderRadius, this.showThresholdTicks, this.showLegend, this.showLegendSigns, this.rowSpacing];
}

export class LabelSettingsCard extends FormattingSettingsCard {
    fontSize          = new formattingSettings.NumUpDown({ name: "fontSize",    displayName: "Tamaño fuente general", value: 12 });
    fontColor         = new formattingSettings.ColorPicker({ name: "fontColor", displayName: "Color fuente general",  value: { value: "#333333" } });
    showIndicatorName = new formattingSettings.ToggleSwitch({ name: "showIndicatorName", displayName: "Mostrar nombre", value: false });
    labelColWidth     = new formattingSettings.NumUpDown({
        name: "labelColWidth", displayName: "Ancho columna Etiqueta (%)", value: 25,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 5  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 50 }
        }
    });
    valueColWidth     = new formattingSettings.NumUpDown({
        name: "valueColWidth", displayName: "Ancho columna Valor (%)", value: 12,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 5  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 40 }
        }
    });

    name = "labelSettings";
    displayName = "Etiquetas Generales";
    slices = [this.fontSize, this.fontColor, this.showIndicatorName, this.labelColWidth, this.valueColWidth];
}

// ── Cabecera de Grupo ──────────────────────────────────────────────────────────
export class GroupHeaderCard extends FormattingSettingsCard {
    bgColor = new formattingSettings.ColorPicker({
        name: "bgColor", displayName: "Color de fondo", value: { value: "#eef1f6" }
    });
    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor", displayName: "Color de texto", value: { value: "#2c4a72" }
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Tamaño de fuente (px)", value: 11,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });
    headerHeight = new formattingSettings.NumUpDown({
        name: "headerHeight", displayName: "Alto de cabecera (px)", value: 26,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 16 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 50 }
        }
    });

    name = "groupHeaderSettings";
    displayName = "Cabecera de Grupo";
    slices = [this.bgColor, this.fontColor, this.fontSize, this.headerHeight];
}

export class KpiPanelCard extends FormattingSettingsCard {
    valueFontSize = new formattingSettings.NumUpDown({
        name: "valueFontSize", displayName: "Tamaño valor (px)", value: 16,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 6  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 96 }
        }
    });
    labelFontSize = new formattingSettings.NumUpDown({
        name: "labelFontSize", displayName: "Tamaño etiqueta 'Objetivo' (px)", value: 10,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 6  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 48 }
        }
    });
    valueColor = new formattingSettings.ColorPicker({ name: "valueColor", displayName: "Color del valor",              value: { value: "#1a1a1a" } });
    labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Color de la etiqueta 'Objetivo'", value: { value: "#777777" } });
    fontFamily = new formattingSettings.FontPicker(  { name: "fontFamily", displayName: "Fuente (font-family)",          value: "Segoe UI" });
    bold   = new formattingSettings.ToggleSwitch({ name: "bold",   displayName: "Negrita", value: false });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Cursiva", value: false });

    name = "kpiPanelSettings";
    displayName = "Panel KPI (valor formateado)";
    slices = [this.valueFontSize, this.labelFontSize, this.valueColor, this.labelColor, this.fontFamily, this.bold, this.italic];
}

export class SegmentColorsCard extends FormattingSettingsCard {
    numColors = new formattingSettings.NumUpDown({
        name: "numColors", displayName: "Cantidad de colores manuales", value: 0,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0  },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });
    c1  = new formattingSettings.ColorPicker({ name: "c1",  displayName: "Color 1",  value: { value: "" } });
    c2  = new formattingSettings.ColorPicker({ name: "c2",  displayName: "Color 2",  value: { value: "" } });
    c3  = new formattingSettings.ColorPicker({ name: "c3",  displayName: "Color 3",  value: { value: "" } });
    c4  = new formattingSettings.ColorPicker({ name: "c4",  displayName: "Color 4",  value: { value: "" } });
    c5  = new formattingSettings.ColorPicker({ name: "c5",  displayName: "Color 5",  value: { value: "" } });
    c6  = new formattingSettings.ColorPicker({ name: "c6",  displayName: "Color 6",  value: { value: "" } });
    c7  = new formattingSettings.ColorPicker({ name: "c7",  displayName: "Color 7",  value: { value: "" } });
    c8  = new formattingSettings.ColorPicker({ name: "c8",  displayName: "Color 8",  value: { value: "" } });
    c9  = new formattingSettings.ColorPicker({ name: "c9",  displayName: "Color 9",  value: { value: "" } });
    c10 = new formattingSettings.ColorPicker({ name: "c10", displayName: "Color 10", value: { value: "" } });
    c11 = new formattingSettings.ColorPicker({ name: "c11", displayName: "Color 11", value: { value: "" } });
    c12 = new formattingSettings.ColorPicker({ name: "c12", displayName: "Color 12", value: { value: "" } });
    c13 = new formattingSettings.ColorPicker({ name: "c13", displayName: "Color 13", value: { value: "" } });
    c14 = new formattingSettings.ColorPicker({ name: "c14", displayName: "Color 14", value: { value: "" } });
    c15 = new formattingSettings.ColorPicker({ name: "c15", displayName: "Color 15", value: { value: "" } });
    c16 = new formattingSettings.ColorPicker({ name: "c16", displayName: "Color 16", value: { value: "" } });
    c17 = new formattingSettings.ColorPicker({ name: "c17", displayName: "Color 17", value: { value: "" } });
    c18 = new formattingSettings.ColorPicker({ name: "c18", displayName: "Color 18", value: { value: "" } });
    c19 = new formattingSettings.ColorPicker({ name: "c19", displayName: "Color 19", value: { value: "" } });
    c20 = new formattingSettings.ColorPicker({ name: "c20", displayName: "Color 20", value: { value: "" } });

    name = "segmentColorsSettings";
    displayName = "Sobrescribir Colores de Segmentos";
    slices = [this.numColors, this.c1, this.c2, this.c3, this.c4, this.c5, this.c6, this.c7, this.c8, this.c9, this.c10, this.c11, this.c12, this.c13, this.c14, this.c15, this.c16, this.c17, this.c18, this.c19, this.c20];

    public updateVisibleSlices() {
        const count = Math.max(0, Math.min(20, this.numColors.value ?? 0));
        const allColors = [this.c1, this.c2, this.c3, this.c4, this.c5, this.c6, this.c7, this.c8, this.c9, this.c10, this.c11, this.c12, this.c13, this.c14, this.c15, this.c16, this.c17, this.c18, this.c19, this.c20];
        this.slices = [this.numColors, ...allColors.slice(0, count)];
    }

    public getActiveColors(): (string | null)[] {
        const allColors = [this.c1, this.c2, this.c3, this.c4, this.c5, this.c6, this.c7, this.c8, this.c9, this.c10, this.c11, this.c12, this.c13, this.c14, this.c15, this.c16, this.c17, this.c18, this.c19, this.c20];
        return allColors.map(c => (c.value && c.value.value) ? c.value.value : null);
    }
}

export class VisualSettings extends FormattingSettingsModel {
    scale            = new ScaleSettingsCard();
    order            = new OrderSettingsCard();
    thresholdsConfig = new ThresholdsCard();
    segmentColors    = new SegmentColorsCard();
    marker           = new MarkerSettingsCard();
    bar              = new BarSettingsCard();
    labels           = new LabelSettingsCard();
    target           = new TargetSettingsCard();
    groupHeader      = new GroupHeaderCard();
    kpiPanel         = new KpiPanelCard();

    cards = [this.scale, this.thresholdsConfig, this.bar, this.order, this.marker, this.segmentColors, this.labels, this.groupHeader, this.target, this.kpiPanel];
}
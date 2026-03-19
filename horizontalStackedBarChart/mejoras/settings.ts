import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// ─── Escala ───────────────────────────────────────────────────────────────────
class ScaleSettingsCard extends FormattingSettingsCard {
    minValue = new formattingSettings.NumUpDown({
        name: "minValue",
        displayName: "Valor mínimo",
        value: 0,
    });
    maxValue = new formattingSettings.NumUpDown({
        name: "maxValue",
        displayName: "Valor máximo",
        value: 100,
    });
    unit = new formattingSettings.TextInput({
        name: "unit",
        displayName: "Unidad",
        value: "%",
        placeholder: "%, min, pts ...",
    });

    name: string = "scaleSettings";
    displayName: string = "Escala";
    slices: FormattingSettingsSlice[] = [this.minValue, this.maxValue, this.unit];
}

// ─── Orden ────────────────────────────────────────────────────────────────────
class OrderSettingsCard extends FormattingSettingsCard {
    ascending = new formattingSettings.ToggleSwitch({
        name: "ascending",
        displayName: "Ascendente (izquierda = mejor)",
        value: true,
    });

    name: string = "orderSettings";
    displayName: string = "Orden de segmentos";
    slices: FormattingSettingsSlice[] = [this.ascending];
}

// ─── Fábrica genérica para tarjetas de umbral ─────────────────────────────────
class ThresholdCard extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    value: formattingSettings.NumUpDown;
    color: formattingSettings.ColorPicker;
    label: formattingSettings.TextInput;

    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];

    constructor(
        index: number,
        defaultValue: number,
        defaultColor: string,
        defaultLabel: string,
        defaultShow: boolean = true
    ) {
        super();
        this.name = `threshold${index}`;
        this.displayName = `Umbral ${index}`;

        this.show = new formattingSettings.ToggleSwitch({
            name: "show",
            displayName: "Mostrar este umbral",
            value: defaultShow,
        });
        this.value = new formattingSettings.NumUpDown({
            name: "value",
            displayName: "Valor del umbral",
            value: defaultValue,
        });
        this.color = new formattingSettings.ColorPicker({
            name: "color",
            displayName: "Color del segmento",
            value: { value: defaultColor },
        });
        this.label = new formattingSettings.TextInput({
            name: "label",
            displayName: "Etiqueta del segmento",
            value: defaultLabel,
            placeholder: "Ej: Crítico, Aceptable ...",
        });

        this.slices = [this.show, this.value, this.color, this.label];
    }
}

// ─── Marcador ─────────────────────────────────────────────────────────────────
class MarkerSettingsCard extends FormattingSettingsCard {
    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Color del marcador",
        value: { value: "#1a1a1a" },
    });
    width = new formattingSettings.NumUpDown({
        name: "width",
        displayName: "Grosor (px)",
        value: 3,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
                   maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 10 } },
    });
    showLabel = new formattingSettings.ToggleSwitch({
        name: "showLabel",
        displayName: "Mostrar etiqueta de valor",
        value: true,
    });

    name: string = "markerSettings";
    displayName: string = "Marcador";
    slices: FormattingSettingsSlice[] = [this.color, this.width, this.showLabel];
}

// ─── Barra ────────────────────────────────────────────────────────────────────
class BarSettingsCard extends FormattingSettingsCard {
    height = new formattingSettings.NumUpDown({
        name: "height",
        displayName: "Alto de barra (px)",
        value: 20,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
                   maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 60 } },
    });
    borderRadius = new formattingSettings.NumUpDown({
        name: "borderRadius",
        displayName: "Esquinas redondeadas (px)",
        value: 4,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
                   maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 30 } },
    });
    showThresholdTicks = new formattingSettings.ToggleSwitch({
        name: "showThresholdTicks",
        displayName: "Mostrar marcas de umbral",
        value: true,
    });
    showLegend = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayName: "Mostrar leyenda de segmentos",
        value: true,
    });

    name: string = "barSettings";
    displayName: string = "Barra";
    slices: FormattingSettingsSlice[] = [
        this.height, this.borderRadius,
        this.showThresholdTicks, this.showLegend,
    ];
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────
class LabelSettingsCard extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Tamaño de fuente",
        value: 12,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
                   maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 } },
    });
    fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Color del texto",
        value: { value: "#333333" },
    });
    showIndicatorName = new formattingSettings.ToggleSwitch({
        name: "showIndicatorName",
        displayName: "Mostrar nombre del indicador",
        value: true,
    });

    name: string = "labelSettings";
    displayName: string = "Etiquetas";
    slices: FormattingSettingsSlice[] = [
        this.fontSize, this.fontColor, this.showIndicatorName,
    ];
}

// ─── Modelo principal ─────────────────────────────────────────────────────────
export class VisualSettings extends FormattingSettingsModel {
    scale    = new ScaleSettingsCard();
    order    = new OrderSettingsCard();

    // 5 umbrales con valores y colores por defecto (rojo -> verde)
    threshold1 = new ThresholdCard(1, 25,  "#8B0000", "Bajo",    true);
    threshold2 = new ThresholdCard(2, 50,  "#FF4500", "Medio",   true);
    threshold3 = new ThresholdCard(3, 75,  "#FFD700", "Alto",    true);
    threshold4 = new ThresholdCard(4, 90,  "#90EE90", "Crítico", true);
    threshold5 = new ThresholdCard(5, 100, "#006400", "Máximo",  false);

    marker = new MarkerSettingsCard();
    bar    = new BarSettingsCard();
    labels = new LabelSettingsCard();

    cards: FormattingSettingsCard[] = [
        this.scale,
        this.order,
        this.threshold1,
        this.threshold2,
        this.threshold3,
        this.threshold4,
        this.threshold5,
        this.marker,
        this.bar,
        this.labels,
    ];
}

// ─── Helper: extraer umbrales activos ordenados ───────────────────────────────
export interface ThresholdDef {
    value: number;
    color: string;
    label: string;
}

export function getActiveThresholds(settings: VisualSettings): ThresholdDef[] {
    const candidates: ThresholdDef[] = [];

    [
        settings.threshold1,
        settings.threshold2,
        settings.threshold3,
        settings.threshold4,
        settings.threshold5,
    ].forEach((t) => {
        if (t.show.value) {
            candidates.push({
                value: t.value.value as number,
                color: (t.color.value as any).value,
                label: t.label.value as string,
            });
        }
    });

    return candidates.sort((a, b) => a.value - b.value);
}

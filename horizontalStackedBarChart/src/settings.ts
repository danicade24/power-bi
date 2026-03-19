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
    ascending = new formattingSettings.ToggleSwitch({ name: "ascending", displayName: "Colores Ascendentes", value: true });

    name = "orderSettings";
    displayName = "Orden de Segmentos";
    slices = [this.ascending];
}

export class ThresholdsCard extends FormattingSettingsCard {
    t1 = new formattingSettings.NumUpDown({ name: "t1", displayName: "Umbral 1", value: 25 });
    t2 = new formattingSettings.NumUpDown({ name: "t2", displayName: "Umbral 2", value: 50 });
    t3 = new formattingSettings.NumUpDown({ name: "t3", displayName: "Umbral 3", value: 75 });
    t4 = new formattingSettings.NumUpDown({ name: "t4", displayName: "Umbral 4", value: null as any });
    t5 = new formattingSettings.NumUpDown({ name: "t5", displayName: "Umbral 5", value: null as any });

    name = "thresholdsSettings";
    displayName = "Líneas de Umbral (internas)";
    slices = [this.t1, this.t2, this.t3, this.t4, this.t5];

    // Utilidad extra para extraer solo los definidos y ordenados
    public getActiveThresholds(): number[] {
        return [this.t1.value, this.t2.value, this.t3.value, this.t4.value, this.t5.value]
            .filter(v => typeof v === 'number') as number[];
    }
}

export class SegmentColorsCard extends FormattingSettingsCard {
    c1 = new formattingSettings.ColorPicker({ name: "c1", displayName: "Segmento 1", value: { value: "#8B0000" } });
    c2 = new formattingSettings.ColorPicker({ name: "c2", displayName: "Segmento 2", value: { value: "#FF4500" } });
    c3 = new formattingSettings.ColorPicker({ name: "c3", displayName: "Segmento 3", value: { value: "#FFD700" } });
    c4 = new formattingSettings.ColorPicker({ name: "c4", displayName: "Segmento 4", value: { value: "#90EE90" } });
    c5 = new formattingSettings.ColorPicker({ name: "c5", displayName: "Segmento 5", value: { value: "#006400" } });
    c6 = new formattingSettings.ColorPicker({ name: "c6", displayName: "Segmento 6", value: { value: "#003300" } });

    name = "segmentColors";
    displayName = "Colores de Segmentos (N+1)";
    slices = [this.c1, this.c2, this.c3, this.c4, this.c5, this.c6];

    // Lógica dinámica solicitada para ocultar inputs sobrantes
    public updateVisibleSlices(numberOfThresholds: number) {
        const segmentsRequired = Math.min(numberOfThresholds + 1, 6);
        this.slices = [this.c1, this.c2, this.c3, this.c4, this.c5, this.c6].slice(0, segmentsRequired);
    }

    public getActiveColors(): string[] {
        return [this.c1, this.c2, this.c3, this.c4, this.c5, this.c6]
            .map(c => c.value.value);
    }
}

export class MarkerSettingsCard extends FormattingSettingsCard {
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#1a1a1a" } });
    width = new formattingSettings.NumUpDown({
        name: "width",
        displayName: "Alto total del marcador",
        value: 16,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 } }
    });
    overrideValue = new formattingSettings.NumUpDown({ name: "overrideValue", displayName: "Valor en eje X (Manual)", value: null as any });
    showLabel = new formattingSettings.ToggleSwitch({ name: "showLabel", displayName: "Mostrar etiqueta", value: true });

    name = "markerSettings";
    displayName = "Marcador";
    slices = [this.color, this.width, this.overrideValue, this.showLabel];
}

export class BarSettingsCard extends FormattingSettingsCard {
    height = new formattingSettings.NumUpDown({ name: "height", displayName: "Alto de barra", value: 20 });
    borderRadius = new formattingSettings.NumUpDown({ name: "borderRadius", displayName: "Esquinas redondeadas", value: 4 });
    showThresholdTicks = new formattingSettings.ToggleSwitch({ name: "showThresholdTicks", displayName: "Mostrar marcas (ticks)", value: true });
    showLegend = new formattingSettings.ToggleSwitch({ name: "showLegend", displayName: "Mostrar leyenda", value: true });

    name = "barSettings";
    displayName = "Configuración de Barra";
    slices = [this.height, this.borderRadius, this.showThresholdTicks, this.showLegend];
}

export class LabelSettingsCard extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Tamaño", value: 12 });
    fontColor = new formattingSettings.ColorPicker({ name: "fontColor", displayName: "Color", value: { value: "#333333" } });
    showIndicatorName = new formattingSettings.ToggleSwitch({ name: "showIndicatorName", displayName: "Mostrar nombre", value: true });

    name = "labelSettings";
    displayName = "Etiquetas Generales";
    slices = [this.fontSize, this.fontColor, this.showIndicatorName];
}

export class VisualSettings extends FormattingSettingsModel {
    scale    = new ScaleSettingsCard();
    order    = new OrderSettingsCard();
    thresholdsConfig = new ThresholdsCard();
    segmentColors = new SegmentColorsCard();
    marker   = new MarkerSettingsCard();
    bar      = new BarSettingsCard();
    labels   = new LabelSettingsCard();

    cards = [this.scale, this.order, this.thresholdsConfig, this.segmentColors, this.marker, this.bar, this.labels];
}

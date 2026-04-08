import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;

export class YAxisCard extends FormattingSettingsCard {
    barColor = new formattingSettings.ColorPicker({
        name: "barColor",
        displayName: "Color de barras",
        value: { value: "#5DBA4A" }
    });
    barWidth = new formattingSettings.NumUpDown({
        name: "barWidth",
        displayName: "Ancho de barras (px)",
        value: 37
    });
    name = "yAxis";
    displayName = "Eje Y";
    slices = [this.barColor, this.barWidth];
}

export class XAxisCard extends FormattingSettingsCard {
    showLabels = new formattingSettings.ToggleSwitch({
        name: "showLabels",
        displayName: "Mostrar nombres",
        value: true
    });
    labelFontSize = new formattingSettings.NumUpDown({
        name: "labelFontSize",
        displayName: "Tamaño de texto",
        value: 11
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Color de texto",
        value: { value: "#555555" }
    });
    flagSize = new formattingSettings.NumUpDown({
        name: "flagSize",
        displayName: "Tamaño de bandera (px)",
        value: 30
    });
    name = "xAxis";
    displayName = "Eje X";
    slices = [this.showLabels, this.labelFontSize, this.labelColor, this.flagSize];
}

export class DataLabelsCard extends FormattingSettingsCard {
    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Mostrar valores",
        value: false
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Tamaño de fuente",
        value: 11
    });
    name = "dataLabels";
    displayName = "Etiquetas de datos";
    slices = [this.showValues, this.fontSize];
}

export class VisualSettings extends FormattingSettingsModel {
    yAxis = new YAxisCard();
    xAxis = new XAxisCard();
    dataLabels = new DataLabelsCard();
    cards = [this.xAxis, this.yAxis, this.dataLabels];
}

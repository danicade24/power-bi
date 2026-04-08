import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
export declare class YAxisCard extends FormattingSettingsCard {
    barColor: formattingSettings.ColorPicker;
    barWidth: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: (formattingSettings.NumUpDown | formattingSettings.ColorPicker)[];
}
export declare class XAxisCard extends FormattingSettingsCard {
    showLabels: formattingSettings.ToggleSwitch;
    labelFontSize: formattingSettings.NumUpDown;
    labelColor: formattingSettings.ColorPicker;
    flagSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.NumUpDown | formattingSettings.ColorPicker)[];
}
export declare class DataLabelsCard extends FormattingSettingsCard {
    showValues: formattingSettings.ToggleSwitch;
    fontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.NumUpDown)[];
}
export declare class VisualSettings extends FormattingSettingsModel {
    yAxis: YAxisCard;
    xAxis: XAxisCard;
    dataLabels: DataLabelsCard;
    cards: (XAxisCard | YAxisCard | DataLabelsCard)[];
}

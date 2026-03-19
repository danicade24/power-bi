import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
export declare class ScaleSettingsCard extends FormattingSettingsCard {
    minValue: formattingSettings.NumUpDown;
    maxValue: formattingSettings.NumUpDown;
    unit: formattingSettings.TextInput;
    name: string;
    displayName: string;
    slices: (formattingSettings.NumUpDown | formattingSettings.TextInput)[];
}
export declare class OrderSettingsCard extends FormattingSettingsCard {
    ascending: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: formattingSettings.ToggleSwitch[];
}
export declare class ThresholdsCard extends FormattingSettingsCard {
    t1: formattingSettings.NumUpDown;
    t2: formattingSettings.NumUpDown;
    t3: formattingSettings.NumUpDown;
    t4: formattingSettings.NumUpDown;
    t5: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: formattingSettings.NumUpDown[];
    getActiveThresholds(): number[];
}
export declare class SegmentColorsCard extends FormattingSettingsCard {
    c1: formattingSettings.ColorPicker;
    c2: formattingSettings.ColorPicker;
    c3: formattingSettings.ColorPicker;
    c4: formattingSettings.ColorPicker;
    c5: formattingSettings.ColorPicker;
    c6: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: formattingSettings.ColorPicker[];
    updateVisibleSlices(numberOfThresholds: number): void;
    getActiveColors(): string[];
}
export declare class MarkerSettingsCard extends FormattingSettingsCard {
    color: formattingSettings.ColorPicker;
    width: formattingSettings.NumUpDown;
    overrideValue: formattingSettings.NumUpDown;
    showLabel: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: (formattingSettings.NumUpDown | formattingSettings.ColorPicker | formattingSettings.ToggleSwitch)[];
}
export declare class BarSettingsCard extends FormattingSettingsCard {
    height: formattingSettings.NumUpDown;
    borderRadius: formattingSettings.NumUpDown;
    showThresholdTicks: formattingSettings.ToggleSwitch;
    showLegend: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: (formattingSettings.NumUpDown | formattingSettings.ToggleSwitch)[];
}
export declare class LabelSettingsCard extends FormattingSettingsCard {
    fontSize: formattingSettings.NumUpDown;
    fontColor: formattingSettings.ColorPicker;
    showIndicatorName: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: (formattingSettings.NumUpDown | formattingSettings.ColorPicker | formattingSettings.ToggleSwitch)[];
}
export declare class VisualSettings extends FormattingSettingsModel {
    scale: ScaleSettingsCard;
    order: OrderSettingsCard;
    thresholdsConfig: ThresholdsCard;
    segmentColors: SegmentColorsCard;
    marker: MarkerSettingsCard;
    bar: BarSettingsCard;
    labels: LabelSettingsCard;
    cards: (ScaleSettingsCard | OrderSettingsCard | ThresholdsCard | SegmentColorsCard | MarkerSettingsCard | BarSettingsCard | LabelSettingsCard)[];
}

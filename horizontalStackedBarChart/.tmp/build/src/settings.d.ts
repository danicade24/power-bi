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
    numThresholds: formattingSettings.NumUpDown;
    t1: formattingSettings.NumUpDown;
    t2: formattingSettings.NumUpDown;
    t3: formattingSettings.NumUpDown;
    t4: formattingSettings.NumUpDown;
    t5: formattingSettings.NumUpDown;
    t6: formattingSettings.NumUpDown;
    t7: formattingSettings.NumUpDown;
    t8: formattingSettings.NumUpDown;
    t9: formattingSettings.NumUpDown;
    t10: formattingSettings.NumUpDown;
    t11: formattingSettings.NumUpDown;
    t12: formattingSettings.NumUpDown;
    t13: formattingSettings.NumUpDown;
    t14: formattingSettings.NumUpDown;
    t15: formattingSettings.NumUpDown;
    t16: formattingSettings.NumUpDown;
    t17: formattingSettings.NumUpDown;
    t18: formattingSettings.NumUpDown;
    t19: formattingSettings.NumUpDown;
    t20: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: formattingSettings.NumUpDown[];
    updateVisibleSlices(hasDynamic: boolean): void;
    getActiveThresholdsOrNulls(): (number | null)[];
}
export declare class TargetSettingsCard extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    color: formattingSettings.ColorPicker;
    width: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.ColorPicker | formattingSettings.NumUpDown)[];
}
export declare class MarkerSettingsCard extends FormattingSettingsCard {
    color: formattingSettings.ColorPicker;
    width: formattingSettings.NumUpDown;
    overrideValue: formattingSettings.NumUpDown;
    showLabel: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.ColorPicker | formattingSettings.NumUpDown)[];
}
export declare class BarSettingsCard extends FormattingSettingsCard {
    height: formattingSettings.NumUpDown;
    borderRadius: formattingSettings.NumUpDown;
    showThresholdTicks: formattingSettings.ToggleSwitch;
    showLegend: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.NumUpDown)[];
}
export declare class LabelSettingsCard extends FormattingSettingsCard {
    fontSize: formattingSettings.NumUpDown;
    fontColor: formattingSettings.ColorPicker;
    showIndicatorName: formattingSettings.ToggleSwitch;
    kpiValueFontSize: formattingSettings.NumUpDown;
    kpiLabelFontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: (formattingSettings.ToggleSwitch | formattingSettings.ColorPicker | formattingSettings.NumUpDown)[];
}
export declare class SegmentColorsCard extends FormattingSettingsCard {
    numColors: formattingSettings.NumUpDown;
    c1: formattingSettings.ColorPicker;
    c2: formattingSettings.ColorPicker;
    c3: formattingSettings.ColorPicker;
    c4: formattingSettings.ColorPicker;
    c5: formattingSettings.ColorPicker;
    c6: formattingSettings.ColorPicker;
    c7: formattingSettings.ColorPicker;
    c8: formattingSettings.ColorPicker;
    c9: formattingSettings.ColorPicker;
    c10: formattingSettings.ColorPicker;
    c11: formattingSettings.ColorPicker;
    c12: formattingSettings.ColorPicker;
    c13: formattingSettings.ColorPicker;
    c14: formattingSettings.ColorPicker;
    c15: formattingSettings.ColorPicker;
    c16: formattingSettings.ColorPicker;
    c17: formattingSettings.ColorPicker;
    c18: formattingSettings.ColorPicker;
    c19: formattingSettings.ColorPicker;
    c20: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: (formattingSettings.ColorPicker | formattingSettings.NumUpDown)[];
    updateVisibleSlices(): void;
    getActiveColors(): (string | null)[];
}
export declare class VisualSettings extends FormattingSettingsModel {
    scale: ScaleSettingsCard;
    order: OrderSettingsCard;
    thresholdsConfig: ThresholdsCard;
    segmentColors: SegmentColorsCard;
    marker: MarkerSettingsCard;
    bar: BarSettingsCard;
    labels: LabelSettingsCard;
    target: TargetSettingsCard;
    cards: (ScaleSettingsCard | BarSettingsCard | OrderSettingsCard | MarkerSettingsCard | ThresholdsCard | SegmentColorsCard | LabelSettingsCard | TargetSettingsCard)[];
}

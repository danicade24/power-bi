import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
/**
 * Slicer settings formatting card
 */
declare class SlicerSettingsCard extends FormattingSettingsCard {
    style: formattingSettings.ItemDropdown;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
/**
 * visual settings model class
 *
 */
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    slicerCard: SlicerSettingsCard;
    cards: SlicerSettingsCard[];
}
export {};

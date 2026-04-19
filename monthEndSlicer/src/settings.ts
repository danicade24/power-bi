"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Slicer settings formatting card
 */
class SlicerSettingsCard extends FormattingSettingsCard {
    style = new formattingSettings.ItemDropdown({
        name: "style",
        displayName: "Style",
        items: [
            { displayName: "Between", value: "Between" },
            { displayName: "Before", value: "Before" },
            { displayName: "After", value: "After" },
        ],
        value: { displayName: "Between", value: "Between" }
    });

    name: string = "slicerSettings";
    displayName: string = "Slicer settings";
    slices: Array<FormattingSettingsSlice> = [this.style];
}

/**
 * visual settings model class
 *
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    slicerCard = new SlicerSettingsCard();

    cards = [this.slicerCard];
}

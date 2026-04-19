import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private target;
    private formattingSettings;
    private formattingSettingsService;
    private host;
    private container;
    private startInput;
    private endInput;
    private sliderElement;
    private slider;
    private isUpdateInProgress;
    private dataView;
    private globalMinDate;
    private globalMaxDate;
    private currentStyle;
    constructor(options: VisualConstructorOptions);
    private snapToNearestMonthEnd;
    private formatDate;
    update(options: VisualUpdateOptions): void;
    private updateSliderUI;
    private updateInputVisibility;
    private applyFilter;
    getFormattingModel(): powerbi.visuals.FormattingModel;
}

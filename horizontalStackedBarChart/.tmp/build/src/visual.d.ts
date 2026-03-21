import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private static clipIdCounter;
    private host;
    private container;
    private settings;
    private formattingSettingsService;
    private lastSegments;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private extractData;
    private buildSegments;
    private renderEmpty;
    private render;
    private drawVectorBar;
    getFormattingModel(): powerbi.visuals.FormattingModel;
}

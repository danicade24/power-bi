import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export interface Segment {
    color: string;
    width: number;
    startValue: number;
    endValue: number;
}
export interface ScorecardRow {
    metricName: string;
    statusText: string;
    markerValue: number | null;
    rowMin: number;
    rowMax: number;
    segments: Segment[];
}
export interface ViewModel {
    rows: ScorecardRow[];
}
export declare class Visual implements IVisual {
    private target;
    private container;
    private barMaxHeight;
    private barThickness;
    private palette10Colors;
    private palette6Colors;
    private defaultPalette;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    /**
     * Extrae los datos desde un Table DataView y aplica la lógica
     * Hardcoded Switch evaluando la "Métrica".
     */
    private getViewModelFromTable;
}

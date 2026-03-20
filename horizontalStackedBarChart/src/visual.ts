"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService, formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions   = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions        = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                    = powerbi.extensibility.visual.IVisual;
import IVisualHost                = powerbi.extensibility.visual.IVisualHost;
import DataView                   = powerbi.DataView;

interface SingleIndicatorData {
    value: number;
    target?: number | null;
    dataMin?: number | null;
    dataMax?: number | null;
    dataThresholds: number[];
}

interface Segment {
    start: number;    
    end:   number;    
    color: string;
}

export class Visual implements IVisual {
    private static clipIdCounter = 0;
    private host: IVisualHost;
    private container: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();
        
        this.container = d3
            .select(options.element)
            .append("svg")
            .classed("hsb-svg-container", true)
            .style("width", "100%")
            .style("height", "100%")
            .style("font-family", "Segoe UI, sans-serif");
    }

    public update(options: VisualUpdateOptions): void {
        console.log('DATOS RECIBIDOS DE PBI:', options.dataViews);
        this.container.selectAll("*").remove();

        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings,
            options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];
        if (!dataView?.categorical?.values?.length) {
            this.renderEmpty("Faltan datos", options);
            return;
        }

        const indicator = this.extractData(dataView);
        if (!indicator) {
            this.renderEmpty("Faltan datos", options);
            return;
        }

        const width = options.viewport.width;
        const height = options.viewport.height;

        this.render(indicator, width, height, options);
    }

    private extractData(dataView: DataView): SingleIndicatorData | null {
        const cat = dataView.categorical;
        
        let measureCol: powerbi.DataViewValueColumn;
        let targetCol: powerbi.DataViewValueColumn;
        let minCol: powerbi.DataViewValueColumn;
        let maxCol: powerbi.DataViewValueColumn;
        let thresholdCols: powerbi.DataViewValueColumn[] = [];

        cat.values?.forEach(valueCol => {
            if (valueCol.source.roles["measure"]) measureCol = valueCol;
            if (valueCol.source.roles["target"]) targetCol = valueCol;
            if (valueCol.source.roles["min"]) minCol = valueCol;
            if (valueCol.source.roles["max"]) maxCol = valueCol;
            if (valueCol.source.roles["thresholds"]) thresholdCols.push(valueCol);
        });

        if (!measureCol) return null;

        const getVal = (col: powerbi.DataViewValueColumn | undefined) => {
            const v = col?.values[0];
            if (v == null || v === "") return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
        };

        const dataThresholds = thresholdCols
            .map(col => getVal(col))
            .filter(v => v != null) as number[];

        return {
            value: getVal(measureCol) ?? 0,
            target: getVal(targetCol),
            dataMin: getVal(minCol),
            dataMax: getVal(maxCol),
            dataThresholds
        };
    }

    private buildSegments(
        minVal: number,
        maxVal: number,
        ascending: boolean,
        tValues: number[]
    ): Segment[] {
        let rootColors = ['#00A651', '#84C225', '#FFFF00', '#FFA500', '#FF5500', '#FF0000'];
        if (!ascending) {
            rootColors = rootColors.slice().reverse();
        }

        const colorScale = d3.interpolateRgbBasis(rootColors);

        const validThresholds = tValues
            .filter(v => v > minVal && v < maxVal)
            .sort((a, b) => a - b);
        
        const marks = [minVal, ...validThresholds, maxVal];
        const numSegments = marks.length - 1;

        const manualColors = this.settings.segmentColors.getActiveColors();
        const segs: Segment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const relativeMid = numSegments > 1 ? i / (numSegments - 1) : 1;
            const validRelativeMid = Math.max(0, Math.min(1, relativeMid));
            
            let color = manualColors[i];
            if (!color || color.trim() === "") {
                color = colorScale(validRelativeMid);
            }

            segs.push({
                start: marks[i],
                end: marks[i + 1],
                color: color
            });
        }
        
        return segs;
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        const w = options.viewport.width;
        const h = options.viewport.height;
        this.container.append("text")
            .attr("x", w / 2)
            .attr("y", h / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888")
            .attr("font-size", "13px")
            .text(msg);
    }

    private render(
        indicator: SingleIndicatorData,
        viewWidth: number,
        viewHeight: number,
        options: VisualUpdateOptions
    ): void {
        const s = this.settings;
        const barH = Math.max(8, (s.bar.height.value as number) ?? 20);
        const radius = (s.bar.borderRadius.value as number) ?? 4;
        const fontSize = (s.labels.fontSize.value as number) ?? 12;
        const fontColor = (s.labels.fontColor.value as any)?.value ?? "#333333";
        const markerColor = (s.marker.color.value as any)?.value ?? "#1a1a1a";
        const markerWidth = (s.marker.width.value as number) ?? 16;
        const showLabel = s.marker.showLabel.value as boolean;
        const targetColor = (s.target.color.value as any)?.value ?? "#ffffff";
        const targetWidth = (s.target.width.value as number) ?? 2;
        const showTarget = s.target.show.value as boolean;
        const showName = s.labels.showIndicatorName.value as boolean;
        const showTicks = s.bar.showThresholdTicks.value as boolean;
        const showLegend = s.bar.showLegend.value as boolean;
        const unit = (s.scale.unit.value as string) ?? "";
        
        let dynamicMin = indicator.value;
        let dynamicMax = indicator.value;
        
        const rawManualThresholds = this.settings.thresholdsConfig.getActiveThresholdsOrNulls();
        const manualThresholds = rawManualThresholds.filter((t): t is number => t != null);

        if (indicator.target != null && !isNaN(indicator.target)) {
            if (indicator.target > dynamicMax) dynamicMax = indicator.target;
            if (indicator.target < dynamicMin) dynamicMin = indicator.target;
        }
        if (indicator.dataMax != null && !isNaN(indicator.dataMax) && indicator.dataMax > dynamicMax) dynamicMax = indicator.dataMax;
        if (indicator.dataMin != null && !isNaN(indicator.dataMin) && indicator.dataMin < dynamicMin) dynamicMin = indicator.dataMin;
        
        indicator.dataThresholds.forEach(t => {
            if (!isNaN(t)) {
                if (t > dynamicMax) dynamicMax = t;
                if (t < dynamicMin) dynamicMin = t;
            }
        });

        manualThresholds.forEach(t => {
            if (!isNaN(t)) {
                if (t > dynamicMax) dynamicMax = t;
                if (t < dynamicMin) dynamicMin = t;
            }
        });

        if (dynamicMax === dynamicMin) {
            dynamicMax = dynamicMin + 1;
        }

        let minVal = (s.scale.minValue.value != null && s.scale.minValue.value !== ("" as any)) 
            ? Number(s.scale.minValue.value)
            : (indicator.dataMin != null && !isNaN(indicator.dataMin) ? indicator.dataMin : dynamicMin);
            
        let maxVal = (s.scale.maxValue.value != null && s.scale.maxValue.value !== ("" as any)) 
            ? Number(s.scale.maxValue.value)
            : (indicator.dataMax != null && !isNaN(indicator.dataMax) ? indicator.dataMax : dynamicMax);

        if (minVal >= maxVal) maxVal = minVal + 1;
        const range = maxVal - minVal;

        const dataThresholds = indicator.dataThresholds.filter(t => !isNaN(t));
        const globalSet = new Set<number>();
        dataThresholds.forEach(t => globalSet.add(t));
        manualThresholds.forEach(t => globalSet.add(t));
        
        const globalResolvedThresholds = Array.from(globalSet).sort((a, b) => a - b);

        const margin = { top: 10, right: 30, bottom: 20, left: 16 };
        if (showName) margin.top += fontSize + 10;
        
        const drawWidth = Math.max(1, viewWidth - margin.left - margin.right);
        const scaleX = d3.scaleLinear().domain([minVal, maxVal]).range([0, drawWidth]).clamp(true);

        let currentY = margin.top;

        const mainG = this.container.append("g")
            .attr("transform", `translate(${margin.left}, 0)`);

        const entryG = mainG.append("g")
            .attr("transform", `translate(0, ${currentY})`);

        const overrideValue = s.marker.overrideValue.value;
        const finalValue = (overrideValue != null && overrideValue !== ("" as any)) ? overrideValue as number : indicator.value;

        if (showName) {
            const dataView = options.dataViews?.[0];
            const measureCol = dataView?.categorical?.values?.find(v => v.source.roles["measure"]);
            const indicatorName = measureCol ? measureCol.source.displayName : "Indicador";

            entryG.append("text")
                .attr("x", 0)
                .attr("y", -8)
                .attr("font-size", `${fontSize}px`)
                .attr("font-weight", "500")
                .attr("fill", fontColor)
                .text(indicatorName);

            if (showLabel) {
                entryG.append("text")
                    .attr("x", drawWidth)
                    .attr("y", -8)
                    .attr("font-size", `${fontSize - 1}px`)
                    .attr("fill", fontColor)
                    .attr("opacity", 0.7)
                    .attr("text-anchor", "end")
                    .text(`${finalValue}${unit}`);
            }
        }

        const ascending = s.order.ascending.value as boolean;
        const segments = this.buildSegments(minVal, maxVal, ascending, globalResolvedThresholds);

        this.drawVectorBar(entryG, finalValue, segments, globalResolvedThresholds, scaleX, barH, radius,
            markerColor, markerWidth, showLabel, showTicks, unit, fontSize, fontColor, minVal, maxVal,
            indicator.target, targetColor, targetWidth, showTarget);

        currentY += barH + 35;

        if (showLegend) {
            const legendG = mainG.append("g").attr("transform", `translate(0, ${currentY})`);
            
            const legendSegments = this.buildSegments(minVal, maxVal, ascending, globalResolvedThresholds);
            let lx = 0;
            
            legendSegments.forEach((seg, i) => {
                const label = `Leyenda ${i + 1}`;
                legendG.append("rect")
                    .attr("x", lx)
                    .attr("y", 0)
                    .attr("width", 12)
                    .attr("height", 12)
                    .attr("rx", 2)
                    .attr("fill", seg.color);
                    
                legendG.append("text")
                    .attr("x", lx + 16)
                    .attr("y", 10)
                    .attr("font-size", `${fontSize - 1}px`)
                    .attr("fill", fontColor)
                    .attr("opacity", 0.7)
                    .text(label);
                    
                lx += 12 + 16 + (label.length * 7) + 15; 
            });
            currentY += 20;
        }

        this.container.style("height", `${Math.max(viewHeight, currentY + margin.bottom)}px`);
    }

    private drawVectorBar(
        group: d3.Selection<SVGGElement, unknown, null, undefined>,
        value: number,
        segments: Segment[],
        thresholdValues: number[],
        scaleX: d3.ScaleLinear<number, number>,
        barH: number,
        radius: number,
        markerColor: string,
        markerWidth: number,
        showLabel: boolean,
        showTicks: boolean,
        unit: string,
        fontSize: number,
        fontColor: string,
        minVal: number,
        maxVal: number,
        targetValue?: number | null,
        targetColor?: string,
        targetWidth?: number,
        showTarget?: boolean
    ): void {
        
        radius = 0; // Fixed radius = 0 according to requirements
        const clipId = "clip-" + (++Visual.clipIdCounter);
            
        group.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", scaleX(maxVal))
            .attr("height", barH)
            .attr("rx", radius)
            .attr("ry", radius);

        const barGroup = group.append("g")
            .attr("clip-path", `url(#${clipId})`);

        segments.forEach(seg => {
            const w = scaleX(seg.end) - scaleX(seg.start);
            if (w > 0) {
                barGroup.append("rect")
                    .attr("x", scaleX(seg.start))
                    .attr("y", 0)
                    .attr("width", w)
                    .attr("height", barH)
                    .attr("fill", seg.color)
                    .attr("stroke", "none")
                    .attr("stroke-width", 0)
                    .attr("opacity", 1);
            }
        });

        const validThresholds = thresholdValues.filter(t => t > minVal && t < maxVal);
        validThresholds.forEach(t => {
            barGroup.append("line")
                .attr("x1", scaleX(t))
                .attr("y1", 0)
                .attr("x2", scaleX(t))
                .attr("y2", barH)
                .attr("stroke", "none") 
                .attr("stroke-width", 0); 
        });

        group.append("rect")
            .attr("width", scaleX(maxVal))
            .attr("height", barH)
            .attr("rx", radius)
            .attr("ry", radius)
            .attr("fill", "transparent")
            .attr("stroke", "none")
            .attr("stroke-width", 0);

        const markerPos = scaleX(value);
        
        const ph = Math.max(12, markerWidth * 1.5); 
        const pw = Math.max(8, ph * 0.4);           
        const th = ph * 0.4;                        
        
        const points = `-${pw/2},-${ph} ${pw/2},-${ph} ${pw/2},-${th} 0,0 -${pw/2},-${th}`;

        group.append("polygon")
            .attr("points", points)
            .attr("fill", markerColor)
            .attr("transform", `translate(${markerPos}, ${-1})`);

        if (showTarget && targetValue != null && targetValue >= minVal && targetValue <= maxVal) {
            const tx = scaleX(targetValue);
            group.append("line")
                .attr("x1", tx)
                .attr("y1", -(targetWidth || 2))
                .attr("x2", tx)
                .attr("y2", barH + (targetWidth || 2))
                .attr("stroke", targetColor || "#ffffff")
                .attr("stroke-width", targetWidth || 2)
                .attr("z-index", 10);
        }

        if (showLabel) {
            const lbl = group.append("text")
                .attr("x", markerPos)
                .attr("y", -ph - 6)
                .attr("font-size", `${Math.max(9, fontSize - 2)}px`)
                .attr("fill", fontColor)
                .attr("text-anchor", "middle")
                .text(`${value}${unit}`);
            
            const textLen = (`${value}${unit}`.length * (fontSize - 2) * 0.6) + 4;
            group.insert("rect", "text:last-child")
                .attr("x", markerPos - textLen / 2)
                .attr("y", -ph - 6 - (fontSize - 2))
                .attr("width", textLen)
                .attr("height", fontSize)
                .attr("fill", "rgba(255,255,255,0.85)")
                .attr("rx", 2);
        }

        if (showTicks) {
            const ticksG = group.append("g")
                .attr("transform", `translate(0, ${barH + 12})`);
                
            validThresholds.forEach(t => {
                ticksG.append("text")
                    .attr("x", scaleX(t))
                    .attr("y", 0)
                    .attr("font-size", `${Math.max(8, fontSize - 3)}px`)
                    .attr("fill", fontColor)
                    .attr("opacity", 0.55)
                    .attr("text-anchor", "middle")
                    .text(String(t));
                    
                ticksG.append("line")
                    .attr("x1", scaleX(t))
                    .attr("y1", -12)
                    .attr("x2", scaleX(t))
                    .attr("y2", -8)
                    .attr("stroke", fontColor)
                    .attr("stroke-width", 1)
                    .attr("opacity", 0.5);
            });
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.settings.thresholdsConfig.updateVisibleSlices(false);
        this.settings.segmentColors.updateVisibleSlices();

        this.settings.order.slices = [
            this.settings.order.ascending
        ];

        this.settings.marker.slices = [
            this.settings.marker.color,
            this.settings.marker.width,
            this.settings.marker.overrideValue,
            this.settings.marker.showLabel
        ];

        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
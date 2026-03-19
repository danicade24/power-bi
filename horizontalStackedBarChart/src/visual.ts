"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions   = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions        = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                    = powerbi.extensibility.visual.IVisual;
import IVisualHost                = powerbi.extensibility.visual.IVisualHost;
import DataView                   = powerbi.DataView;

interface IndicatorData {
    name: string;
    value: number;
    period?: string;
    thresholdsData?: number[];
}

interface Segment {
    start: number;    
    end:   number;    
    color: string;
}

interface RowGroup {
    name: string;
    entries: IndicatorData[];
}

export class Visual implements IVisual {

    private static clipIdCounter = 0;
    private host: IVisualHost;
    private container: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;
    private numActiveThresholds: number = 0;

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
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings,
            options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];
        if (!dataView?.categorical?.categories?.length) {
            this.renderEmpty("Arrastra un campo a «Indicador» y una medida a «Valor»", options);
            return;
        }

        const indicators = this.extractData(dataView);
        if (!indicators.length) {
            this.renderEmpty("Sin datos", options);
            return;
        }

        const firstEntryThresholds = indicators[0]?.thresholdsData;
        if (firstEntryThresholds && firstEntryThresholds.length > 0) {
            this.numActiveThresholds = firstEntryThresholds.length;
        } else {
            this.numActiveThresholds = this.settings.thresholdsConfig.getActiveThresholds().length;
        }

        const width = options.viewport.width;
        const height = options.viewport.height;

        this.render(indicators, width, height, options);
    }

    private extractData(dataView: DataView): IndicatorData[] {
        const cat = dataView.categorical;
        
        let nameRoles = -1;
        let periodRoles = -1;
        cat.categories?.forEach((category, index) => {
            if (category.source.roles["category"]) nameRoles = index;
            if (category.source.roles["period"]) periodRoles = index;
        });

        if (nameRoles === -1 && cat.categories?.length > 0) nameRoles = 0;

        const names = nameRoles !== -1 ? cat.categories[nameRoles].values : [];
        const periods = periodRoles !== -1 ? cat.categories[periodRoles].values : [];

        let measureValues = [];
        let thresholdsArrays: number[][] = [];

        cat.values?.forEach(valueCol => {
            if (valueCol.source.roles["measure"]) {
                measureValues = valueCol.values as number[];
            } else if (valueCol.source.roles["thresholds"]) {
                if (!thresholdsArrays.length) thresholdsArrays = names.map(() => []);
                valueCol.values.forEach((v: number, i: number) => {
                    if (v != null) thresholdsArrays[i].push(v);
                });
            }
        });

        if (!measureValues.length && cat.values?.length > 0) {
            measureValues = cat.values[0].values as number[];
        }

        return names.map((name, i) => ({
            name: String(name ?? ""),
            value: Number(measureValues[i] ?? 0),
            period: periods[i] != null ? String(periods[i]) : undefined,
            thresholdsData: thresholdsArrays[i] || undefined
        }));
    }

    private buildSegments(
        dynamicThresholds: number[] | undefined,
        minVal: number,
        maxVal: number,
        ascending: boolean
    ): Segment[] {
        
        let tValues: number[] = [];
        if (dynamicThresholds && dynamicThresholds.length > 0) {
            tValues = [...dynamicThresholds];
        } else {
            tValues = this.settings.thresholdsConfig.getActiveThresholds();
        }

        let colors = this.settings.segmentColors.getActiveColors();
        
        if (!ascending) {
            const numSegments = Math.min(tValues.length + 1, colors.length);
            const activeColors = colors.slice(0, numSegments).reverse();
            colors = [ ...activeColors, ...colors.slice(numSegments) ];
        }

        const validThresholds = tValues
            .filter(v => v > minVal && v < maxVal)
            .sort((a, b) => a - b);
        
        const marks = [minVal, ...validThresholds, maxVal];
        
        const segs: Segment[] = [];
        for (let i = 0; i < marks.length - 1; i++) {
            segs.push({
                start: marks[i],
                end: marks[i + 1],
                color: colors[i] || "#cccccc" 
            });
        }
        
        return segs;
    }

    private groupByName(indicators: IndicatorData[]): RowGroup[] {
        const map = new Map<string, IndicatorData[]>();
        for (const ind of indicators) {
            const key = ind.name;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ind);
        }
        return Array.from(map.entries()).map(([name, entries]) => ({ name, entries }));
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        this.container.selectAll("*").remove();
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
        indicators: IndicatorData[],
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
        const showName = s.labels.showIndicatorName.value as boolean;
        const showTicks = s.bar.showThresholdTicks.value as boolean;
        const showLegend = s.bar.showLegend.value as boolean;
        const unit = (s.scale.unit.value as string) ?? "";
        
        let minVal = (s.scale.minValue.value as number) ?? 0;
        let maxVal = (s.scale.maxValue.value as number) ?? 100;
        if (minVal >= maxVal) maxVal = minVal + 100;
        const range = maxVal - minVal;
        const ascending = s.order.ascending.value as boolean;
        const overrideValue = s.marker.overrideValue.value as number;

        this.container.selectAll("*").remove();

        const margin = { top: 10, right: 30, bottom: 20, left: 16 };
        if (showName) margin.top += fontSize + 10;
        
        const drawWidth = Math.max(1, viewWidth - margin.left - margin.right);
        
        const scaleX = d3.scaleLinear().domain([minVal, maxVal]).range([0, drawWidth]);

        const grouped = this.groupByName(indicators);
        let currentY = margin.top;
        const rowSpacing = 35;

        const mainG = this.container.append("g")
            .attr("transform", `translate(${margin.left}, 0)`);

        grouped.forEach(({ name, entries }) => {
            const entryG = mainG.append("g")
                .attr("transform", `translate(0, ${currentY})`);

            const lastEntry = entries[entries.length - 1];
            const finalValue = overrideValue != null ? overrideValue : lastEntry.value;

            if (showName) {
                entryG.append("text")
                    .attr("x", 0)
                    .attr("y", -8)
                    .attr("font-size", `${fontSize}px`)
                    .attr("font-weight", "500")
                    .attr("fill", fontColor)
                    .text(name);

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

            const segments = this.buildSegments(lastEntry.thresholdsData, minVal, maxVal, ascending);

            let tValues = lastEntry.thresholdsData && lastEntry.thresholdsData.length > 0
                ? lastEntry.thresholdsData
                : this.settings.thresholdsConfig.getActiveThresholds();

            this.drawVectorBar(entryG, finalValue, segments, tValues, scaleX, barH, radius,
                markerColor, markerWidth, showLabel, showTicks, unit, fontSize, fontColor, minVal, maxVal);

            currentY += barH + rowSpacing;

            if (entries.length > 1) {
                const histG = mainG.append("g")
                    .attr("transform", `translate(0, ${currentY})`);
                    
                histG.append("text")
                    .attr("x", 0)
                    .attr("y", -4)
                    .attr("font-size", `${fontSize - 2}px`)
                    .attr("fill", fontColor)
                    .attr("opacity", 0.5)
                    .text("Historial");
                
                currentY += 10;

                entries.forEach((entry) => {
                    const rowG = mainG.append("g")
                        .attr("transform", `translate(0, ${currentY})`);
                    
                    const labelW = 45;
                    rowG.append("text")
                        .attr("x", 0)
                        .attr("y", barH * 0.6)
                        .attr("font-size", `${fontSize - 2}px`)
                        .attr("fill", fontColor)
                        .attr("opacity", 0.6)
                        .text(entry.period ?? "");
                    
                    const miniBarX = labelW + 10;
                    const miniDrawWidth = drawWidth - miniBarX - 45; 
                    const miniScaleX = d3.scaleLinear().domain([minVal, maxVal]).range([0, miniDrawWidth]);
                    const miniBarG = rowG.append("g").attr("transform", `translate(${miniBarX}, 0)`);
                    
                    const miniSegments = this.buildSegments(entry.thresholdsData, minVal, maxVal, ascending);
                    const finalMiniValue = overrideValue != null ? overrideValue : entry.value;

                    let miniTValues = entry.thresholdsData && entry.thresholdsData.length > 0
                        ? entry.thresholdsData
                        : this.settings.thresholdsConfig.getActiveThresholds();

                    this.drawVectorBar(miniBarG, finalMiniValue, miniSegments, miniTValues, miniScaleX, Math.round(barH * 0.6), Math.round(radius * 0.6),
                        markerColor, Math.max(1, markerWidth - 1), false, false, unit, fontSize - 2, fontColor, minVal, maxVal);

                    rowG.append("text")
                        .attr("x", miniBarX + miniDrawWidth + 5)
                        .attr("y", barH * 0.6)
                        .attr("font-size", `${fontSize - 2}px`)
                        .attr("fill", fontColor)
                        .attr("opacity", 0.6)
                        .text(`${finalMiniValue}${unit}`);

                    currentY += (barH * 0.6) + 12;
                });
                currentY += 15;
            }
        });

        if (showLegend) {
            currentY += 10;
            const legendG = mainG.append("g").attr("transform", `translate(0, ${currentY})`);
            
            const legendSegments = this.buildSegments(undefined, minVal, maxVal, ascending);
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
        maxVal: number
    ): void {
        
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
                    .attr("opacity", 0.88);
            }
        });

        const validThresholds = thresholdValues.filter(t => t > minVal && t < maxVal);
        validThresholds.forEach(t => {
            barGroup.append("line")
                .attr("x1", scaleX(t))
                .attr("y1", 0)
                .attr("x2", scaleX(t))
                .attr("y2", barH)
                .attr("stroke", "rgba(0,0,0,0.5)") 
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "2,2"); 
        });

        const markerPos = scaleX(Math.max(minVal, Math.min(value, maxVal))); 
        
        const ph = Math.max(12, markerWidth * 1.5); 
        const pw = Math.max(8, ph * 0.4);           
        const th = ph * 0.4;                        
        
        const points = `-${pw/2},-${ph} ${pw/2},-${ph} ${pw/2},-${th} 0,0 -${pw/2},-${th}`;

        group.append("polygon")
            .attr("points", points)
            .attr("fill", markerColor)
            .attr("transform", `translate(${markerPos}, ${-1})`);

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
        this.settings.segmentColors.updateVisibleSlices(this.numActiveThresholds);
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService, formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

interface SingleIndicatorData {
    value: number;
    target?: number | null;
    dataMin?: number | null;
    dataMax?: number | null;
    dataThresholds: number[];
    formatText?: string | null;
}

interface Segment {
    start: number;
    end: number;
    color: string;
}

export class Visual implements IVisual {
    private static clipIdCounter = 0;
    private host: IVisualHost;
    private container: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;

    // Guardamos los segmentos del último render para usarlos en getFormattingModel
    private lastSegments: Segment[] = [];

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
        let formatTextStr: string | null = null;

        cat.values?.forEach(valueCol => {
            if (valueCol.source.roles["measure"]) measureCol = valueCol;
            if (valueCol.source.roles["target"]) targetCol = valueCol;
            if (valueCol.source.roles["min"]) minCol = valueCol;
            if (valueCol.source.roles["max"]) maxCol = valueCol;
            if (valueCol.source.roles["thresholds"]) thresholdCols.push(valueCol);
            if (valueCol.source.roles["formatText"]) {
                const tv = valueCol.values[0];
                formatTextStr = tv != null ? String(tv) : null;
            }
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
            dataThresholds,
            formatText: formatTextStr
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

    // ── Portado del gauge: lógica de etiquetas de leyenda con signos ≥ / < ────
    // Soporta tres modos:
    //   1. Sin signos: rango numérico simple "start – end"
    //   2. Con signos + etiquetas del dataset: "≤ etiqueta" / "> etiqueta"
    //   3. Con signos + fallback numérico: "≤ valor" / "> valor"
    private buildLegendLabel(
        seg: Segment,
        segIndex: number,
        totalSegs: number,
        ascending: boolean,
        unit: string,
        showSigns: boolean
    ): string {
        // parseFloat elimina ceros finales: 30.0 → "30", 35.5 → "35.5"
        const fmt = (n: number): string => {
            if (n !== 0 && Math.abs(n) < 1) return `${parseFloat((n * 100).toFixed(1))}%`;
            return `${parseFloat(n.toFixed(1))}`;
        };

        // ── Sin signos: rango simple ───────────────────────────────────────────
        if (!showSigns) {
            return `${fmt(seg.start)} \u2013 ${fmt(seg.end)}${unit}`;
        }

        // ── Con signos: lógica ascendente/descendente ─────────────────────────
        // Segmento único → siempre rango completo
        if (totalSegs === 1) {
            return `${fmt(seg.start)} \u2013 ${fmt(seg.end)}${unit}`;
        }

        if (ascending) {
            // El último segmento es el "mejor" (ej. Objetivo)
            return segIndex === totalSegs - 1
                ? `> ${fmt(seg.start)}${unit}`
                : `\u2264 ${fmt(seg.end)}${unit}`;
        } else {
            // El primer segmento es el "mejor" en orden descendente
            return segIndex === 0
                ? `< ${fmt(seg.end)}${unit}`
                : `\u2265 ${fmt(seg.start)}${unit}`;
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
        const markerHeightVal = (s.marker.width.value as number) ?? 16;
        const markerThickness = (s.marker.thickness.value as number) ?? 3;
        const showLabel = s.marker.showLabel.value as boolean;
        const targetColor = (s.target.color.value as any)?.value ?? "#ffffff";
        const targetWidth = (s.target.width.value as number) ?? 2;
        const showTarget = s.target.show.value as boolean;
        const showName = s.labels.showIndicatorName.value as boolean;
        const showTicks = s.bar.showThresholdTicks.value as boolean;
        const showLegend = s.bar.showLegend.value as boolean;
        const showLegendSigns = s.bar.showLegendSigns.value as boolean;  // ← NUEVO
        const unit = (s.scale.unit.value as string) ?? "";

        // ── KPI Panel settings (portados desde gauge) ────────────────────────
        const kpi = s.kpiPanel;
        const kpiFontFamily   = (kpi.fontFamily.value as string) || "Segoe UI";
        const kpiFontWeight   = (kpi.bold.value as boolean)   ? "bold"   : "normal";
        const kpiFontStyle    = (kpi.italic.value as boolean)  ? "italic" : "normal";
        const kpiValueFontSize = (kpi.valueFontSize.value as number) ?? 16;
        const kpiLabelFontSize = (kpi.labelFontSize.value as number) ?? 10;
        const kpiValueColor    = (kpi.valueColor.value as any)?.value ?? "#1a1a1a";
        const kpiLabelColor    = (kpi.labelColor.value as any)?.value ?? "#777777";
        // ────────────────────────────────────────────────────────────────────

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

        // Responsive scaling multiplier
        const widthScale = Math.min(1.5, Math.max(0.8, viewWidth / 400));

        const margin = { top: 10, right: 5, bottom: 20, left: 6 };
        if (showName) margin.top += Math.round((fontSize + 10) * widthScale);

        const rawFormatText = indicator.formatText;
        const hasFormatText = rawFormatText != null
            && String(rawFormatText).trim() !== ""
            && String(rawFormatText).trim() !== "null";
        const formatTextDisplay = hasFormatText ? String(rawFormatText) : "";

        const leftPanelWidth = hasFormatText ? 75 : 0;

        const ascending = s.order.ascending.value as boolean;
        const segments = this.buildSegments(minVal, maxVal, ascending, globalResolvedThresholds);

        let dynamicLegendWidth = 0;
        if (showLegend) {
            let maxCharCount = 0;
            segments.forEach((seg, i) => {
                const labelStr = this.buildLegendLabel(seg, i, segments.length, ascending, unit, showLegendSigns);
                if (labelStr.length > maxCharCount) {
                    maxCharCount = labelStr.length;
                }
            });
            const legendFontSize = Math.max(10, fontSize - 2) * widthScale;
            // Approx 0.61 of font size = average char width. Plus 12px gap + 10px circle.
            dynamicLegendWidth = maxCharCount > 0 ? (maxCharCount * legendFontSize * 0.61) + (22 * widthScale) : 0;
        }

        const legendWidth = showLegend ? Math.round(dynamicLegendWidth) : 0;
        const drawWidth = Math.max(1, viewWidth - margin.left - margin.right - leftPanelWidth - legendWidth);
        const scaleX = d3.scaleLinear().domain([minVal, maxVal]).range([0, drawWidth]).clamp(true);

        // Pre-calculate legend height to center bar vertically against it
        const numSegments = globalResolvedThresholds.length + 1;
        const legendTotalHeight = showLegend ? numSegments * Math.round(16 * widthScale) : 0;

        let currentY = margin.top;

        const mainG = this.container.append("g")
            .attr("transform", `translate(${margin.left}, 0)`);

        const overrideValue = s.marker.overrideValue.value;
        const finalValue = (overrideValue != null && overrideValue !== ("" as any)) ? overrideValue as number : indicator.value;

        // If legend is shown and taller than bar, center bar vertically relative to legend
        const barOffsetY = (showLegend && legendTotalHeight > barH) ? Math.round((legendTotalHeight - barH) / 2) : 0;

        // ── Panel KPI izquierdo (valor formateado + etiqueta "Objetivo") ───────
        // Usa KpiPanelCard: fontFamily, bold, italic, colores y tamaños propios.
        if (hasFormatText) {
            const kpiG = mainG.append("g")
                .attr("transform", `translate(0, ${currentY + barOffsetY})`);

            kpiG.append("text")
                .attr("x", 0)
                .attr("y", kpiValueFontSize)
                .attr("dominant-baseline", "auto")
                .attr("text-anchor", "start")
                .attr("font-size", `${kpiValueFontSize}px`)
                .attr("font-weight", kpiFontWeight)
                .attr("font-style", kpiFontStyle)
                .attr("font-family", kpiFontFamily)
                .attr("fill", kpiValueColor)
                .text(formatTextDisplay);

            kpiG.append("text")
                .attr("x", 0)
                .attr("y", kpiValueFontSize + kpiLabelFontSize + 4)
                .attr("dominant-baseline", "auto")
                .attr("text-anchor", "start")
                .attr("font-size", `${kpiLabelFontSize}px`)
                .attr("font-weight", kpiFontWeight)
                .attr("font-style", kpiFontStyle)
                .attr("font-family", kpiFontFamily)
                .attr("fill", kpiLabelColor)
                .text("Objetivo");
        }
        // ────────────────────────────────────────────────────────────────────

        const entryG = mainG.append("g")
            .attr("transform", `translate(${leftPanelWidth}, ${currentY + barOffsetY})`);

        if (showName) {
            const dataView = options.dataViews?.[0];
            const measureCol = dataView?.categorical?.values?.find(v => v.source.roles["measure"]);
            const indicatorName = measureCol ? measureCol.source.displayName : "Indicador";

            entryG.append("text")
                .attr("x", 0)
                .attr("y", -8)
                .attr("font-size", `${Math.round(fontSize * widthScale)}px`)
                .attr("font-weight", "500")
                .attr("fill", fontColor)
                .text(indicatorName);
        }

        // ── Guardar segmentos para getFormattingModel ─────────────────────────
        this.lastSegments = segments;
        this.settings.segmentColors.numColors.value = segments.length;

        const allColorSlices = [
            s.segmentColors.c1,  s.segmentColors.c2,  s.segmentColors.c3,
            s.segmentColors.c4,  s.segmentColors.c5,  s.segmentColors.c6,
            s.segmentColors.c7,  s.segmentColors.c8,  s.segmentColors.c9,
            s.segmentColors.c10, s.segmentColors.c11, s.segmentColors.c12,
            s.segmentColors.c13, s.segmentColors.c14, s.segmentColors.c15,
            s.segmentColors.c16, s.segmentColors.c17, s.segmentColors.c18,
            s.segmentColors.c19, s.segmentColors.c20
        ];

        segments.forEach((seg, i) => {
            if (i >= allColorSlices.length) return;
            const current = allColorSlices[i].value?.value;
            if (!current || current.trim() === "") {
                allColorSlices[i].value = { value: seg.color };
            }
        });
        // ─────────────────────────────────────────────────────────────────────

        this.drawVectorBar(entryG, finalValue, segments, globalResolvedThresholds, scaleX, barH, radius,
            markerColor, markerHeightVal, markerThickness, showLabel, showTicks, unit, fontSize, fontColor, minVal, maxVal,
            indicator.target, targetColor, targetWidth, showTarget);

        // ── Leyenda lateral derecha ───────────────────────────────────────────
        if (showLegend) {
            const legendG = mainG.append("g").attr("transform", `translate(${leftPanelWidth + drawWidth + 15}, ${currentY + 5})`);

            let legY = 0;

            segments.forEach((seg, i) => {
                // ── buildLegendLabel con signos (portado del gauge) ───────────
                const labelStr = this.buildLegendLabel(
                    seg,
                    i,
                    segments.length,
                    ascending,
                    unit,
                    showLegendSigns
                );

                legendG.append("circle")
                    .attr("cx", 0)
                    .attr("cy", legY - 3)
                    .attr("r", Math.round(5 * widthScale))
                    .attr("fill", seg.color);

                legendG.append("text")
                    .attr("x", Math.round(12 * widthScale))
                    .attr("y", legY)
                    .attr("font-size", `${Math.round(Math.max(10, fontSize - 2) * widthScale)}px`)
                    .attr("fill", fontColor)
                    .attr("font-weight", "500")
                    .text(labelStr);

                legY += Math.round(16 * widthScale);
            });
            currentY = Math.max(currentY + barOffsetY + barH + 35, currentY + 5 + legY);
        } else {
            currentY += barH + 35;
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
        markerHeightVal: number,
        markerThickness: number,
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

        const actualMarkerHeight = Math.max(barH + 8, markerHeightVal);
        const topOverflow = (actualMarkerHeight - barH) / 2;

        group.append("rect")
            .attr("x", markerPos - markerThickness / 2)
            .attr("y", -topOverflow)
            .attr("width", markerThickness)
            .attr("height", actualMarkerHeight)
            .attr("fill", markerColor)
            .attr("rx", 1.5)
            .attr("ry", 1.5);

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
                .attr("y", -topOverflow - 6)
                .attr("font-size", `${Math.max(9, fontSize - 2)}px`)
                .attr("fill", fontColor)
                .attr("text-anchor", "middle")
                .text(`${value}${unit}`);

            const textLen = (`${value}${unit}`.length * (fontSize - 2) * 0.6) + 4;
            group.insert("rect", "text:last-child")
                .attr("x", markerPos - textLen / 2)
                .attr("y", -topOverflow - 6 - (fontSize - 2))
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
        
        // Sincronizar el panel de colores con el número real de segmentos
        const n = this.lastSegments.length;
        this.settings.segmentColors.numColors.value = n;
        this.settings.segmentColors.updateVisibleSlices();

        // Renombrar cada picker con el rango del segmento
        const allColorSlices = [
            this.settings.segmentColors.c1,  this.settings.segmentColors.c2,
            this.settings.segmentColors.c3,  this.settings.segmentColors.c4,
            this.settings.segmentColors.c5,  this.settings.segmentColors.c6,
            this.settings.segmentColors.c7,  this.settings.segmentColors.c8,
            this.settings.segmentColors.c9,  this.settings.segmentColors.c10,
            this.settings.segmentColors.c11, this.settings.segmentColors.c12,
            this.settings.segmentColors.c13, this.settings.segmentColors.c14,
            this.settings.segmentColors.c15, this.settings.segmentColors.c16,
            this.settings.segmentColors.c17, this.settings.segmentColors.c18,
            this.settings.segmentColors.c19, this.settings.segmentColors.c20
        ];
        this.lastSegments.forEach((seg, i) => {
            if (i >= allColorSlices.length) return;
            allColorSlices[i].displayName = `Seg. ${i + 1}  (${seg.start} – ${seg.end})`;
        });

        this.settings.order.slices = [
            this.settings.order.ascending
        ];

        this.settings.marker.slices = [
            this.settings.marker.color,
            this.settings.marker.width,
            this.settings.marker.thickness,
            this.settings.marker.overrideValue,
            this.settings.marker.showLabel
        ];

        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
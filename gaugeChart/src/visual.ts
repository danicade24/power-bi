"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService, formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                  = powerbi.extensibility.visual.IVisual;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import DataView                 = powerbi.DataView;

interface SingleIndicatorData {
    value:          number;
    target?:        number | null;
    dataMin?:       number | null;
    dataMax?:       number | null;
    dataThresholds: number[];
    formatText?:    string | null;
    zoneLabel?:     string | null;
    segmentLabels:  string[];
}

interface Segment {
    start: number;
    end:   number;
    color: string;
}

export class Visual implements IVisual {
    private static clipIdCounter = 0;
    private host:                      IVisualHost;
    private container:                 d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private settings:                  VisualSettings;
    private formattingSettingsService: FormattingSettingsService;
    private lastSegments:              Segment[] = [];

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.container = d3
            .select(options.element)
            .append("svg")
            .classed("hsb-svg-container", true)
            .style("width",       "100%")
            .style("height",      "100%")
            .style("font-family", "Segoe UI, sans-serif");
    }

    public update(options: VisualUpdateOptions): void {
        console.log("DATOS RECIBIDOS DE PBI:", options.dataViews);
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

        this.render(indicator, options.viewport.width, options.viewport.height, options);
    }

    private extractData(dataView: DataView): SingleIndicatorData | null {
        const cat = dataView.categorical;

        let measureCol:       powerbi.DataViewValueColumn;
        let targetCol:        powerbi.DataViewValueColumn;
        let minCol:           powerbi.DataViewValueColumn;
        let maxCol:           powerbi.DataViewValueColumn;
        let thresholdCols:    powerbi.DataViewValueColumn[] = [];
        let segmentLabelCols: powerbi.DataViewValueColumn[] = [];
        let formatTextStr:    string | null = null;
        let zoneLabelStr:     string | null = null;

        cat.values?.forEach(valueCol => {
            if (valueCol.source.roles["measure"])       measureCol = valueCol;
            if (valueCol.source.roles["target"])        targetCol  = valueCol;
            if (valueCol.source.roles["min"])           minCol     = valueCol;
            if (valueCol.source.roles["max"])           maxCol     = valueCol;
            if (valueCol.source.roles["thresholds"])    thresholdCols.push(valueCol);
            if (valueCol.source.roles["segmentLabels"]) segmentLabelCols.push(valueCol);

            if (valueCol.source.roles["formatText"]) {
                const tv = valueCol.values[0];
                formatTextStr = tv != null ? String(tv) : null;
            }
            if (valueCol.source.roles["zoneLabel"]) {
                const tv = valueCol.values[0];
                zoneLabelStr = tv != null && String(tv).trim() !== "" ? String(tv) : null;
            }
        });

        if (!measureCol) return null;

        const getVal = (col: powerbi.DataViewValueColumn | undefined) => {
            const v = col?.values[0];
            if (v == null || v === "") return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
        };

        const dataThresholds  = thresholdCols.map(col => getVal(col)).filter(v => v != null) as number[];
        const segmentLabels   = segmentLabelCols.map(col => {
            const v = col.values[0];
            return (v == null || v === "") ? "" : String(v).trim();
        });

        return {
            value:         getVal(measureCol) ?? 0,
            target:        getVal(targetCol),
            dataMin:       getVal(minCol),
            dataMax:       getVal(maxCol),
            dataThresholds,
            formatText:    formatTextStr,
            zoneLabel:     zoneLabelStr,
            segmentLabels
        };
    }

    private buildSegments(
        minVal:    number,
        maxVal:    number,
        ascending: boolean,
        tValues:   number[]
    ): Segment[] {
        let rootColors = ["#00A651", "#84C225", "#FFFF00", "#FFA500", "#FF5500", "#FF0000"];
        if (!ascending) rootColors = rootColors.slice().reverse();

        const colorScale      = d3.interpolateRgbBasis(rootColors);
        const validThresholds = tValues.filter(v => v > minVal && v < maxVal).sort((a, b) => a - b);
        const marks           = [minVal, ...validThresholds, maxVal];
        const numSegments     = marks.length - 1;
        const manualColors    = this.settings.segmentColors.getActiveColors();
        const segs: Segment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const t     = numSegments > 1 ? i / (numSegments - 1) : 1;
            const color = (manualColors[i] && manualColors[i].trim() !== "")
                ? manualColors[i]
                : colorScale(Math.max(0, Math.min(1, t)));
            segs.push({ start: marks[i], end: marks[i + 1], color });
        }
        return segs;
    }

    private buildLegendLabel(
        seg:           Segment,
        segIndex:      number,
        totalSegs:     number,
        segmentLabels: string[],
        ascending:     boolean,
        unit:          string
    ): string {
        const dataLabel = segmentLabels[segIndex];
        if (dataLabel && dataLabel.trim() !== "") {
            if (totalSegs === 1) return dataLabel;
            if (ascending) {
                return segIndex === 0 ? `< ${dataLabel}` : `\u2265 ${dataLabel}`;
            } else {
                return segIndex === totalSegs - 1 ? `< ${dataLabel}` : `\u2265 ${dataLabel}`;
            }
        }
        if (totalSegs === 1) return `${seg.start}${unit} \u2013 ${seg.end}${unit}`;
        if (segIndex === 0)             return `\u2264 ${seg.end}${unit}`;
        if (segIndex === totalSegs - 1) return `\u2265 ${seg.start}${unit}`;
        return `${seg.start} \u2013 ${seg.end}${unit}`;
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        this.container.append("text")
            .attr("x", options.viewport.width  / 2)
            .attr("y", options.viewport.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888").attr("font-size", "13px")
            .text(msg);
    }

    private render(
        indicator:  SingleIndicatorData,
        viewWidth:  number,
        viewHeight: number,
        options:    VisualUpdateOptions
    ): void {
        const s = this.settings;

        const arcThickness     = Math.max(8,  (s.bar.height.value      as number) ?? 22);
        const fontSize         = (s.labels.fontSize.value              as number) ?? 12;
        const fontColor        = (s.labels.fontColor.value  as any)?.value ?? "#333333";
        const markerColor      = (s.marker.color.value      as any)?.value ?? "#333333";
        const markerWidth      = (s.marker.width.value      as number) ?? 16;
        const showLabel        = s.marker.showLabel.value              as boolean;
        const targetColor      = (s.target.color.value      as any)?.value ?? "#ffffff";
        const targetWidth      = (s.target.width.value      as number) ?? 2;
        const showTarget       = s.target.show.value                   as boolean;
        const showName         = s.labels.showIndicatorName.value      as boolean;
        const showTicks        = s.bar.showThresholdTicks.value        as boolean;
        const showLegend       = s.bar.showLegend.value                as boolean;
        const unit             = (s.scale.unit.value        as string) ?? "";
        const kpiValueFontSize = (s.labels.kpiValueFontSize.value      as number) ?? 16;
        const kpiLabelFontSize = (s.labels.kpiLabelFontSize.value      as number) ?? 10;
        const ascending        = s.order.ascending.value               as boolean;

        // ── Min / max / thresholds ─────────────────────────────────────────────
        let dynamicMin = indicator.value;
        let dynamicMax = indicator.value;

        const rawManualThresholds = s.thresholdsConfig.getActiveThresholdsOrNulls();
        const manualThresholds    = rawManualThresholds.filter((t): t is number => t != null);

        if (indicator.target != null && !isNaN(indicator.target)) {
            if (indicator.target > dynamicMax) dynamicMax = indicator.target;
            if (indicator.target < dynamicMin) dynamicMin = indicator.target;
        }
        if (indicator.dataMax != null && !isNaN(indicator.dataMax) && indicator.dataMax > dynamicMax) dynamicMax = indicator.dataMax;
        if (indicator.dataMin != null && !isNaN(indicator.dataMin) && indicator.dataMin < dynamicMin) dynamicMin = indicator.dataMin;
        indicator.dataThresholds.forEach(t => { if (!isNaN(t)) { if (t > dynamicMax) dynamicMax = t; if (t < dynamicMin) dynamicMin = t; } });
        manualThresholds.forEach(t => { if (!isNaN(t)) { if (t > dynamicMax) dynamicMax = t; if (t < dynamicMin) dynamicMin = t; } });
        if (dynamicMax === dynamicMin) dynamicMax = dynamicMin + 1;

        let minVal = (s.scale.minValue.value != null && s.scale.minValue.value !== ("" as any))
            ? Number(s.scale.minValue.value)
            : (indicator.dataMin != null && !isNaN(indicator.dataMin) ? indicator.dataMin : dynamicMin);
        let maxVal = (s.scale.maxValue.value != null && s.scale.maxValue.value !== ("" as any))
            ? Number(s.scale.maxValue.value)
            : (indicator.dataMax != null && !isNaN(indicator.dataMax) ? indicator.dataMax : dynamicMax);
        if (minVal >= maxVal) maxVal = minVal + 1;

        const dataThresholds = indicator.dataThresholds.filter(t => !isNaN(t));
        const globalSet      = new Set<number>();
        dataThresholds.forEach(t => globalSet.add(t));
        manualThresholds.forEach(t => globalSet.add(t));
        const globalResolvedThresholds = Array.from(globalSet).sort((a, b) => a - b);

        // ── Segmentos ──────────────────────────────────────────────────────────
        const segments = this.buildSegments(minVal, maxVal, ascending, globalResolvedThresholds);
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
            const cur = allColorSlices[i].value?.value;
            if (!cur || cur.trim() === "") allColorSlices[i].value = { value: seg.color };
        });

        const overrideValue = s.marker.overrideValue.value;
        const finalValue    = (overrideValue != null && overrideValue !== ("" as any))
            ? overrideValue as number : indicator.value;

        // ── Panel KPI ──────────────────────────────────────────────────────────
        const rawFormatText    = indicator.formatText;
        const hasFormatText    = rawFormatText != null
            && String(rawFormatText).trim() !== ""
            && String(rawFormatText).trim() !== "null";
        const formatTextDisplay = hasFormatText ? String(rawFormatText) : "";
        const zoneLabelDisplay  = (indicator.zoneLabel && indicator.zoneLabel.trim() !== "")
            ? indicator.zoneLabel : "Objetivo";

        // ── Layout ─────────────────────────────────────────────────────────────
        const kpiScale       = Math.max(0.5, Math.min(2.5, viewWidth / 400));
        const kpiValueFs     = Math.round(kpiValueFontSize * kpiScale);
        const kpiLabelFs     = Math.round(kpiLabelFontSize * kpiScale);
        const kpiPanelWidth  = hasFormatText ? Math.max(60, kpiValueFs * 3.5) : 0;
        const kpiPanelHeight = kpiValueFs + kpiLabelFs + 8;
        const legendWidth    = showLegend ? Math.max(90, Math.round(110 * kpiScale)) : 0;

        const gaugeAreaWidth  = Math.max(60, viewWidth - kpiPanelWidth - legendWidth - 16);
        const gaugeAreaHeight = viewHeight;

        // Radio: el gauge ocupa un semicírculo + zona inferior de la abertura
        // Con 240° de arco, el punto más bajo está en ±60° desde abajo → sin(60°)=0.866 del radio
        // Ancho = 2*r, alto = r + r*sin(30°) = r*1.5  →  r = min(W/2, H/1.55)
        const radius   = Math.max(20, Math.min(gaugeAreaWidth / 2, gaugeAreaHeight / 1.55) - 2);
        const rInner   = radius * 0.60;   // 60% del radio exterior = dona gruesa
        const gaugePad = 8;

        // cy: el punto más bajo del arco es cy + radius * sin(60°) = cy + radius * 0.866
        // queremos que esté dentro del viewport
        const cy = Math.max(radius + gaugePad, viewHeight - radius * 0.55 - gaugePad);
        const cx = kpiPanelWidth + gaugeAreaWidth / 2;

        const mainG = this.container.append("g");

        // ── Panel KPI izquierdo ────────────────────────────────────────────────
        if (hasFormatText) {
            const kpiY = cy - kpiPanelHeight / 2;
            const kpiG = mainG.append("g").attr("transform", `translate(4, ${kpiY})`);

            kpiG.append("text")
                .attr("x", 0).attr("y", kpiValueFs)
                .attr("dominant-baseline", "auto").attr("text-anchor", "start")
                .attr("font-size", `${kpiValueFs}px`).attr("font-weight", "bold")
                .attr("fill", fontColor)
                .text(formatTextDisplay);

            kpiG.append("text")
                .attr("x", 0).attr("y", kpiValueFs + kpiLabelFs + 4)
                .attr("dominant-baseline", "auto").attr("text-anchor", "start")
                .attr("font-size", `${kpiLabelFs}px`).attr("font-weight", "600")
                .attr("fill", "#777")
                .text(zoneLabelDisplay);
        }

        // ── Nombre del indicador ───────────────────────────────────────────────
        if (showName) {
            const mc = options.dataViews?.[0]?.categorical?.values?.find(v => v.source.roles["measure"]);
            mainG.append("text")
                .attr("x", cx).attr("y", cy - radius - 6)
                .attr("text-anchor", "middle")
                .attr("font-size", `${Math.round(fontSize * kpiScale)}px`).attr("font-weight", "500")
                .attr("fill", fontColor)
                .text(mc ? mc.source.displayName : "Indicador");
        }

        // ── Gauge con la nueva lógica D3 ───────────────────────────────────────
        this.drawArcGauge(
            mainG, cx, cy, radius, rInner,
            finalValue, segments, globalResolvedThresholds,
            minVal, maxVal,
            markerColor, markerWidth,
            showLabel, showTicks,
            unit, fontSize, fontColor,
            indicator.target, targetColor, targetWidth, showTarget,
            kpiScale
        );

        // ── Leyenda derecha ────────────────────────────────────────────────────
        if (showLegend) {
            const legendX = kpiPanelWidth + gaugeAreaWidth + 8;
            const legendG = mainG.append("g")
                .attr("transform", `translate(${legendX}, ${cy - (segments.length * 16 * kpiScale) / 2})`);
            let legY = 0;

            segments.forEach((seg, i) => {
                const labelStr = this.buildLegendLabel(
                    seg, i, segments.length, indicator.segmentLabels, ascending, unit
                );
                legendG.append("circle")
                    .attr("cx", 0).attr("cy", legY - 3)
                    .attr("r", Math.round(5 * kpiScale)).attr("fill", seg.color);
                legendG.append("text")
                    .attr("x", Math.round(12 * kpiScale)).attr("y", legY)
                    .attr("font-size", `${Math.round(Math.max(9, fontSize - 1) * kpiScale)}px`)
                    .attr("fill", fontColor).attr("font-weight", "500")
                    .text(labelStr);
                legY += Math.round(16 * kpiScale);
            });
        }

        // ── Altura SVG ajustada ────────────────────────────────────────────────
        const ticksExtra  = showTicks ? Math.round(22 * kpiScale) : 0;
        const labelExtra  = showLabel ? Math.round(20 * kpiScale) : 0;
        const totalHeight = cy + radius * 0.58 + ticksExtra + labelExtra + gaugePad;
        this.container.style("height", `${Math.max(viewHeight, Math.ceil(totalHeight))}px`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // drawArcGauge — implementación exacta con d3.arc() y angleScale
    // Ángulos D3: 0 = arriba, positivo = sentido horario
    // angleMin = -120° = -2π/3   (extremo izquierdo del arco)
    // angleMax = +120° = +2π/3   (extremo derecho del arco)
    // Total = 240°
    // ─────────────────────────────────────────────────────────────────────────
    private drawArcGauge(
        g:           d3.Selection<SVGGElement, unknown, null, undefined>,
        cx:          number,
        cy:          number,
        radius:      number,
        rInner:      number,
        value:       number,
        segments:    Segment[],
        thresholds:  number[],
        minVal:      number,
        maxVal:      number,
        markerColor: string,
        markerWidth: number,
        showLabel:   boolean,
        showTicks:   boolean,
        unit:        string,
        fontSize:    number,
        fontColor:   string,
        targetValue?: number | null,
        targetColor?: string,
        targetWidth?: number,
        showTarget?:  boolean,
        scale:        number = 1
    ): void {

        // ── 1. Configuración de ángulos (D3 convention: 0=arriba, CW positivo) ─
        const angleMin = -120 * (Math.PI / 180);   // -2π/3 ≈ -2.094 rad
        const angleMax =  120 * (Math.PI / 180);   //  2π/3 ≈  2.094 rad

        // ── 2. Escala angular: dominio de datos → ángulos D3 ──────────────────
        const angleScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([angleMin, angleMax]);

        // ── 3. Generador de arcos D3 ───────────────────────────────────────────
        const arcGenerator = d3.arc()
            .innerRadius(rInner)
            .outerRadius(radius)
            .cornerRadius(0);

        // Grupo centrado en (cx, cy) — todo se dibuja desde (0,0)
        const gaugeG = g.append("g").attr("transform", `translate(${cx}, ${cy})`);

        // ── 4. Track de fondo (arco completo gris) ─────────────────────────────
        gaugeG.append("path")
            .attr("d", arcGenerator({
                startAngle: angleMin,
                endAngle:   angleMax,
                innerRadius: rInner,
                outerRadius: radius
            } as any))
            .attr("fill", "#e5e5e5");

        // ── 5. Segmentos de color ──────────────────────────────────────────────
        segments.forEach(seg => {
            const startAngle = angleScale(seg.start);
            const endAngle   = angleScale(seg.end);
            if (Math.abs(endAngle - startAngle) < 0.001) return;

            gaugeG.append("path")
                .attr("d", arcGenerator({
                    startAngle,
                    endAngle,
                    innerRadius: rInner,
                    outerRadius: radius
                } as any))
                .attr("fill", seg.color);
        });

        // ── 6. Ticks de umbral ─────────────────────────────────────────────────
        if (showTicks) {
            const validThresholds = thresholds.filter(t => t > minVal && t < maxVal);
            validThresholds.forEach(t => {
                const angle = angleScale(t);  // ángulo D3 (0=arriba, CW)
                // Convertir ángulo D3 a coordenadas XY: x = sin(a), y = -cos(a)
                const sinA = Math.sin(angle);
                const cosA = Math.cos(angle);

                const x1 = sinA * (rInner - 4),  y1 = -cosA * (rInner - 4);
                const x2 = sinA * (radius + 4),  y2 = -cosA * (radius + 4);

                gaugeG.append("line")
                    .attr("x1", x1).attr("y1", y1)
                    .attr("x2", x2).attr("y2", y2)
                    .attr("stroke", fontColor)
                    .attr("stroke-width", 1.5).attr("opacity", 0.6);

                // Etiqueta del tick
                const lblR = radius + Math.round(12 * scale);
                gaugeG.append("text")
                    .attr("x", sinA * lblR).attr("y", -cosA * lblR)
                    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                    .attr("font-size", `${Math.max(8, Math.round((fontSize - 2) * scale))}px`)
                    .attr("fill", fontColor).attr("opacity", 0.65)
                    .text(String(t));
            });
        }

        // ── 7. Etiquetas min / max en los extremos del arco ────────────────────
        const lblOffset = radius + Math.round(14 * scale);
        const minAngle  = angleMin;
        const maxAngle  = angleMax;

        gaugeG.append("text")
            .attr("x", Math.sin(minAngle) * lblOffset)
            .attr("y", -Math.cos(minAngle) * lblOffset)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .attr("font-size", `${Math.max(8, Math.round((fontSize - 1) * scale))}px`)
            .attr("fill", fontColor).attr("opacity", 0.6)
            .text(String(minVal));

        gaugeG.append("text")
            .attr("x", Math.sin(maxAngle) * lblOffset)
            .attr("y", -Math.cos(maxAngle) * lblOffset)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .attr("font-size", `${Math.max(8, Math.round((fontSize - 1) * scale))}px`)
            .attr("fill", fontColor).attr("opacity", 0.6)
            .text(String(maxVal));

        // ── 8. Target: línea radial sobre el arco ──────────────────────────────
        if (showTarget && targetValue != null && targetValue >= minVal && targetValue <= maxVal) {
            const angle = angleScale(targetValue);
            const sinA  = Math.sin(angle);
            const cosA  = Math.cos(angle);
            gaugeG.append("line")
                .attr("x1", sinA * (rInner - 2)).attr("y1", -cosA * (rInner - 2))
                .attr("x2", sinA * (radius + 2)).attr("y2", -cosA * (radius + 2))
                .attr("stroke", targetColor || "#ffffff")
                .attr("stroke-width", targetWidth || 2)
                .attr("stroke-linecap", "round");
        }

        // ── 9. Base semicircular de la aguja ───────────────────────────────────
        // Medio círculo gris oscuro de -90° a +90° (D3: -π/2 a +π/2)
        const baseRadius = Math.max(6, Math.round(markerWidth * 0.5));
        const baseArc    = d3.arc()
            .innerRadius(0)
            .outerRadius(baseRadius)
            .cornerRadius(0);

        gaugeG.append("path")
            .attr("d", baseArc({
                startAngle: -Math.PI / 2,
                endAngle:    Math.PI / 2,
                innerRadius: 0,
                outerRadius: baseRadius
            } as any))
            .attr("fill", "#444444");

        // ── 10. Aguja: línea que rota según angleScale(value) ──────────────────
        // La aguja se implementa como un grupo rotado — más limpio que calcular
        // las coordenadas XY manualmente y garantiza que el eje de rotación sea (0,0)
        const needleAngleDeg = angleScale(Math.max(minVal, Math.min(maxVal, value))) * (180 / Math.PI);
        const needleLength   = (rInner + radius) / 2;   // llega hasta el centro del arco
        const needleW        = Math.max(3, Math.round(markerWidth * 0.18));

        const needleG = gaugeG.append("g")
            .attr("transform", `rotate(${needleAngleDeg})`);

        // Polígono de la aguja: punta arriba (y negativo = arriba en SVG tras rotate)
        // base ancha en y=0 (el pivote), punta en y=-needleLength
        needleG.append("polygon")
            .attr("points", `0,${-needleLength} ${-needleW},0 ${needleW},0`)
            .attr("fill", markerColor)
            .attr("opacity", 0.95);

        // ── 11. Círculo pivot encima de todo ───────────────────────────────────
        gaugeG.append("circle")
            .attr("cx", 0).attr("cy", 0)
            .attr("r", baseRadius * 0.6)
            .attr("fill", markerColor);

        // ── 12. Etiqueta del valor actual ──────────────────────────────────────
        if (showLabel) {
            const lblY      = Math.round((rInner + radius) / 2 * 0.5);
            const labelText = `${value}${unit}`;
            const textW     = labelText.length * Math.round((fontSize + 2) * scale) * 0.62 + 8;
            const textH     = Math.round((fontSize + 4) * scale);

            gaugeG.append("rect")
                .attr("x", -textW / 2).attr("y", lblY - textH * 0.85)
                .attr("width", textW).attr("height", textH)
                .attr("fill", "rgba(255,255,255,0.85)").attr("rx", 3);

            gaugeG.append("text")
                .attr("x", 0).attr("y", lblY)
                .attr("text-anchor", "middle").attr("dominant-baseline", "auto")
                .attr("font-size", `${Math.round((fontSize + 2) * scale)}px`)
                .attr("font-weight", "600").attr("fill", fontColor)
                .text(labelText);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.settings.thresholdsConfig.updateVisibleSlices(false);

        const n = this.lastSegments.length;
        this.settings.segmentColors.numColors.value = n;
        this.settings.segmentColors.updateVisibleSlices();

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
            allColorSlices[i].displayName = `Seg. ${i + 1}  (${seg.start} \u2013 ${seg.end})`;
        });

        this.settings.order.slices  = [this.settings.order.ascending];
        this.settings.marker.slices = [
            this.settings.marker.color,
            this.settings.marker.width,
            this.settings.marker.overrideValue,
            this.settings.marker.showLabel
        ];

        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
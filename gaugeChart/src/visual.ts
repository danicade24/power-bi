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
    zoneLabel?: string | null;
    segmentLabels: string[];
}

interface Segment {
    start: number;
    end: number;
    color: string;
}

const ZONE_NAMES_ASC = [
    "Fuera de la Tolerancia",
    "Tolerancia 3",
    "Tolerancia 2",
    "Tolerancia 1",
    "Apetito",
    "Objetivo"
].reverse();

export class Visual implements IVisual {
    private static clipIdCounter = 0;
    private host: IVisualHost;
    private container: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;
    private lastSegments: Segment[] = [];
    private lastSegmentLabels: string[] = [];

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

        let measureCol: powerbi.DataViewValueColumn;
        let targetCol: powerbi.DataViewValueColumn;
        let minCol: powerbi.DataViewValueColumn;
        let maxCol: powerbi.DataViewValueColumn;
        let thresholdCols: powerbi.DataViewValueColumn[] = [];
        let segmentLabelCols: powerbi.DataViewValueColumn[] = [];
        let formatTextStr: string | null = null;
        let zoneLabelStr: string | null = null;

        cat.values?.forEach(col => {
            if (col.source.roles["measure"]) measureCol = col;
            if (col.source.roles["target"]) targetCol = col;
            if (col.source.roles["min"]) minCol = col;
            if (col.source.roles["max"]) maxCol = col;
            if (col.source.roles["thresholds"]) thresholdCols.push(col);
            if (col.source.roles["segmentLabels"]) segmentLabelCols.push(col);
            if (col.source.roles["formatText"]) {
                const v = col.values[0];
                formatTextStr = v != null ? String(v) : null;
            }
            if (col.source.roles["zoneLabel"]) {
                const v = col.values[0];
                zoneLabelStr = (v != null && String(v).trim() !== "") ? String(v) : null;
            }
        });

        if (!measureCol) return null;

        const getVal = (col: powerbi.DataViewValueColumn | undefined) => {
            const v = col?.values[0];
            if (v == null || v === "") return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
        };

        return {
            value: getVal(measureCol) ?? 0,
            target: getVal(targetCol),
            dataMin: getVal(minCol),
            dataMax: getVal(maxCol),
            dataThresholds: thresholdCols.map(c => getVal(c)).filter(v => v != null) as number[],
            formatText: formatTextStr,
            zoneLabel: zoneLabelStr,
            segmentLabels: segmentLabelCols.map(c => {
                const v = c.values[0];
                return (v == null || v === "") ? "" : String(v).trim();
            })
        };
    }

    private buildSegments(minVal: number, maxVal: number, ascending: boolean, tValues: number[]): Segment[] {
        let rootColors = ["#00A651", "#84C225", "#FFFF00", "#FFA500", "#FF5500", "#FF0000"];
        if (!ascending) rootColors = rootColors.slice().reverse();

        const colorScale = d3.interpolateRgbBasis(rootColors);
        const validThresholds = tValues.filter(v => v > minVal && v < maxVal).sort((a, b) => a - b);
        const marks = [minVal, ...validThresholds, maxVal];
        const numSegments = marks.length - 1;
        const manualColors = this.settings.segmentColors.getActiveColors();
        const segs: Segment[] = [];

        for (let i = 0; i < numSegments; i++) {
            const t = numSegments > 1 ? i / (numSegments - 1) : 1;
            const color = (manualColors[i] && manualColors[i].trim() !== "")
                ? manualColors[i]
                : colorScale(Math.max(0, Math.min(1, t)));
            segs.push({ start: marks[i], end: marks[i + 1], color });
        }
        return segs;
    }

    private resolveZoneName(value: number, segments: Segment[], ascending: boolean, daxZone: string | null): string {
        if (daxZone && daxZone.trim() !== "") return daxZone;
        if (segments.length === 0) return "Objetivo";

        let segIndex = segments.findIndex((seg, i) =>
            i < segments.length - 1
                ? value >= seg.start && value < seg.end
                : value >= seg.start && value <= seg.end
        );
        if (segIndex === -1) segIndex = value <= segments[0].start ? 0 : segments.length - 1;

        const nameIndex = ascending ? segIndex : (segments.length - 1 - segIndex);
        const clampedIndex = Math.max(0, Math.min(nameIndex, ZONE_NAMES_ASC.length - 1));
        return ZONE_NAMES_ASC[clampedIndex];
    }

    private buildLegendLabel(
        seg: Segment, segIndex: number, totalSegs: number,
        segmentLabels: string[], ascending: boolean, unit: string, showSigns: boolean
    ): string {
        const labelFromData = (segmentLabels[segIndex] && segmentLabels[segIndex].trim() !== "")
            ? segmentLabels[segIndex] : null;

        // parseFloat quita ceros finales (30.0 → 30, 35.5 → 35.5)
        // Si el valor es decimal <1, multiplica x100 para mostrar porcentaje
        const fmt = (n: number): string => {
            if (n !== 0 && Math.abs(n) < 1) return `${parseFloat((n * 100).toFixed(1))}%`;
            return `${parseFloat(n.toFixed(1))}`;
        };

        // ── Sin signos ────────────────────────────────────────────────────────
        if (!showSigns) {
            if (labelFromData) return labelFromData;
            return `${fmt(seg.start)} \u2013 ${fmt(seg.end)}${unit}`;
        }

        // ── Con etiquetas del dataset ─────────────────────────────────────────
        if (labelFromData) {
            if (totalSegs === 1) return labelFromData;
            if (ascending) {
                return segIndex === totalSegs - 1
                    ? `> ${labelFromData}`
                    : `\u2264 ${labelFromData}`;
            } else {
                return segIndex === 0
                    ? `< ${labelFromData}`
                    : `\u2265 ${labelFromData}`;
            }
        }

        // ── Fallback numérico ─────────────────────────────────────────────────
        if (totalSegs === 1) return `${fmt(seg.start)} \u2013 ${fmt(seg.end)}${unit}`;

        if (ascending) {
            return segIndex === totalSegs - 1
                ? `> ${fmt(seg.start)}${unit}`
                : `\u2264 ${fmt(seg.end)}${unit}`;
        } else {
            return segIndex === 0
                ? `< ${fmt(seg.end)}${unit}`
                : `\u2265 ${fmt(seg.start)}${unit}`;
        }
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        this.container.append("text")
            .attr("x", options.viewport.width / 2)
            .attr("y", options.viewport.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888").attr("font-size", "13px")
            .text(msg);
    }

    private render(indicator: SingleIndicatorData, viewWidth: number, viewHeight: number, options: VisualUpdateOptions): void {
        const s = this.settings;
        this.lastSegmentLabels = indicator.segmentLabels || [];

        // ── Leer settings ──────────────────────────────────────────────────────
        const arcThickness = Math.max(8, (s.bar.height.value as number) ?? 22);
        const fontSize = (s.labels.fontSize.value as number) ?? 12;
        const fontColor = (s.labels.fontColor.value as any)?.value ?? "#333333";
        const markerColor = (s.marker.color.value as any)?.value ?? "#333333";
        const markerWidth = (s.marker.width.value as number) ?? 16;
        const showLabel = s.marker.showLabel.value as boolean;
        const targetColor = (s.target.color.value as any)?.value ?? "#ffffff";
        const targetWidth = (s.target.width.value as number) ?? 2;
        const showTarget = s.target.show.value as boolean;
        const showName = s.labels.showIndicatorName.value as boolean;
        const showTicks = s.bar.showThresholdTicks.value as boolean;
        const showLegend = s.bar.showLegend.value as boolean;
        const showLegendSigns = s.bar.showLegendSigns.value as boolean;
        const unit = (s.scale.unit.value as string) ?? "";
        const ascending = s.order.ascending.value as boolean;

        // ── KPI panel settings ─────────────────────────────────────────────────
        const kpi = s.kpiPanel;
        const kpiFontFamily = (kpi.fontFamily.value as string) || "Segoe UI";
        const kpiBold = kpi.bold.value as boolean;
        const kpiItalic = kpi.italic.value as boolean;
        const kpiFontWeight = kpiBold ? "bold" : "normal";
        const kpiFontStyle = kpiItalic ? "italic" : "normal";
        const valueFs = (kpi.valueFontSize.value as number) ?? 28;
        const zoneFs = (kpi.zoneFontSize.value as number) ?? 13;
        const legendFs = (kpi.legendFontSize.value as number) ?? 11;
        const valueColor = (kpi.valueColor.value as any)?.value ?? "#1a1a1a";
        const zoneColor = (kpi.zoneColor.value as any)?.value ?? "#555555";
        const legendColor = (kpi.legendColor.value as any)?.value ?? "#333333";

        // ── Min / max / thresholds ─────────────────────────────────────────────
        let dynamicMin = indicator.value;
        let dynamicMax = indicator.value;

        const rawManual = s.thresholdsConfig.getActiveThresholdsOrNulls();
        const manualThresh = rawManual.filter((t): t is number => t != null);

        if (indicator.target != null && !isNaN(indicator.target)) {
            dynamicMax = Math.max(dynamicMax, indicator.target);
            dynamicMin = Math.min(dynamicMin, indicator.target);
        }
        if (indicator.dataMax != null && !isNaN(indicator.dataMax)) dynamicMax = Math.max(dynamicMax, indicator.dataMax);
        if (indicator.dataMin != null && !isNaN(indicator.dataMin)) dynamicMin = Math.min(dynamicMin, indicator.dataMin);
        indicator.dataThresholds.forEach(t => { if (!isNaN(t)) { dynamicMax = Math.max(dynamicMax, t); dynamicMin = Math.min(dynamicMin, t); } });
        manualThresh.forEach(t => { if (!isNaN(t)) { dynamicMax = Math.max(dynamicMax, t); dynamicMin = Math.min(dynamicMin, t); } });
        if (dynamicMax === dynamicMin) dynamicMax = dynamicMin + 1;

        let minVal = (s.scale.minValue.value != null && s.scale.minValue.value !== ("" as any))
            ? Number(s.scale.minValue.value)
            : (indicator.dataMin != null ? indicator.dataMin : dynamicMin);
        let maxVal = (s.scale.maxValue.value != null && s.scale.maxValue.value !== ("" as any))
            ? Number(s.scale.maxValue.value)
            : (indicator.dataMax != null ? indicator.dataMax : dynamicMax);
        if (minVal >= maxVal) maxVal = minVal + 1;

        const globalSet = new Set<number>();
        indicator.dataThresholds.filter(t => !isNaN(t)).forEach(t => globalSet.add(t));
        manualThresh.forEach(t => globalSet.add(t));
        const globalThresholds = Array.from(globalSet).sort((a, b) => a - b);

        // ── Segmentos ──────────────────────────────────────────────────────────
        const segments = this.buildSegments(minVal, maxVal, ascending, globalThresholds);
        this.lastSegments = segments;
        this.settings.segmentColors.numColors.value = segments.length;

        const allColorSlices = [
            s.segmentColors.c1, s.segmentColors.c2, s.segmentColors.c3,
            s.segmentColors.c4, s.segmentColors.c5, s.segmentColors.c6,
            s.segmentColors.c7, s.segmentColors.c8, s.segmentColors.c9,
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
        const finalValue = (overrideValue != null && overrideValue !== ("" as any))
            ? overrideValue as number : indicator.value;

        // ── Zona ───────────────────────────────────────────────────────────────
        const zoneLabelDisplay = this.resolveZoneName(finalValue, segments, ascending, indicator.zoneLabel);

        // ── Texto formateado ───────────────────────────────────────────────────
        const rawFmt = indicator.formatText;
        const hasFormatText = rawFmt != null && String(rawFmt).trim() !== "" && String(rawFmt).trim() !== "null";
        const fmtDisplay = hasFormatText ? String(rawFmt) : "";

        // ── Layout ─────────────────────────────────────────────────────────────
        const scale = Math.max(0.5, Math.min(2.5, viewWidth / 400));
        
        // Consistencia de Escala: Aplicamos el ratio a las fuentes
        const scValueFs = Math.max(10, Math.round(valueFs * scale));
        const scZoneFs  = Math.max(9, Math.round(zoneFs * scale));
        const scLegendFs = Math.max(9, Math.round(legendFs * scale));

        const legendWidth = showLegend ? Math.max(80, scLegendFs * 9) : 0;
        const gaugeAreaWidth = Math.max(60, viewWidth - legendWidth - 8);
        
        // Aprovechar espacio: El KPI ahora va "DENTRO" del arco, no restamos al container
        const gaugeAreaHeight = Math.max(60, viewHeight - 10);

        const radius = Math.max(20, Math.min(gaugeAreaWidth / 2, gaugeAreaHeight / 1.55) - 2);
        const rInner = radius * 0.60;
        const pad = 8;

        // Centro del gauge: cx centrado en el área del gauge (sin leyenda)
        const cx = gaugeAreaWidth / 2;
        // cy: el arco baja hasta cy + radius*sin(30°), queremos que quepa en gaugeAreaHeight
        const cy = Math.max(radius + pad, gaugeAreaHeight - radius * 0.55 - pad);

        const mainG = this.container.append("g");

        // ── Nombre del indicador ───────────────────────────────────────────────
        if (showName) {
            const mc = options.dataViews?.[0]?.categorical?.values?.find(v => v.source.roles["measure"]);
            mainG.append("text")
                .attr("x", cx).attr("y", cy - radius - 6)
                .attr("text-anchor", "middle")
                .attr("font-size", `${Math.round(fontSize * scale)}px`)
                .attr("font-weight", "500")
                .attr("fill", fontColor)
                .text(mc ? mc.source.displayName : "Indicador");
        }

        // ── Gauge ──────────────────────────────────────────────────────────────
        this.drawArcGauge(
            mainG, cx, cy, radius, rInner,
            finalValue, segments, globalThresholds,
            minVal, maxVal,
            markerColor, markerWidth,
            showLabel, showTicks,
            unit, fontSize, fontColor,
            indicator.target, targetColor, targetWidth, showTarget,
            scale
        );

        // ── Panel KPI DENTRO del arco ─────────────────────────────────────────
        // Posicionamiento dinámico debajo de la aguja aprovechando el espacio vacío
        const baseR = Math.max(6, Math.round(markerWidth * 0.5)); 
        const kpiBaseY = cy + baseR + (radius * 0.08);

        if (hasFormatText) {
            mainG.append("text")
                .attr("x", cx)
                .attr("y", kpiBaseY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("font-size", `${scValueFs}px`)
                .attr("font-weight", kpiFontWeight)
                .attr("font-style", kpiFontStyle)
                .attr("font-family", kpiFontFamily)
                .attr("fill", valueColor)
                .text(fmtDisplay);

            mainG.append("text")
                .attr("x", cx)
                .attr("y", kpiBaseY + scValueFs + (radius * 0.05))
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("font-size", `${scZoneFs}px`)
                .attr("font-weight", kpiFontWeight)
                .attr("font-style", kpiFontStyle)
                .attr("font-family", kpiFontFamily)
                .attr("fill", zoneColor)
                .text(zoneLabelDisplay);
        } else {
            mainG.append("text")
                .attr("x", cx)
                .attr("y", kpiBaseY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("font-size", `${scZoneFs}px`)
                .attr("font-weight", kpiFontWeight)
                .attr("font-style", kpiFontStyle)
                .attr("font-family", kpiFontFamily)
                .attr("fill", zoneColor)
                .text(zoneLabelDisplay);
        }

        // ── Leyenda derecha ────────────────────────────────────────────────────
        if (showLegend) {

            const legendX = gaugeAreaWidth + 8;
            const rectHeight = scLegendFs + 10;
            const rectWidth = Math.max(10, Math.round(12 * scale));
            const totalLegendHeight = segments.length * rectHeight;

            // Bounding box vertical del tacómetro: cy - radius (tope) hasta cy + radius*0.5 (base)
            const arcCenterY = cy - radius * 0.25;

            const legendG = mainG.append("g")
                .attr("transform", `translate(${legendX}, ${arcCenterY - totalLegendHeight / 2})`);

            let legY = 0;

            const segmentsToUse = segments;
            segmentsToUse.forEach((seg, i) => {

                const labelStr = this.buildLegendLabel(

                    seg,
                    i,
                    segments.length,
                    indicator.segmentLabels,
                    ascending,
                    unit,
                    showLegendSigns
                );

                // Rectángulo contiguo sin bordes redondeados ni espacio extra

                legendG.append("rect")
                    .attr("x", 0)
                    .attr("y", legY)
                    .attr("width", rectWidth)
                    .attr("height", rectHeight)
                    .attr("fill", seg.color);

                // Texto centrado verticalmente respecto al rectángulo

                legendG.append("text")
                    .attr("x", rectWidth + 8)
                    .attr("y", legY + rectHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("font-size", `${scLegendFs}px`)
                    .attr("font-weight", kpiFontWeight)
                    .attr("font-style", kpiFontStyle)
                    .attr("font-family", kpiFontFamily)
                    .attr("fill", legendColor)
                    .text(labelStr);
                legY += rectHeight;

            });

        }

        // ── Altura SVG ajustada ────────────────────────────────────────────────
        const totalHeight = kpiBaseY + (hasFormatText ? scValueFs + scZoneFs + (radius * 0.05) : scZoneFs);
        this.container.style("height", `${Math.max(viewHeight, Math.ceil(totalHeight))}px`);
    }

    private drawArcGauge(
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        cx: number, cy: number, radius: number, rInner: number,
        value: number, segments: Segment[], thresholds: number[],
        minVal: number, maxVal: number,
        markerColor: string, markerWidth: number,
        showLabel: boolean, showTicks: boolean,
        unit: string, fontSize: number, fontColor: string,
        targetValue?: number | null, targetColor?: string, targetWidth?: number, showTarget?: boolean,
        scale: number = 1
    ): void {
        const angleMin = -120 * (Math.PI / 180);
        const angleMax = 120 * (Math.PI / 180);

        const angleScale = d3.scaleLinear().domain([minVal, maxVal]).range([angleMin, angleMax]);
        const arcGen = d3.arc().innerRadius(rInner).outerRadius(radius).cornerRadius(0);
        const gaugeG = g.append("g").attr("transform", `translate(${cx}, ${cy})`);

        // Track fondo
        gaugeG.append("path")
            .attr("d", arcGen({ startAngle: angleMin, endAngle: angleMax, innerRadius: rInner, outerRadius: radius } as any))
            .attr("fill", "#e5e5e5");

        // Segmentos
        segments.forEach(seg => {
            const sa = angleScale(seg.start);
            const ea = angleScale(seg.end);
            if (Math.abs(ea - sa) < 0.001) return;
            gaugeG.append("path")
                .attr("d", arcGen({ startAngle: sa, endAngle: ea, innerRadius: rInner, outerRadius: radius } as any))
                .attr("fill", seg.color);
        });

        // Ticks
        if (showTicks) {
            thresholds.filter(t => t > minVal && t < maxVal).forEach(t => {
                const a = angleScale(t);
                const sinA = Math.sin(a), cosA = Math.cos(a);
                gaugeG.append("line")
                    .attr("x1", sinA * (rInner - 4)).attr("y1", -cosA * (rInner - 4))
                    .attr("x2", sinA * (radius + 4)).attr("y2", -cosA * (radius + 4))
                    .attr("stroke", fontColor).attr("stroke-width", 1.5).attr("opacity", 0.6);
                const lr = radius + Math.round(12 * scale);
                gaugeG.append("text")
                    .attr("x", sinA * lr).attr("y", -cosA * lr)
                    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                    .attr("font-size", `${Math.max(8, Math.round((fontSize - 2) * scale))}px`)
                    .attr("fill", fontColor).attr("opacity", 0.65)
                    .text(String(t));
            });
        }

        // Target
        if (showTarget && targetValue != null && targetValue >= minVal && targetValue <= maxVal) {
            const a = angleScale(targetValue);
            const sinA = Math.sin(a), cosA = Math.cos(a);
            gaugeG.append("line")
                .attr("x1", sinA * (rInner - 2)).attr("y1", -cosA * (rInner - 2))
                .attr("x2", sinA * (radius + 2)).attr("y2", -cosA * (radius + 2))
                .attr("stroke", targetColor || "#ffffff")
                .attr("stroke-width", targetWidth || 2)
                .attr("stroke-linecap", "round");
        }

        // Base semicircular
        const baseR = Math.max(6, Math.round(markerWidth * 0.5));
        const baseArc = d3.arc().innerRadius(0).outerRadius(baseR).cornerRadius(0);
        gaugeG.append("path")
            .attr("d", baseArc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2, innerRadius: 0, outerRadius: baseR } as any))
            .attr("fill", "#444444");

        // Aguja
        const needleDeg = angleScale(Math.max(minVal, Math.min(maxVal, value))) * (180 / Math.PI);
        const needleLen = (rInner + radius) / 2;
        const needleW = Math.max(3, Math.round(markerWidth * 0.18));

        gaugeG.append("g")
            .attr("transform", `rotate(${needleDeg})`)
            .append("polygon")
            .attr("points", `0,${-needleLen} ${-needleW},0 ${needleW},0`)
            .attr("fill", markerColor).attr("opacity", 0.95);

        gaugeG.append("circle")
            .attr("cx", 0).attr("cy", 0)
            .attr("r", baseR * 0.6)
            .attr("fill", markerColor);

        // Etiqueta valor (dentro del arco, opcional)
        if (showLabel) {
            const lblY = Math.round((rInner + radius) / 2 * 0.5);
            const lbl = `${value}${unit}`;
            const tw = lbl.length * Math.round((fontSize + 2) * scale) * 0.62 + 8;
            const th = Math.round((fontSize + 4) * scale);
            gaugeG.append("rect")
                .attr("x", -tw / 2).attr("y", lblY - th * 0.85)
                .attr("width", tw).attr("height", th)
                .attr("fill", "rgba(255,255,255,0.85)").attr("rx", 3);
            gaugeG.append("text")
                .attr("x", 0).attr("y", lblY)
                .attr("text-anchor", "middle").attr("dominant-baseline", "auto")
                .attr("font-size", `${Math.round((fontSize + 2) * scale)}px`)
                .attr("font-weight", "600").attr("fill", fontColor)
                .text(lbl);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.settings.thresholdsConfig.updateVisibleSlices(false);

        const n = this.lastSegments.length;
        this.settings.segmentColors.numColors.value = n;
        this.settings.segmentColors.updateVisibleSlices();

        const allColorSlices = [
            this.settings.segmentColors.c1, this.settings.segmentColors.c2,
            this.settings.segmentColors.c3, this.settings.segmentColors.c4,
            this.settings.segmentColors.c5, this.settings.segmentColors.c6,
            this.settings.segmentColors.c7, this.settings.segmentColors.c8,
            this.settings.segmentColors.c9, this.settings.segmentColors.c10,
            this.settings.segmentColors.c11, this.settings.segmentColors.c12,
            this.settings.segmentColors.c13, this.settings.segmentColors.c14,
            this.settings.segmentColors.c15, this.settings.segmentColors.c16,
            this.settings.segmentColors.c17, this.settings.segmentColors.c18,
            this.settings.segmentColors.c19, this.settings.segmentColors.c20
        ];
        this.lastSegments.forEach((seg, i) => {
            if (i >= allColorSlices.length) return;
            const label = (this.lastSegmentLabels[i] && this.lastSegmentLabels[i].trim() !== "")
                ? this.lastSegmentLabels[i]
                : `Seg. ${i + 1}  (${seg.start} – ${seg.end})`;
            allColorSlices[i].displayName = label;
        });

        this.settings.order.slices = [this.settings.order.ascending];
        this.settings.marker.slices = [
            this.settings.marker.color,
            this.settings.marker.width,
            this.settings.marker.overrideValue,
            this.settings.marker.showLabel
        ];

        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
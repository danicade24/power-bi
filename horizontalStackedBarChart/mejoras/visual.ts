"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings, getActiveThresholds, ThresholdDef } from "./settings";

import VisualConstructorOptions   = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions        = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                    = powerbi.extensibility.visual.IVisual;
import IVisualHost                = powerbi.extensibility.visual.IVisualHost;
import DataView                   = powerbi.DataView;

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface IndicatorData {
    name: string;
    value: number;
    period?: string;
}

interface Segment {
    start: number;    // valor absoluto donde arranca
    end:   number;    // valor absoluto donde termina
    color: string;
    label: string;
    pctWidth: number; // fracción [0,1] del ancho total
}

// ─── Visual ───────────────────────────────────────────────────────────────────
export class Visual implements IVisual {

    private host:                    IVisualHost;
    private container:               d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private settings:                VisualSettings;
    private formattingSettingsService: FormattingSettingsService;

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.container = d3
            .select(options.element)
            .append("div")
            .classed("hsb-container", true)
            .style("width", "100%")
            .style("overflow-y", "auto")
            .style("font-family", "Segoe UI, sans-serif");
    }

    // ── Update — llamado por Power BI cada vez que cambian datos o tamaño ─────
    public update(options: VisualUpdateOptions): void {
        // 1. Leer configuración del panel de formato
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings,
            options.dataViews
        );

        const dataView: DataView = options.dataViews?.[0];
        if (!dataView?.categorical?.categories?.length) {
            this.renderEmpty("Arrastra un campo a «Indicador» y una medida a «Valor actual»");
            return;
        }

        // 2. Extraer datos del dataView
        const indicators = this.extractData(dataView);
        if (!indicators.length) {
            this.renderEmpty("Sin datos");
            return;
        }

        // 3. Calcular segmentos a partir de los umbrales configurados
        const s       = this.settings;
        const minVal  = (s.scale.minValue.value as number) ?? 0;
        const maxVal  = (s.scale.maxValue.value as number) ?? 100;
        const range   = maxVal - minVal || 1;
        const thresholds = getActiveThresholds(s);
        const segments   = this.buildSegments(thresholds, minVal, maxVal, range, s.order.ascending.value as boolean);

        // 4. Render
        this.render(indicators, segments, minVal, maxVal, range, options);
    }

    // ── Extraer indicadores del dataView categorical ──────────────────────────
    private extractData(dataView: DataView): IndicatorData[] {
        const cat     = dataView.categorical;
        const names   = cat.categories[0]?.values ?? [];
        const periods = cat.categories[1]?.values ?? [];
        const values  = cat.values?.[0]?.values ?? [];

        return names.map((name, i) => ({
            name:   String(name ?? ""),
            value:  Number(values[i] ?? 0),
            period: periods[i] != null ? String(periods[i]) : undefined,
        }));
    }

    // ── Construir segmentos entre umbrales ────────────────────────────────────
    private buildSegments(
        thresholds: ThresholdDef[],
        minVal: number,
        maxVal: number,
        range: number,
        ascending: boolean
    ): Segment[] {
        if (!thresholds.length) {
            return [{ start: minVal, end: maxVal, color: "#cccccc", label: "Sin umbrales", pctWidth: 1 }];
        }

        // Asegurar que el último umbral cubra hasta maxVal
        const sorted = [...thresholds].sort((a, b) => a.value - b.value);
        if (sorted[sorted.length - 1].value < maxVal) {
            sorted.push({ value: maxVal, color: sorted[sorted.length - 1].color, label: "" });
        }

        const segs: Segment[] = [];
        let prev = minVal;
        for (const t of sorted) {
            const end    = Math.min(t.value, maxVal);
            const width  = Math.max(0, end - prev);
            segs.push({
                start:    prev,
                end,
                color:    t.color,
                label:    t.label,
                pctWidth: width / range,
            });
            prev = end;
            if (end >= maxVal) break;
        }

        return ascending ? segs : [...segs].reverse();
    }

    // ── Render principal ──────────────────────────────────────────────────────
    private render(
        indicators: IndicatorData[],
        segments:   Segment[],
        minVal:     number,
        maxVal:     number,
        range:      number,
        options:    VisualUpdateOptions
    ): void {
        const s        = this.settings;
        const barH     = Math.max(8, (s.bar.height.value as number) ?? 20);
        const radius   = (s.bar.borderRadius.value as number) ?? 4;
        const fontSize = (s.labels.fontSize.value as number) ?? 12;
        const fontColor    = (s.labels.fontColor.value as any)?.value ?? "#333333";
        const markerColor  = (s.marker.color.value as any)?.value ?? "#1a1a1a";
        const markerWidth  = (s.marker.width.value as number) ?? 3;
        const showLabel    = s.marker.showLabel.value as boolean;
        const showName     = s.labels.showIndicatorName.value as boolean;
        const showTicks    = s.bar.showThresholdTicks.value as boolean;
        const showLegend   = s.bar.showLegend.value as boolean;
        const unit         = (s.scale.unit.value as string) ?? "";

        this.container.selectAll("*").remove();
        this.container.style("padding", "12px 16px");

        // Agrupar indicadores por período si existe
        const grouped = this.groupByName(indicators);

        grouped.forEach(({ name, entries }) => {
            const rowDiv = this.container.append("div")
                .style("margin-bottom", "20px");

            // — Encabezado —
            if (showName) {
                const lastEntry = entries[entries.length - 1];
                const header = rowDiv.append("div")
                    .style("display", "flex")
                    .style("justify-content", "space-between")
                    .style("margin-bottom", "4px");

                header.append("span")
                    .style("font-size", `${fontSize}px`)
                    .style("font-weight", "500")
                    .style("color", fontColor)
                    .text(name);

                if (showLabel) {
                    header.append("span")
                        .style("font-size", `${fontSize - 1}px`)
                        .style("color", fontColor)
                        .style("opacity", "0.7")
                        .text(`${lastEntry.value}${unit}`);
                }
            }

            // — Barra principal (último valor / valor único) —
            const mainValue = entries[entries.length - 1].value;
            this.renderBar(rowDiv, mainValue, segments, minVal, maxVal, range,
                barH, radius, markerColor, markerWidth, showLabel, showTicks, unit, fontSize, fontColor);

            // — Historial por período (barras mini) —
            if (entries.length > 1) {
                const histDiv = rowDiv.append("div").style("margin-top", "8px");
                histDiv.append("div")
                    .style("font-size", `${fontSize - 2}px`)
                    .style("color", fontColor)
                    .style("opacity", "0.5")
                    .style("margin-bottom", "4px")
                    .text("Historial");

                entries.forEach(entry => {
                    const periodRow = histDiv.append("div")
                        .style("display", "flex")
                        .style("align-items", "center")
                        .style("gap", "8px")
                        .style("margin-bottom", "4px");

                    periodRow.append("span")
                        .style("font-size", `${fontSize - 2}px`)
                        .style("color", fontColor)
                        .style("opacity", "0.6")
                        .style("min-width", "40px")
                        .text(entry.period ?? "");

                    const miniWrap = periodRow.append("div").style("flex", "1");
                    this.renderBar(miniWrap, entry.value, segments, minVal, maxVal, range,
                        Math.round(barH * 0.6), Math.round(radius * 0.6),
                        markerColor, Math.max(1, markerWidth - 1),
                        false, false, unit, fontSize - 2, fontColor);

                    periodRow.append("span")
                        .style("font-size", `${fontSize - 2}px`)
                        .style("color", fontColor)
                        .style("opacity", "0.6")
                        .style("min-width", "36px")
                        .style("text-align", "right")
                        .text(`${entry.value}${unit}`);
                });
            }
        });

        // — Leyenda global —
        if (showLegend) {
            const legendDiv = this.container.append("div")
                .style("display", "flex")
                .style("flex-wrap", "wrap")
                .style("gap", "12px")
                .style("margin-top", "8px");

            // Deduplicate segments by label
            const seen = new Set<string>();
            segments.forEach(seg => {
                if (!seg.label || seen.has(seg.label)) return;
                seen.add(seg.label);
                const item = legendDiv.append("div")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("gap", "4px");
                item.append("div")
                    .style("width", "12px")
                    .style("height", "12px")
                    .style("border-radius", "2px")
                    .style("background", seg.color);
                item.append("span")
                    .style("font-size", `${fontSize - 1}px`)
                    .style("color", fontColor)
                    .style("opacity", "0.7")
                    .text(seg.label);
            });
        }
    }

    // ── Render de una barra individual ────────────────────────────────────────
    private renderBar(
        parent: d3.Selection<HTMLDivElement, unknown, null, undefined>,
        value: number,
        segments: Segment[],
        minVal:   number,
        maxVal:   number,
        range:    number,
        barH:     number,
        radius:   number,
        markerColor: string,
        markerWidth: number,
        showLabel: boolean,
        showTicks: boolean,
        unit:      string,
        fontSize:  number,
        fontColor: string
    ): void {
        const markerH = barH + 8;
        const markerPct = Math.max(0, Math.min(100, ((value - minVal) / range) * 100));

        const wrap = parent.append("div")
            .style("position", "relative")
            .style("height", `${markerH}px`);

        // Barra segmentada
        const barRow = wrap.append("div")
            .style("display", "flex")
            .style("width", "100%")
            .style("height", `${barH}px`)
            .style("margin-top", "4px")
            .style("border-radius", `${radius}px`)
            .style("overflow", "hidden");

        segments.forEach((seg, i) => {
            barRow.append("div")
                .style("flex", `${seg.pctWidth}`)
                .style("background", seg.color)
                .style("opacity", "0.88");
        });

        // Marcador
        wrap.append("div")
            .style("position", "absolute")
            .style("left", `${markerPct}%`)
            .style("top", "0")
            .style("transform", "translateX(-50%)")
            .style("width", `${markerWidth}px`)
            .style("height", `${markerH}px`)
            .style("background", markerColor)
            .style("border-radius", "2px")
            .style("pointer-events", "none");

        // Etiqueta flotante del marcador
        if (showLabel) {
            const labelDiv = wrap.append("div")
                .style("position", "absolute")
                .style("left", `${markerPct}%`)
                .style("top", "-16px")
                .style("transform", "translateX(-50%)")
                .style("font-size", `${Math.max(9, fontSize - 2)}px`)
                .style("color", fontColor)
                .style("white-space", "nowrap")
                .style("background", "rgba(255,255,255,0.85)")
                .style("padding", "1px 4px")
                .style("border-radius", "3px")
                .style("pointer-events", "none")
                .text(`${value}${unit}`);
        }

        // Ticks de umbral
        if (showTicks) {
            const ticksDiv = parent.append("div")
                .style("position", "relative")
                .style("height", "14px");

            // Obtener umbrales reordenados para que los ticks coincidan
            // con la escala visual (siempre de izquierda a derecha = minVal→maxVal)
            getActiveThresholds(this.settings).forEach(t => {
                const pct = Math.max(0, Math.min(100, ((t.value - minVal) / range) * 100));
                ticksDiv.append("span")
                    .style("position", "absolute")
                    .style("left", `${pct}%`)
                    .style("transform", "translateX(-50%)")
                    .style("font-size", `${Math.max(8, fontSize - 3)}px`)
                    .style("color", fontColor)
                    .style("opacity", "0.55")
                    .text(String(t.value));
            });
        }
    }

    // ── Agrupar filas por nombre de indicador ─────────────────────────────────
    private groupByName(indicators: IndicatorData[]): { name: string; entries: IndicatorData[] }[] {
        const map = new Map<string, IndicatorData[]>();
        for (const ind of indicators) {
            const key = ind.name;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ind);
        }
        return Array.from(map.entries()).map(([name, entries]) => ({ name, entries }));
    }

    // ── Render de estado vacío ────────────────────────────────────────────────
    private renderEmpty(msg: string): void {
        this.container.selectAll("*").remove();
        this.container
            .style("display", "flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("min-height", "80px")
            .append("span")
            .style("font-size", "13px")
            .style("color", "#888")
            .text(msg);
    }

    // ── API de formato (necesario para el panel de formato de Power BI) ───────
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}

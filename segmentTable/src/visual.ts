"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService, formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";
import { VARIABLE_CONFIG } from "./dictionaries/index";
import { buildBarModel } from "./utils/barModel";
import { mapNumberToRating } from "./dictionaries/ratings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

// ── Representa una fila de la tabla ──────────────────────────────────────────
interface TableRowData {
    label: string;
    group?: string;           // nombre del grupo (opcional)
    valueNumeric: number | null;
    valueText: string | null;
    target?: number | null;
    scale?: number | null;
    formatText?: string | null;
    measureName?: string;
}

interface SegmentVisual {
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

    // Segmentos del último render (para getFormattingModel)
    private lastSegments: SegmentVisual[] = []; 

    // Estado para re-render al colapsar/expandir grupos
    private lastRows: TableRowData[] = [];
    private lastWidth: number = 400;
    private lastHeight: number = 300;
    private collapsedGroups: Set<string> = new Set(); // vacío = todos expandidos

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
        
        const s = this.formattingSettingsService.populateFormattingSettingsModel(VisualSettings, options.dataViews?.[0]);
        const fontFamily = (s.labels?.fontFamily?.value as string) ?? "Segoe UI, wf_segoe-ui_regular, sans-serif";
        this.container.style("font-family", fontFamily);

        this.container.selectAll("*").remove();

        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings,
            options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];
        if (!dataView?.categorical) {
            this.renderEmpty("Faltan datos", options);
            return;
        }

        const rows = this.extractTableData(dataView);
        if (!rows || rows.length === 0) {
            this.renderEmpty("Faltan datos", options);
            return;
        }

        // Guardar estado para re-render en collapse/expand
        this.lastRows   = rows;
        this.lastWidth  = options.viewport.width;
        this.lastHeight = options.viewport.height;

        this.renderTable(rows, options.viewport.width, options.viewport.height);
    }

    // ── Extrae todas las filas del dataView tabular ───────────────────────────
    private extractTableData(dataView: DataView): TableRowData[] {
        const cat = dataView.categorical;
        if (!cat) return [];

        let valNumCol:  powerbi.DataViewValueColumn | undefined;
        let valTextCol: powerbi.DataViewValueColumn | undefined;
        let targetCol:  powerbi.DataViewValueColumn | undefined;
        let scaleCol:   powerbi.DataViewValueColumn | undefined;
        let formatTextCol: powerbi.DataViewValueColumn | undefined;

        if (cat.values) {
            cat.values.forEach(valueCol => {
                if (valueCol.source.roles["value_numeric"]) valNumCol     = valueCol;
                if (valueCol.source.roles["value_text"])    valTextCol    = valueCol;
                if (valueCol.source.roles["target"])     targetCol     = valueCol;
                if (valueCol.source.roles["scale"])      scaleCol      = valueCol;
                if (valueCol.source.roles["formatText"]) formatTextCol = valueCol;
            });
        }

        const labelCat = cat.categories?.find(c => c.source.roles["label"]);
        const groupCat = cat.categories?.find(c => c.source.roles["group"]);
        
        if (!labelCat && !valNumCol && !valTextCol) return [];

        const numRows  = labelCat
            ? labelCat.values.length
            : ((valNumCol ? valNumCol.values.length : (valTextCol ? valTextCol.values.length : 1)));

        const getNumAt = (col: powerbi.DataViewValueColumn | undefined, i: number): number | null => {
            if (!col) return null;
            const v = col.values[i];
            if (v == null || v === "") return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
        };

        const getRawValAt = (col: powerbi.DataViewValueColumn | undefined, i: number): number | string | null => {
            if (!col) return null;
            const v = col.values[i];
            if (v == null || v === "") return null;
            if (typeof v === "number") return v;
            const num = Number(v);
            return isNaN(num) ? String(v).trim() : num;
        };

        const getTextAt = (col: powerbi.DataViewValueColumn | undefined, i: number): string | null => {
            if (!col) return null;
            const v = col.values[i];
            if (v == null || String(v).trim() === "") return null;
            return String(v).trim();
        };

        const rows: TableRowData[] = [];

        let measureName = "";
        if (valNumCol && valNumCol.source.displayName) measureName = valNumCol.source.displayName;
        else if (valTextCol && valTextCol.source.displayName) measureName = valTextCol.source.displayName;

        for (let i = 0; i < numRows; i++) {
            const rawValNum = getNumAt(valNumCol, i);
            const rawValText = getTextAt(valTextCol, i);

            const label = labelCat
                ? (labelCat.values[i] != null ? String(labelCat.values[i]) : `Fila ${i + 1}`)
                : (measureName || `Fila ${i + 1}`);

            const group = groupCat
                ? (groupCat.values[i] != null ? String(groupCat.values[i]) : undefined)
                : undefined;

            const rawFmt = formatTextCol ? formatTextCol.values[i] : null;
            const formatText = (rawFmt != null && String(rawFmt).trim() !== "" && String(rawFmt).trim() !== "null")
                ? String(rawFmt) : null;

            rows.push({
                label, group,
                valueNumeric:   rawValNum,
                valueText:      rawValText,
                target:         getNumAt(targetCol, i),
                scale:          getNumAt(scaleCol, i),
                formatText,
                measureName
            });
        }

        return rows;
    }

    // ── Construye los segmentos de color para una barra ───────────────────────
    private buildSegments(
        minVal: number, maxVal: number,
        ascending: boolean, invertColors: boolean,
        tValues: number[]
    ): SegmentVisual[] {
        const validThresholds = tValues
            .filter(v => v > minVal && v < maxVal)
            .sort((a, b) => a - b);

        const marks = [minVal, ...validThresholds, maxVal];
        const numSegments = marks.length - 1;

        let rootColors = ['#FF0000', '#FF5500', '#FFA500', '#FFFF00', '#84C225', '#00A651'];
        if (numSegments >= 10) {
            rootColors = ['#4A4559', '#A2423D', '#FF0000', '#FFA500', '#FFFF00',
                          '#FFF59D', '#D4E157', '#81C784', '#00A651', '#006400'];
        }
        if (invertColors) rootColors = rootColors.slice().reverse();

        const colorScale   = d3.interpolateRgbBasis(rootColors);
        const manualColors = this.settings.segmentColors.getActiveColors();
        const segs: SegmentVisual[] = [];

        for (let i = 0; i < numSegments; i++) {
            const relMid = numSegments > 1 ? i / (numSegments - 1) : 1;
            let color = manualColors[i];
            if (!color || color.trim() === "") color = colorScale(Math.max(0, Math.min(1, relMid)));
            segs.push({ start: marks[i], end: marks[i + 1], color });
        }

        return segs;
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        this.container.append("text")
            .attr("x", options.viewport.width  / 2)
            .attr("y", options.viewport.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888")
            .attr("font-size", "13px")
            .text(msg);
    }

    // ── Renderiza la tabla completa ───────────────────────────────────────────
    private renderTable(rows: TableRowData[], viewWidth: number, viewHeight: number): void {
        const s = this.settings;

        // ── Configuración general ─────────────────────────────────────────────
        const barH            = Math.max(8, (s.bar.height.value as number) ?? 20);
        const radius          = (s.bar.borderRadius.value as number) ?? 4;
        
        const labelFontSize   = (s.labels.labelFontSize.value as number) ?? 8;
        const labelFontColor  = (s.labels.labelFontColor.value as any)?.value ?? "#333333";
        const valueFontSize   = (s.labels.valueFontSize.value as number) ?? 12;
        const valueFontColor  = (s.labels.valueFontColor.value as any)?.value ?? "#333333";
        
        const markerColor     = (s.marker.color.value as any)?.value ?? "#1a1a1a";
        const markerHeightVal = (s.marker.width.value as number) ?? 16;
        const markerThickness = (s.marker.thickness.value as number) ?? 3;
        const showLabel       = s.marker.showLabel.value as boolean;
        const targetColor     = (s.target.color.value as any)?.value ?? "#ffffff";
        const targetWidth     = (s.target.width.value as number) ?? 2;
        const showTarget      = s.target.show.value as boolean;
        const showTicks       = s.bar.showThresholdTicks.value as boolean;
        const unit            = (s.scale.unit.value as string) ?? "";
        const ascending       = s.order.ascending.value as boolean;
        const invertColors    = s.order.invertColors.value as boolean;
        const rowSpacing      = Math.max(0, (s.bar.rowSpacing?.value as number) ?? 0);
        const invertGroups    = s.groupHeader?.invertGroupOrder?.value as boolean;
        const overrideValue   = s.marker.overrideValue.value;

        // ── Anchos de columna ─────────────────────────────────────────────────
        const labelPct  = Math.max(5, Math.min(50, (s.labels.labelColWidth?.value as number) ?? 25)) / 100;
        const margin    = { top: 8, right: 8, bottom: 12, left: 8 };
        const totalW    = viewWidth - margin.left - margin.right;
        const labelColW = Math.round(totalW * labelPct);

        // Calcular ancho de col de valor según el texto más largo en los datos.
        // Así funciona bien tanto para números cortos como para textos largos,
        // y se adapta al redimensionar porque totalW cambia con el viewport.
        const longestValue = rows.reduce((max, row) => {
            const rowVal = row.valueNumeric != null ? row.valueNumeric : row.valueText;
            const finalValue = (overrideValue != null && overrideValue !== ("" as any))
                ? (overrideValue as number | string)
                : rowVal;
            
            const bModel = buildBarModel(row.label, finalValue, row.scale);
            let txt = "";
            if (bModel !== null) {
                if (row.valueNumeric != null) {
                    txt = Math.floor(row.valueNumeric).toString() + unit;
                } else if (bModel.label) {
                    txt = bModel.label;
                } else {
                    txt = typeof finalValue === "string" ? finalValue.replace(/&/g, "/") : String(finalValue);
                }
            } else {
                const parsedNum = Number(finalValue);
                if (finalValue != null && finalValue !== "" && !isNaN(parsedNum)) {
                    const ratingStr = mapNumberToRating(parsedNum);
                    if (ratingStr) {
                        txt = ratingStr;
                    } else {
                        txt = Math.floor(parsedNum).toString() + unit;
                    }
                } else {
                    txt = typeof finalValue === "string" ? finalValue.replace(/&/g, "/") : String(finalValue);
                }
            }
            return txt.length > max.length ? txt : max;
        }, "");
        const valueColW = Math.max(
            40,                                               // mínimo absoluto
            Math.round(totalW * 0.08),                       // mínimo 8% del ancho
            Math.round(longestValue.length * valueFontSize * 0.58 + 12) // según texto más largo
        );

        const barColW   = Math.max(20, totalW - labelColW - valueColW - 3);

        // ── Configuración de cabecera de grupo ────────────────────────────────
        const ghBg  = (s.groupHeader?.bgColor?.value as any)?.value ?? "#eef1f6";
        const ghTxt = (s.groupHeader?.fontColor?.value as any)?.value ?? "#2c4a72";
        const ghFs  = (s.groupHeader?.fontSize?.value as number) ?? 11;
        const ghH   = Math.max(18, (s.groupHeader?.headerHeight?.value as number) ?? 26);

        // ── Agrupar filas ─────────────────────────────────────────────────────
        const groupOrder: string[]                   = [];
        const groupedRows: Map<string, TableRowData[]> = new Map();
        const noGroupRows: TableRowData[]            = [];
        const hasGroups = rows.some(r => r.group);

        rows.forEach(row => {
            if (row.group) {
                if (!groupedRows.has(row.group)) {
                    groupedRows.set(row.group, []);
                    groupOrder.push(row.group);
                }
                groupedRows.get(row.group)!.push(row);
            } else {
                noGroupRows.push(row);
            }
        });

        if (invertGroups) {
            groupOrder.reverse();
        }

        // ── Ordenar filas: las que tienen barra primero, las sin barra al final ─
        // Una fila "tiene barra" si su valor es numérico o está en el diccionario,
        // Y además tiene al menos un umbral definido.
        const rowHasBar = (row: TableRowData): boolean => {
            const config = VARIABLE_CONFIG[(row.label || "").toLowerCase().trim()];
            if (!config) return false;
            const finalValue = row.valueNumeric != null ? row.valueNumeric : row.valueText;
            if (finalValue == null) return false;
            const isNum = typeof finalValue === "number";
            const isMapped = typeof finalValue === "string" && config.valueMap && config.valueMap[finalValue.toLowerCase().trim()] !== undefined;
            return isNum || isMapped;
        };

        const sortRows = (arr: TableRowData[]): TableRowData[] =>
            [...arr].sort((a, b) => {
                const aBar = rowHasBar(a) ? 0 : 1;
                const bBar = rowHasBar(b) ? 0 : 1;
                return aBar - bBar;  // con barra (0) antes que sin barra (1)
            });

        // Aplicar orden a filas sin grupo y a cada grupo
        const sortedNoGroupRows = sortRows(noGroupRows);
        groupOrder.forEach(g => {
            groupedRows.set(g, sortRows(groupedRows.get(g)!));
        });

        let maxSegmentsFound: SegmentVisual[] = [];
        let currentY   = margin.top;

        // ── Renderizador de una sola fila ─────────────────────────────────────
        // Devuelve los píxeles consumidos (altura de fila + rowSpacing).
        const renderOneRow = (
            row: TableRowData,
            rowY: number,
            showTopSep: boolean,
            indented: boolean
        ): number => {
            const rowVal = row.valueNumeric != null ? row.valueNumeric : row.valueText;
            const finalValue = (overrideValue != null && overrideValue !== ("" as any))
                ? (overrideValue as number | string)
                : rowVal;
            
            const hasValue = finalValue != null;
            const barModel = buildBarModel(row.label, finalValue, row.scale);
            
            const hasBar = barModel !== null;
            const isBold = !hasBar;
            
            let minVal = 0, maxVal = 1;
            const resolvedThresholds: number[] = [];
            let numericVal: number | null = null;
            let isNumeric = typeof finalValue === "number";

            if (hasBar && barModel) {
                minVal = barModel.min;
                maxVal = barModel.max;
                numericVal = barModel.position;
                
                for (let i = 1; i < barModel.segments.length; i++) {
                    resolvedThresholds.push(barModel.segments[i].from);
                }
            }

            const config = VARIABLE_CONFIG[(row.label || "").toLowerCase().trim()];
            const higherIsBetter = config?.higherIsBetter === true;
            
            const rowAscending = higherIsBetter ? !ascending : ascending;
            const rowInvertColors = higherIsBetter ? !invertColors : invertColors;

            const segments = this.buildSegments(minVal, maxVal, rowAscending, rowInvertColors, resolvedThresholds);

            if (segments.length > maxSegmentsFound.length) {
                maxSegmentsFound = segments;
            }

            const scaleDomain = rowAscending ? [minVal, maxVal] : [maxVal, minVal];
            const scaleX = d3.scaleLinear().domain(scaleDomain).range([0, barColW]).clamp(true);

            const markerOverflow = Math.max(0, (Math.max(barH + 8, markerHeightVal) - barH) / 2);
            const labelOverflow  = showLabel ? Math.max(9, labelFontSize - 2) + 8 : 0;
            const topPad         = Math.max(markerOverflow, labelOverflow) + 4;
            const bottomPad      = markerOverflow + (showTicks ? 20 : 4);
            const rowH           = topPad + barH + bottomPad;

            const rowG = this.container.append("g")
                .attr("transform", `translate(${margin.left}, ${rowY})`);

            // Fondo blanco de la fila
            rowG.append("rect")
                .attr("x", 0).attr("y", 0)
                .attr("width", totalW).attr("height", rowH)
                .attr("fill", "#ffffff");

            // Separador superior
            if (showTopSep) {
                rowG.append("line")
                    .attr("x1", 0).attr("y1", 0)
                    .attr("x2", totalW).attr("y2", 0)
                    .attr("stroke", "#e5eaf0").attr("stroke-width", 1);
            }

            // Col 1 — Etiqueta
            const labelX = indented ? 20 : 0;
            rowG.append("text")
                .attr("x", labelX)
                .attr("y", topPad + barH / 2)
                .attr("dominant-baseline", "middle")
                .attr("font-size", `${labelFontSize}px`)
                .attr("font-weight", isBold ? "bold" : "normal")
                .attr("fill", labelFontColor)
                .text(row.label);

            if (hasValue) {
                // Col 2 — Valor: muestra la etiqueta compuesta o el formated string
                let displayedText = "";
                if (hasBar) {
                    if (isNumeric) {
                        displayedText = Math.floor(finalValue as number).toString();
                        displayedText = `${displayedText}${unit}`;
                    } else if (barModel && barModel.label) {
                        displayedText = barModel.label;
                    } else {
                        displayedText = typeof finalValue === "string" ? finalValue.replace(/&/g, "/") : String(finalValue);
                    }
                } else {
                	const parsedNum = Number(finalValue);
                    if (finalValue != null && finalValue !== "" && !isNaN(parsedNum)) {
                        const ratingStr = mapNumberToRating(parsedNum);
                        if (ratingStr) {
                            displayedText = ratingStr;
                        } else {
                            displayedText = Math.floor(parsedNum).toString();
                            displayedText = `${displayedText}${unit}`;
                        }
                    } else {
                        displayedText = typeof finalValue === "string" ? finalValue.replace(/&/g, "/") : String(finalValue);
                    }
                }

                rowG.append("text")
                    .attr("x", labelColW + valueColW / 2)
                    .attr("y", topPad + barH / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "middle")
                    .attr("font-size", `${valueFontSize}px`)
                    .attr("font-weight", isBold ? "bold" : "normal")
                    .attr("fill", valueFontColor)
                    .text(displayedText);

                if (hasBar) {
                    // Col 3 — Barra: usa numericVal (número directo o mapeado del diccionario)
                    const barG = rowG.append("g")
                        .attr("transform", `translate(${labelColW + valueColW}, ${topPad})`);

                    const tItems: powerbi.extensibility.VisualTooltipDataItem[] = [];
                    if (row.valueNumeric != null) {
                        tItems.push({ displayName: row.measureName || "Value", value: String(row.valueNumeric) + unit });
                    } else if (row.valueText != null) {
                        tItems.push({ displayName: row.measureName || "Category", value: row.valueText.replace(/&/g, "/") });
                    }
                    if (row.scale != null) {
                        tItems.push({ displayName: "Scale / Impact", value: String(row.scale) });
                    }

                    this.drawVectorBar(
                        barG, numericVal!, segments, resolvedThresholds, scaleX,
                        barH, radius, markerColor, markerHeightVal, markerThickness,
                        showLabel, showTicks, unit, valueFontSize, valueFontColor,
                        minVal, maxVal, row.target, targetColor, targetWidth, showTarget,
                        displayedText, tItems
                    );
                }
            }

            return rowH + rowSpacing;
        };

        // ── Filas sin grupo ───────────────────────────────────────────────────
        sortedNoGroupRows.forEach((row, i) => {
            currentY += renderOneRow(row, currentY, i > 0, false);
        });

        if (sortedNoGroupRows.length > 0 && groupOrder.length > 0) {
            currentY += 4;
        }

        // ── Grupos colapsables ────────────────────────────────────────────────
        groupOrder.forEach((groupName, gIdx) => {
            const groupRows  = groupedRows.get(groupName)!;
            const isCollapsed = this.collapsedGroups.has(groupName);

            // ── Cabecera del grupo ────────────────────────────────────────────
            const ghG = this.container.append("g")
                .attr("transform", `translate(${margin.left}, ${currentY})`);

            // Fondo de la cabecera
            ghG.append("rect")
                .attr("x", 0).attr("y", 0)
                .attr("width", totalW).attr("height", ghH)
                .attr("fill", ghBg)
                .attr("rx", 2).attr("ry", 2)
                .style("cursor", "pointer");

            // Línea inferior de cabecera
            ghG.append("line")
                .attr("x1", 0).attr("y1", ghH)
                .attr("x2", totalW).attr("y2", ghH)
                .attr("stroke", "#c5d0de").attr("stroke-width", 1)
                .style("pointer-events", "none");

            // Ícono ▼ / ▶
            ghG.append("text")
                .attr("x", 8)
                .attr("y", ghH / 2)
                .attr("dominant-baseline", "middle")
                .attr("font-size", "9px")
                .attr("fill", ghTxt)
                .style("pointer-events", "none")
                .text(isCollapsed ? "▶" : "▼");

            // Nombre del grupo
            ghG.append("text")
                .attr("x", 22)
                .attr("y", ghH / 2)
                .attr("dominant-baseline", "middle")
                .attr("font-size", `${ghFs}px`)
                .attr("font-weight", "700")
                .attr("letter-spacing", "0.4px")
                .attr("fill", ghTxt)
                .style("pointer-events", "none")
                .text(groupName);

            // Contador de indicadores cuando está colapsado
            if (isCollapsed) {
                const badge = `${groupRows.length} indicador${groupRows.length !== 1 ? "es" : ""}`;
                ghG.append("text")
                    .attr("x", totalW - 8)
                    .attr("y", ghH / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "end")
                    .attr("font-size", `${Math.max(9, ghFs - 1)}px`)
                    .attr("fill", ghTxt)
                    .attr("opacity", 0.65)
                    .style("pointer-events", "none")
                    .text(badge);
            }

            // Click handler en toda la cabecera
            ghG.style("cursor", "pointer")
                .on("click", () => {
                    if (this.collapsedGroups.has(groupName)) {
                        this.collapsedGroups.delete(groupName);
                    } else {
                        this.collapsedGroups.add(groupName);
                    }
                    this.container.selectAll("*").remove();
                    this.renderTable(this.lastRows, this.lastWidth, this.lastHeight);
                });

            currentY += ghH;

            // ── Filas del grupo si está expandido ────────────────────────────
            if (!isCollapsed) {
                groupRows.forEach((row, i) => {
                    currentY += renderOneRow(row, currentY, i > 0, hasGroups);
                });
                currentY += 2; // pequeño margen al final del grupo expandido
            }

            // Separación entre grupos
            if (gIdx < groupOrder.length - 1) currentY += 6;
        });
        
        this.lastSegments = maxSegmentsFound;

        // ── Altura total del SVG ──────────────────────────────────────────────
        this.container.style("height", `${Math.max(viewHeight, currentY + margin.bottom)}px`);
    }

    // ── Renderiza una barra individual (sin cambios) ──────────────────────────
    private drawVectorBar(
        group: d3.Selection<SVGGElement, unknown, null, undefined>,
        value: number,
        segments: SegmentVisual[],
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
        showTarget?: boolean,
        markerTextLabel?: string,
        tooltipItems?: powerbi.extensibility.VisualTooltipDataItem[]
    ): void {

        radius = 0;
        const clipId = "clip-" + (++Visual.clipIdCounter);
        const totalW = Math.abs(scaleX(maxVal) - scaleX(minVal));

        group.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", totalW).attr("height", barH)
            .attr("rx", radius).attr("ry", radius);

        const barGroup = group.append("g").attr("clip-path", `url(#${clipId})`);

        segments.forEach(seg => {
            const x1 = scaleX(seg.start), x2 = scaleX(seg.end);
            const x  = Math.min(x1, x2), w = Math.abs(x2 - x1);
            if (w > 0) {
                barGroup.append("rect")
                    .attr("x", x).attr("y", 0).attr("width", w).attr("height", barH)
                    .attr("fill", seg.color).attr("stroke", "none").attr("stroke-width", 0).attr("opacity", 1);
            }
        });

        const validThresholds = thresholdValues.filter(t => t > minVal && t < maxVal);
        validThresholds.forEach(t => {
            barGroup.append("line")
                .attr("x1", scaleX(t)).attr("y1", 0)
                .attr("x2", scaleX(t)).attr("y2", barH)
                .attr("stroke", "none").attr("stroke-width", 0);
        });

        group.append("rect")
            .attr("width", totalW).attr("height", barH)
            .attr("rx", radius).attr("ry", radius)
            .attr("fill", "transparent").attr("stroke", "none").attr("stroke-width", 0);

        const markerPos = scaleX(value);
        const markerTextValue = markerTextLabel !== undefined ? markerTextLabel : (!isNaN(value) ? parseFloat(value.toFixed(2)).toString() + unit : String(value));

        const actualMarkerHeight = Math.max(barH + 8, markerHeightVal);
        const topOverflow        = (actualMarkerHeight - barH) / 2;

        group.append("rect")
            .attr("x", markerPos - markerThickness / 2).attr("y", -topOverflow)
            .attr("width", markerThickness).attr("height", actualMarkerHeight)
            .attr("fill", markerColor).attr("rx", 1.5).attr("ry", 1.5);

        // Hitbox invisible para tooltip
        const hitBox = group.append("rect")
            .attr("x", markerPos - 15).attr("y", -topOverflow)
            .attr("width", 30).attr("height", actualMarkerHeight)
            .attr("fill", "transparent").style("pointer-events", "all");

        if (this.host.tooltipService && tooltipItems && tooltipItems.length > 0) {
            const showTooltip = (event: MouseEvent) => {
                this.host.tooltipService.show({
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: false,
                    dataItems: tooltipItems,
                    identities: []
                });
            };
            hitBox.on("mouseover", showTooltip);
            hitBox.on("mousemove", showTooltip);
            hitBox.on("mouseout", () => this.host.tooltipService.hide({ isTouchEvent: false, immediately: true }));
        }

        if (showTarget && targetValue != null && targetValue >= minVal && targetValue <= maxVal) {
            const tx = scaleX(targetValue);
            group.append("line")
                .attr("x1", tx).attr("y1", -(targetWidth || 2))
                .attr("x2", tx).attr("y2", barH + (targetWidth || 2))
                .attr("stroke", targetColor || "#ffffff")
                .attr("stroke-width", targetWidth || 2);
        }

        if (showLabel) {
            group.append("text")
                .attr("x", markerPos).attr("y", -topOverflow - 6)
                .attr("font-size", `${Math.max(9, fontSize - 2)}px`)
                .attr("fill", fontColor).attr("text-anchor", "middle")
                .text(markerTextValue);

            const textLen = (markerTextValue.length * (fontSize - 2) * 0.6) + 4;
            group.insert("rect", "text:last-child")
                .attr("x", markerPos - textLen / 2).attr("y", -topOverflow - 6 - (fontSize - 2))
                .attr("width", textLen).attr("height", fontSize)
                .attr("fill", "rgba(255,255,255,0.85)").attr("rx", 2);
        }

        if (showTicks) {
            const ticksG = group.append("g").attr("transform", `translate(0, ${barH + 12})`);
            validThresholds.forEach(t => {
                ticksG.append("text")
                    .attr("x", scaleX(t)).attr("y", 0)
                    .attr("font-size", `${Math.max(8, fontSize - 3)}px`)
                    .attr("fill", fontColor).attr("opacity", 0.55).attr("text-anchor", "middle")
                    .text(String(t));
                ticksG.append("line")
                    .attr("x1", scaleX(t)).attr("y1", -12)
                    .attr("x2", scaleX(t)).attr("y2", -8)
                    .attr("stroke", fontColor).attr("stroke-width", 1).attr("opacity", 0.5);
            });
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
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
            allColorSlices[i].displayName = `Seg. ${i + 1}  (${seg.start} – ${seg.end})`;
        });

        this.settings.order.slices = [
            this.settings.order.ascending,
            this.settings.order.invertColors
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
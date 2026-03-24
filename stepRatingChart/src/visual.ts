"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual                  = powerbi.extensibility.visual.IVisual;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import DataView                 = powerbi.DataView;

// ─────────────────────────────────────────────────────────────────────────────
// DICCIONARIO: texto del rating → número ordinal (1 = mejor, 22 = peor)
// Cubre S&P, Fitch y Moody's
// ─────────────────────────────────────────────────────────────────────────────
const RATING_SCALE: Record<string, number> = {
    "Aaa": 1,  "AAA": 1,
    "Aa1": 2,  "AA+": 2,
    "Aa2": 3,  "AA":  3,
    "Aa3": 4,  "AA-": 4,
    "A1":  5,  "A+":  5,
    "A2":  6,  "A":   6,
    "A3":  7,  "A-":  7,
    "Baa1": 8,  "BBB+": 8,
    "Baa2": 9,  "BBB":  9,
    "Baa3": 10, "BBB-": 10,
    "Ba1":  11, "BB+":  11,
    "Ba2":  12, "BB":   12,
    "Ba3":  13, "BB-":  13,
    "B1":   14, "B+":   14,
    "B2":   15, "B":    15,
    "B3":   16, "B-":   16,
    "Caa1": 17, "CCC+": 17,
    "Caa2": 18, "CCC":  18,
    "Caa3": 19, "CCC-": 19,
    "Ca":   20, "CC":   20,
    "C":    21,
    "D":    22
};

// Etiqueta del eje Y: muestra ambas nomenclaturas
const RATING_LABEL: Record<number, string> = {
    1:  "AAA (Aaa)",   2:  "AA+ (Aa1)",
    3:  "AA  (Aa2)",   4:  "AA- (Aa3)",
    5:  "A+  (A1)",    6:  "A   (A2)",
    7:  "A-  (A3)",    8:  "BBB+ (Baa1)",
    9:  "BBB  (Baa2)", 10: "BBB- (Baa3)",
    11: "BB+  (Ba1)",  12: "BB   (Ba2)",
    13: "BB-  (Ba3)",  14: "B+   (B1)",
    15: "B    (B2)",   16: "B-   (B3)",
    17: "CCC+ (Caa1)", 18: "CCC  (Caa2)",
    19: "CCC- (Caa3)", 20: "CC   (Ca)",
    21: "C",           22: "D"
};

const Y_MIN = 1;
const Y_MAX = 22;

// ─────────────────────────────────────────────────────────────────────────────
interface RatingPoint {
    date:       Date;
    ratingText: string;
    ratingNum:  number;
    agency:     string;
}

interface AgencySeries {
    name:   string;
    points: RatingPoint[];
    color:  string;
}

const SERIES_COLORS = ["#1a1a1a", "#b0c030", "#00b4d8", "#e07b39", "#9b5de5", "#f15bb5"];

// ─────────────────────────────────────────────────────────────────────────────
export class Visual implements IVisual {

    private host:                      IVisualHost;
    private svg:                       d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private mainG:                     d3.Selection<SVGGElement,   unknown, null, undefined>;
    private settings:                  VisualSettings;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.svg = d3.select(options.element)
            .append("svg")
            .classed("rating-chart-svg", true)
            .style("width",  "100%")
            .style("height", "100%")
            .style("font-family", "Segoe UI, sans-serif");

        this.mainG = this.svg.append("g");
    }

    public update(options: VisualUpdateOptions): void {
        this.svg.selectAll("*").remove();
        this.mainG = this.svg.append("g");

        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings, options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];

        // Con table mapping verificamos dataView.table
        if (!dataView?.table?.rows?.length) {
            this.renderEmpty("Arrastra Fecha, Agencia y Rating", options);
            return;
        }

        const points = this.extractData(dataView);
        if (!points.length) {
            this.renderEmpty("Sin datos o ratings no reconocidos en el diccionario", options);
            return;
        }

        this.render(points, options.viewport.width, options.viewport.height);
    }

    // ── Extracción desde dataView.table ───────────────────────────────────────
    private extractData(dataView: DataView): RatingPoint[] {
        const table   = dataView.table;
        const columns = table.columns;

        // Encontrar índice de cada columna por su rol
        let dateIdx   = -1;
        let agencyIdx = -1;
        let ratingIdx = -1;

        columns.forEach((col, i) => {
            if (col.roles["date"])   dateIdx   = i;
            if (col.roles["agency"]) agencyIdx = i;
            if (col.roles["rating"]) ratingIdx = i;
        });

        if (dateIdx === -1 || agencyIdx === -1 || ratingIdx === -1) {
            console.warn("[RatingChart] Faltan columnas. Índices:", { dateIdx, agencyIdx, ratingIdx });
            return [];
        }

        const points: RatingPoint[] = [];

        table.rows.forEach(row => {
            const rawDate   = row[dateIdx];
            const agency    = String(row[agencyIdx] ?? "").trim();
            const ratingTxt = String(row[ratingIdx] ?? "").trim();

            if (!rawDate || !agency || !ratingTxt) return;

            // Convertir fecha
            let date: Date;
            if (rawDate instanceof Date) {
                date = rawDate;
            } else {
                date = new Date(String(rawDate));
            }
            if (isNaN(date.getTime())) return;

            // Lookup en el diccionario
            const ratingNum = RATING_SCALE[ratingTxt];
            if (ratingNum === undefined) {
                console.warn(`[RatingChart] Rating desconocido: "${ratingTxt}"`);
                return;
            }

            points.push({ date, ratingText: ratingTxt, ratingNum, agency });
        });

        return points;
    }

    // ── Agrupar por agencia ───────────────────────────────────────────────────
    private groupByAgency(points: RatingPoint[]): AgencySeries[] {
        const map = new Map<string, RatingPoint[]>();
        points.forEach(p => {
            if (!map.has(p.agency)) map.set(p.agency, []);
            map.get(p.agency)!.push(p);
        });

        const colorProps = [
            this.settings.seriesColors.color1,
            this.settings.seriesColors.color2,
            this.settings.seriesColors.color3,
            this.settings.seriesColors.color4,
            this.settings.seriesColors.color5,
            this.settings.seriesColors.color6,
            this.settings.seriesColors.color7,
            this.settings.seriesColors.color8,
            this.settings.seriesColors.color9,
            this.settings.seriesColors.color10
        ];

        const uniqueAgencies = Array.from(map.keys()).sort();
        const agencyColors = new Map<string, string>();
        
        uniqueAgencies.forEach((agency, i) => {
            if (i < 10) {
                const prop = colorProps[i];
                prop.displayName = agency;
                prop.visible = true;
                if (!prop.value.value) {
                    prop.value.value = SERIES_COLORS[i % SERIES_COLORS.length];
                }
                agencyColors.set(agency, prop.value.value as string);
            } else {
                agencyColors.set(agency, SERIES_COLORS[i % SERIES_COLORS.length]);
            }
        });

        for (let i = uniqueAgencies.length; i < 10; i++) {
            colorProps[i].visible = false;
        }

        const series: AgencySeries[] = [];
        map.forEach((pts, name) => {
            pts.sort((a, b) => a.date.getTime() - b.date.getTime());
            series.push({ name, points: pts, color: agencyColors.get(name)! });
        });
        return series;
    }

    private formatDate(d: Date, fmt: string): string {
        const dd   = String(d.getDate()).padStart(2, "0");
        const mm   = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = String(d.getFullYear());
        if (fmt === "yyyy")    return yyyy;
        if (fmt === "mm/yyyy") return `${mm}/${yyyy}`;
        return `${dd}/${mm}/${yyyy}`;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    private render(points: RatingPoint[], viewWidth: number, viewHeight: number): void {
        const s = this.settings;

        const showDots      = s.series.showDots.value         as boolean;
        const dotR          = (s.series.dotRadius.value       as number) ?? 4;
        const lineW         = (s.series.lineWidth.value       as number) ?? 3;
        const showLeg       = s.series.showLegend.value       as boolean;
        const legPos        = (s.series.legendPosition.value  as any)?.value ?? "bottom";
        const dateFmt       = (s.xAxis.dateFormat.value       as any)?.value ?? "dd/mm/yyyy";
        const maxTicks      = (s.xAxis.maxTicks.value         as number) ?? 12;
        const xFs           = (s.xAxis.fontSize.value         as number) ?? 10;
        const xFc           = (s.xAxis.fontColor.value        as any)?.value ?? "#555555";
        const yFs           = (s.yAxis.fontSize.value         as number) ?? 10;
        const yFc           = (s.yAxis.fontColor.value        as any)?.value ?? "#000000";
        const yFcSec        = (s.yAxis.secondaryFontColor.value as any)?.value ?? "#005bb5";
        const gFs           = (s.yAxis.groupFontSize.value    as number) ?? 10;
        const gFc           = (s.yAxis.groupFontColor.value   as any)?.value ?? "#888888";
        const showDotted    = s.yAxis.showDottedLines.value   as boolean;
        const showGLabels   = s.ratingGroups.showGroupLabels.value     as boolean;
        const showGSep      = s.ratingGroups.showGroupSeparators.value as boolean;
        const groups        = s.ratingGroups.getGroups();

        const series = this.groupByAgency(points);

        // Rango Y visible: mínimo y máximo de los datos ± 1 nivel
        const allNums  = points.map(p => p.ratingNum);
        const dataYMin = Math.max(Y_MIN, Math.min(...allNums) - 1);
        const dataYMax = Math.min(Y_MAX, Math.max(...allNums) + 1);

        // Niveles visibles en el eje Y
        const visibleLevels = Object.entries(RATING_LABEL)
            .map(([k, v]) => ({ num: Number(k), label: v }))
            .filter(l => l.num >= dataYMin && l.num <= dataYMax)
            .sort((a, b) => a.num - b.num);

        // Márgenes
        const legH = showLeg ? 28 : 0;
        const legW = (showLeg && legPos === "right") ? 110 : 0;
        const groupLabelW  = showGLabels ? 85 : 0;
        const yLabelW      = 95;

        let mTop = 16;
        let mBot = 24 + (xFs * 3.5); // Air for rotated text
        
        if (showLeg) {
            if (legPos === "top") {
                mTop += legH;
            } else if (legPos === "bottom") {
                mBot += legH;
            }
        }

        const margin = {
            top:    mTop,
            right:  20 + legW,
            bottom: mBot,
            left:   yLabelW + groupLabelW
        };

        const W = Math.max(1, viewWidth  - margin.left - margin.right);
        const H = Math.max(1, viewHeight - margin.top  - margin.bottom);

        const g = this.mainG.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Escalas
        const yScale = d3.scaleLinear()
            .domain([dataYMin - 0.5, dataYMax + 0.5])
            .range([0, H]);

        const allDates = points.map(p => p.date);
        const xScale   = d3.scaleTime()
            .domain([d3.min(allDates)!, d3.max(allDates)!])
            .range([0, W]);

        // Líneas punteadas
        if (showDotted) {
            visibleLevels.forEach(({ num }) => {
                g.append("line")
                    .classed("dotted-line", true)
                    .attr("x1", 0).attr("y1", yScale(num))
                    .attr("x2", W).attr("y2", yScale(num))
                    .attr("stroke", "#e8e8e8")
                    .attr("stroke-width", 1)
                    .attr("stroke-dasharray", "2,4");
            });
        }

        // Separadores y etiquetas de grupos
        if (groups.length > 0) {
            groups.forEach((group, gi) => {
                const groupNums = group.levels
                    .map(l => RATING_SCALE[l])
                    .filter(n => n !== undefined && n >= dataYMin && n <= dataYMax)
                    .sort((a, b) => a - b);

                if (groupNums.length === 0) return;

                const yTop  = yScale(groupNums[0]);
                const yBott = yScale(groupNums[groupNums.length - 1]);
                const yMid  = (yTop + yBott) / 2;

                if (showGSep && gi > 0) {
                    g.append("line")
                        .classed("group-separator", true)
                        .attr("x1", -(groupLabelW + yLabelW)).attr("y1", yScale(groupNums[0] - 0.5))
                        .attr("x2", W).attr("y2", yScale(groupNums[0] - 0.5))
                        .attr("stroke", "#aaaaaa").attr("stroke-width", 0.75);
                }

                if (showGLabels) {
                    g.append("line")
                        .classed("group-brace", true)
                        .attr("x1", -(groupLabelW - 4)).attr("y1", yTop)
                        .attr("x2", -(groupLabelW - 4)).attr("y2", yBott)
                        .attr("stroke", "#aaaaaa").attr("stroke-width", 1);

                    g.append("text")
                        .classed("group-label", true)
                        .attr("x", -(groupLabelW))
                        .attr("y", yMid)
                        .attr("text-anchor", "start")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", `${gFs}px`)
                        .attr("fill", gFc)
                        .text(group.name);
                }
            });
        }

        // Etiquetas eje Y
        visibleLevels.forEach(({ num, label }) => {
            const parts = label.split(" (");
            const labelEl = g.append("text")
                .classed("y-level-label", true)
                .attr("x", -4)
                .attr("y", yScale(num))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("font-size", `${yFs}px`);

            labelEl.append("tspan")
                .attr("font-weight", "bold")
                .attr("fill", yFc)
                .text(parts[0]);

            if (parts.length > 1) {
                labelEl.append("tspan")
                    .attr("font-weight", "normal")
                    .attr("fill", yFcSec)
                    .text(" (" + parts[1]);
            }
        });

        // Eje X
        const xAxis = d3.axisBottom(xScale)
            .ticks(Math.max(2, Math.min(maxTicks, Math.floor(W / 60))))
            .tickFormat(d => this.formatDate(d as Date, dateFmt));

        const xAxisG = g.append("g")
            .classed("x-axis", true)
            .attr("transform", `translate(0, ${H + 8})`)
            .call(xAxis);

        xAxisG.select(".domain").remove();
        xAxisG.selectAll(".tick line").remove();
        xAxisG.selectAll(".tick text")
            .attr("font-size", `${xFs}px`)
            .attr("fill", xFc)
            .attr("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "0.15em")
            .attr("transform", "rotate(-45)");

        // Series
        series.forEach(serie => {
            const validPoints = serie.points.filter(
                p => p.ratingNum >= dataYMin && p.ratingNum <= dataYMax
            );
            if (validPoints.length === 0) return;

            const lineGen = d3.line<RatingPoint>()
                .x(p => xScale(p.date))
                .y(p => yScale(p.ratingNum))
                .curve(d3.curveStepAfter);

            g.append("path")
                .classed("series-line", true)
                .datum(validPoints)
                .attr("fill",         "none")
                .attr("stroke",       serie.color)
                .attr("stroke-width", lineW)
                .attr("d",            lineGen);

            if (showDots) {
                g.selectAll(null)
                    .data(validPoints)
                    .enter()
                    .append("circle")
                    .classed("series-dot", true)
                    .attr("cx",   p => xScale(p.date))
                    .attr("cy",   p => yScale(p.ratingNum))
                    .attr("r",    dotR)
                    .attr("fill", serie.color)
                    .append("title")
                    .text(p => `${serie.name}: ${p.ratingText} — ${this.formatDate(p.date, dateFmt)}`);
            }
        });

        // Leyenda
        if (showLeg) {
            const drawLeg = (
                legG: d3.Selection<SVGGElement, unknown, null, undefined>,
                vertical: boolean
            ) => {
                let offset = 0;
                series.forEach(serie => {
                    const x1 = vertical ? 0      : offset;
                    const y1 = vertical ? offset + 6 : 6;
                    const x2 = vertical ? 16     : offset + 16;
                    const y2 = vertical ? offset + 6 : 6;

                    legG.append("line")
                        .attr("x1", x1).attr("y1", y1)
                        .attr("x2", x2).attr("y2", y2)
                        .attr("stroke", serie.color).attr("stroke-width", 2);

                    legG.append("text")
                        .attr("x", vertical ? 22 : offset + 22)
                        .attr("y", vertical ? offset + 10 : 10)
                        .attr("font-size", `${xFs}px`).attr("fill", xFc)
                        .text(serie.name);

                    offset += vertical ? xFs + 10 : 22 + serie.name.length * xFs * 0.62 + 12;
                });
            };

            if (legPos === "bottom") {
                drawLeg(this.mainG.append("g")
                    .attr("transform", `translate(${margin.left}, ${viewHeight - legH + 4})`), false);
            } else if (legPos === "top") {
                drawLeg(this.mainG.append("g")
                    .attr("transform", `translate(${margin.left}, 4)`), false);
            } else {
                drawLeg(this.mainG.append("g")
                    .attr("transform", `translate(${viewWidth - legW + 4}, ${margin.top})`), true);
            }
        }
    }

    private renderEmpty(msg: string, options: VisualUpdateOptions): void {
        this.svg.append("text")
            .classed("empty-message", true)
            .attr("x", options.viewport.width  / 2)
            .attr("y", options.viewport.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888").attr("font-size", "13px")
            .text(msg);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
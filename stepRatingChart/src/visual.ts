"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3";

import { VisualSettings } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

// ─────────────────────────────────────────────────────────────────────────────
const RATING_SCALE: Record<string, number> = {
    "Aaa": 1, "AAA": 1,
    "Aa1": 2, "AA+": 2,
    "Aa2": 3, "AA": 3,
    "Aa3": 4, "AA-": 4,
    "A1": 5, "A+": 5,
    "A2": 6, "A": 6,
    "A3": 7, "A-": 7,
    "Baa1": 8, "BBB+": 8,
    "Baa2": 9, "BBB": 9,
    "Baa3": 10, "BBB-": 10,
    "Ba1": 11, "BB+": 11,
    "Ba2": 12, "BB": 12,
    "Ba3": 13, "BB-": 13,
    "B1": 14, "B+": 14,
    "B2": 15, "B": 15,
    "B3": 16, "B-": 16,
    "Caa1": 17, "CCC+": 17,
    "Caa2": 18, "CCC": 18,
    "Caa3": 19, "CCC-": 19,
    "Ca": 20, "CC": 20,
    "C": 21,
    "D": 22
};

const RATING_LABEL: Record<number, string> = {
    1: "AAA (Aaa)", 2: "AA+ (Aa1)",
    3: "AA  (Aa2)", 4: "AA- (Aa3)",
    5: "A+  (A1)", 6: "A   (A2)",
    7: "A-  (A3)", 8: "BBB+ (Baa1)",
    9: "BBB  (Baa2)", 10: "BBB- (Baa3)",
    11: "BB+  (Ba1)", 12: "BB   (Ba2)",
    13: "BB-  (Ba3)", 14: "B+   (B1)",
    15: "B    (B2)", 16: "B-   (B3)",
    17: "CCC+ (Caa1)", 18: "CCC  (Caa2)",
    19: "CCC- (Caa3)", 20: "CC   (Ca)",
    21: "C", 22: "D"
};

const Y_MIN = 1;
const Y_MAX = 22;

interface RatingPoint {
    date: Date;
    dateLabel: string;   // texto original del campo — se muestra sin reformateo
    ratingText: string;
    ratingNum: number;
    agency: string;
    country: string;   // vacío si no se arrastra el campo País
}

interface AgencySeries {
    name: string;
    points: RatingPoint[];
    color: string;
}

const SERIES_COLORS = ["#1a1a1a", "#b0c030", "#00b4d8", "#e07b39", "#9b5de5", "#f15bb5"];

// ─────────────────────────────────────────────────────────────────────────────
export class Visual implements IVisual {

    private host: IVisualHost;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private mainG: d3.Selection<SVGGElement, unknown, null, undefined>;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.svg = d3.select(options.element)
            .append("svg")
            .classed("rating-chart-svg", true)
            .style("width", "100%")
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

    // ── Extracción ────────────────────────────────────────────────────────────
    private extractData(dataView: DataView): RatingPoint[] {
        const table = dataView.table;
        const columns = table.columns;

        let dateIdx = -1;
        let agencyIdx = -1;
        let ratingIdx = -1;
        let countryIdx = -1;

        columns.forEach((col, i) => {
            if (col.roles["date"]) dateIdx = i;
            if (col.roles["agency"]) agencyIdx = i;
            if (col.roles["rating"]) ratingIdx = i;
            if (col.roles["country"]) countryIdx = i;
        });

        if (dateIdx === -1 || agencyIdx === -1 || ratingIdx === -1) {
            console.warn("[RatingChart] Faltan columnas.", { dateIdx, agencyIdx, ratingIdx });
            return [];
        }

        const points: RatingPoint[] = [];

        table.rows.forEach(row => {
            const rawDate = row[dateIdx];
            const agency = String(row[agencyIdx] ?? "").trim();
            const ratingTxt = String(row[ratingIdx] ?? "").trim();
            // País: vacío si no se arrastra el campo
            const country = countryIdx !== -1 ? String(row[countryIdx] ?? "").trim() : "";

            if (!rawDate || !agency || !ratingTxt) return;

            let date: Date;
            if (rawDate instanceof Date) {
                date = rawDate;
            } else {
                date = new Date(String(rawDate));
            }
            if (isNaN(date.getTime())) return;

            const dateFmt = (this.settings.xAxis.dateFormat.value as any)?.value ?? "dd/mm/yyyy";
            const dateLabel = this.formatDate(date, dateFmt, this.host.locale);

            const ratingNum = RATING_SCALE[ratingTxt];
            if (ratingNum === undefined) {
                console.warn(`[RatingChart] Rating desconocido: "${ratingTxt}"`);
                return;
            }

            points.push({ date, dateLabel, ratingText: ratingTxt, ratingNum, agency, country });
        });

        return points;
    }

    // ── Agrupar por serie ─────────────────────────────────────────────────────
    // Sin campo País → una línea por agencia (comportamiento original)
    // Con campo País → una línea por país; si hay múltiples agencias se promedia
    //                  el ratingNum por (país, fecha) y se redondea al entero más cercano
    private groupByAgency(points: RatingPoint[]): AgencySeries[] {
        const hasCountry = points.some(p => p.country !== "");

        const colorProps = [
            this.settings.seriesColors.color1, this.settings.seriesColors.color2,
            this.settings.seriesColors.color3, this.settings.seriesColors.color4,
            this.settings.seriesColors.color5, this.settings.seriesColors.color6,
            this.settings.seriesColors.color7, this.settings.seriesColors.color8,
            this.settings.seriesColors.color9, this.settings.seriesColors.color10
        ];

        let seriesMap: Map<string, RatingPoint[]>;

        if (!hasCountry) {
            // ── Modo original: agrupar por agencia ──────────────────────────
            seriesMap = new Map<string, RatingPoint[]>();
            points.forEach(p => {
                if (!seriesMap.has(p.agency)) seriesMap.set(p.agency, []);
                seriesMap.get(p.agency)!.push(p);
            });

        } else {
            // ── Modo país: agrupar por país, promediar agencias ─────────────
            // Paso 1: agrupar por (país, fecha) → lista de ratingNum de cada agencia
            const byCountryDate = new Map<string, { date: Date; dateLabel: string; nums: number[] }>();

            points.forEach(p => {
                const key = `${p.country}||${p.date.getTime()}`;
                if (!byCountryDate.has(key)) {
                    byCountryDate.set(key, { date: p.date, dateLabel: p.dateLabel, nums: [] });
                }
                byCountryDate.get(key)!.nums.push(p.ratingNum);
            });

            // Paso 2: calcular promedio redondeado y construir RatingPoint por país
            const byCountry = new Map<string, RatingPoint[]>();

            byCountryDate.forEach(({ date, dateLabel, nums }, key) => {
                const country = key.split("||")[0];
                const avgNum = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
                // Buscar el texto del rating que corresponde al número promedio
                const ratingText = Object.entries(RATING_SCALE).find(([, v]) => v === avgNum)?.[0] ?? String(avgNum);

                if (!byCountry.has(country)) byCountry.set(country, []);
                byCountry.get(country)!.push({
                    date, dateLabel,
                    ratingText, ratingNum: avgNum,
                    agency: "(promedio)", country
                });
            });

            seriesMap = byCountry;
        }

        // Asignar colores — la clave es el nombre de serie (agencia o país)
        const uniqueKeys = Array.from(seriesMap.keys()).sort();
        const keyColors = new Map<string, string>();

        uniqueKeys.forEach((key, i) => {
            if (i < 10) {
                const prop = colorProps[i];
                prop.displayName = key;
                prop.visible = true;
                if (!prop.value.value) {
                    prop.value.value = SERIES_COLORS[i % SERIES_COLORS.length];
                }
                keyColors.set(key, prop.value.value as string);
            } else {
                keyColors.set(key, SERIES_COLORS[i % SERIES_COLORS.length]);
            }
        });

        for (let i = uniqueKeys.length; i < 10; i++) {
            colorProps[i].visible = false;
        }

        const series: AgencySeries[] = [];
        seriesMap.forEach((pts, name) => {
            pts.sort((a, b) => a.date.getTime() - b.date.getTime());
            series.push({ name, points: pts, color: keyColors.get(name)! });
        });
        return series;
    }

    // ── FIX: formateador de fecha — usa el texto original del dataset ─────────
    // ── FIX: formateador de fecha localizado (vuelve a 'ene 2025') ─────────
    private formatDate(d: Date, fmt: string, locale: string = "es-ES"): string {
        if (fmt === "yyyy") return d.toLocaleDateString(locale, { year: 'numeric' });
        if (fmt === "mm/yyyy") return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    private render(points: RatingPoint[], viewWidth: number, viewHeight: number): void {
        const s = this.settings;

        const showDots = s.series.showDots.value as boolean;
        const dotR = (s.series.dotRadius.value as number) ?? 4;
        const lineW = (s.series.lineWidth.value as number) ?? 3;
        const showLeg = s.series.showLegend.value as boolean;
        const legPos = (s.series.legendPosition.value as any)?.value ?? "bottom";
        const dateFmt = (s.xAxis.dateFormat.value as any)?.value ?? "dd/mm/yyyy";
        const maxTicks = (s.xAxis.maxTicks.value as number) ?? 12;
        const xFs = (s.xAxis.fontSize.value as number) ?? 10;
        const xFc = (s.xAxis.fontColor.value as any)?.value ?? "#555555";
        const yFs = (s.yAxis.fontSize.value as number) ?? 10;
        const yFc = (s.yAxis.fontColor.value as any)?.value ?? "#000000";
        const yFcSec = (s.yAxis.secondaryFontColor.value as any)?.value ?? "#005bb5";
        const lblStyle = (s.yAxis.labelStyle.value as any)?.value ?? "Both";
        const gFs = (s.yAxis.groupFontSize.value as number) ?? 10;
        const gFc = (s.yAxis.groupFontColor.value as any)?.value ?? "#888888";
        const showDotted = s.yAxis.showDottedLines.value as boolean;
        const showGLbls = s.ratingGroups.showGroupLabels.value as boolean;
        const showGSep = s.ratingGroups.showGroupSeparators.value as boolean;
        const groups = s.ratingGroups.getGroups();

        const series = this.groupByAgency(points);

        const allNums = points.map(p => p.ratingNum);
        const dataYMin = Math.max(Y_MIN, Math.min(...allNums) - 1);
        const dataYMax = Math.min(Y_MAX, Math.max(...allNums) + 1);

        const visibleLevels = Object.entries(RATING_LABEL)
            .map(([k, v]) => ({ num: Number(k), label: v }))
            .filter(l => l.num >= dataYMin && l.num <= dataYMax)
            .sort((a, b) => a.num - b.num);

        // Márgenes
        const legH = showLeg ? 28 : 0;
        const legW = (showLeg && legPos === "right") ? 110 : 0;
        const groupLabelW = showGLbls ? 120 : 0;
        // yLabelW: espacio reservado para etiquetas del eje Y
        // "Both" = columna Fitch/S&P (derecha, ~44px) + columna Moody's (izquierda, ~36px)
        // "Standard"/"Moodys" = solo una columna
        const fitchColW = 44;  // ancho fijo columna Fitch (derecha, pegada al gráfico)
        const moodysColW = lblStyle === "Both" ? 38 : 0;  // ancho fijo columna Moody's (izquierda)
        const yLabelW = fitchColW + moodysColW;

        let mTop = 16;
        let mBot = 24 + (xFs * dateFmt.length * 0.5);
        if (showLeg) {
            if (legPos === "top") mTop += legH;
            else if (legPos === "bottom") mBot += legH;
        }

        const margin = { top: mTop, right: 20 + legW, bottom: mBot, left: yLabelW + groupLabelW };
        const W = Math.max(1, viewWidth - margin.left - margin.right);
        const H = Math.max(1, viewHeight - margin.top - margin.bottom);

        const g = this.mainG.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Escalas
        const yScale = d3.scaleLinear()
            .domain([dataYMin - 0.5, dataYMax + 0.5])
            .range([0, H]);

        const allDates = points.map(p => p.date);
        const xScale = d3.scaleTime()
            .domain([d3.min(allDates)!, d3.max(allDates)!])
            .range([0, W]);

        // Líneas punteadas horizontales
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

        // Grupos
        if (groups.length > 0) {
            groups.forEach((group, gi) => {
                const groupNums = group.levels
                    .map(l => RATING_SCALE[l])
                    .filter(n => n !== undefined && n >= dataYMin && n <= dataYMax)
                    .sort((a, b) => a - b);
                if (groupNums.length === 0) return;

                const yTop = yScale(groupNums[0]);
                const yBott = yScale(groupNums[groupNums.length - 1]);
                const yMid = (yTop + yBott) / 2;

                if (showGSep && gi > 0) {
                    g.append("line")
                        .classed("group-separator", true)
                        .attr("x1", -(groupLabelW + yLabelW)).attr("y1", yScale(groupNums[0] - 0.5))
                        .attr("x2", W).attr("y2", yScale(groupNums[0] - 0.5))
                        .attr("stroke", "#aaaaaa").attr("stroke-width", 0.75);
                }

                if (showGLbls) {
                    const braceX = -(yLabelW + 6);
                    g.append("line")
                        .classed("group-brace", true)
                        .attr("x1", braceX).attr("y1", yTop)
                        .attr("x2", braceX).attr("y2", yBott)
                        .attr("stroke", "#aaaaaa").attr("stroke-width", 1);
                    g.append("text")
                        .classed("group-label", true)
                        .attr("x", braceX - 8).attr("y", yMid)
                        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
                        .attr("font-size", `${gFs}px`).attr("fill", gFc)
                        .text(group.name);
                }
            });
        }

        // Etiquetas eje Y — dos columnas con posiciones X fijas
        // Columna Moody's:   x = -4            (pegada al borde del área, text-anchor end)
        // Columnas del eje Y:
        //   Fitch/S&P  → columna DERECHA  x = -4               (pegada al borde del área)
        //   Moody's    → columna IZQUIERDA x = -(fitchColW + 4) (más alejada del gráfico)
        visibleLevels.forEach(({ num, label }) => {
            const parts = label.split(" (");
            const txtStandard = parts[0].trim();
            const txtMoodys = parts.length > 1 ? parts[1].replace(")", "").trim() : "";
            const yPos = yScale(num);

            if (lblStyle === "Standard") {
                // Solo Fitch/S&P — alineado a la IZQUIERDA del espacio reservado
                g.append("text")
                    .classed("y-level-label", true)
                    .attr("x", -yLabelW + 4).attr("y", yPos)
                    .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                    .attr("font-size", `${yFs}px`).attr("font-weight", "bold").attr("fill", yFc)
                    .text(txtStandard);

            } else if (lblStyle === "Moodys") {
                // Solo Moody's — alineado a la IZQUIERDA del espacio reservado
                g.append("text")
                    .classed("y-level-label", true)
                    .attr("x", -yLabelW + 4).attr("y", yPos)
                    .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                    .attr("font-size", `${yFs}px`).attr("font-weight", "bold").attr("fill", yFcSec)
                    .text(txtMoodys);

            } else {
                // Ambas:
                //   Fitch/S&P → alineado a la IZQUIERDA de su columna (igual que modo individual)
                //   Moody's   → sin tocar (ya correcto, derecha en x=-(fitchColW+4))
                g.append("text")
                    .classed("y-level-label", true)
                    .attr("x", -fitchColW + 4).attr("y", yPos)
                    .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                    .attr("font-size", `${yFs}px`).attr("font-weight", "bold").attr("fill", yFc)
                    .text(txtStandard);

                g.append("text")
                    .classed("y-level-label", true)
                    .attr("x", -(fitchColW + 4)).attr("y", yPos)
                    .attr("text-anchor", "end").attr("dominant-baseline", "middle")
                    .attr("font-size", `${yFs}px`).attr("font-weight", "normal").attr("fill", yFcSec)
                    .text(txtMoodys ? `(${txtMoodys})` : "");
            }
        });

        // Eje X — muestra la fecha tal cual se ingestó, escalonada para que no colapse verticalmente
        const uniqueTimes = Array.from(new Set(points.map(p => p.date.getTime()))).sort((a, b) => a - b);
        let tickDates = uniqueTimes.map(t => new Date(t));
        const desiredTicks = Math.max(2, Math.min(maxTicks, Math.floor(W / 90))); // 90px para acomodar texto horizontal

        if (tickDates.length > desiredTicks) {
            const step = Math.max(1, Math.floor(tickDates.length / desiredTicks));
            tickDates = tickDates.filter((_, i) => i % step === 0);
        }

        const xAxis = d3.axisBottom(xScale)
            .tickValues(tickDates)
            .tickFormat((d: Date | d3.NumberValue) => this.formatDate(d as Date, dateFmt, this.host.locale));

        const xAxisG = g.append("g")
            .classed("x-axis", true)
            .attr("transform", `translate(0, ${H + 8})`)
            .call(xAxis);

        xAxisG.select(".domain").remove();
        xAxisG.selectAll(".tick line").remove();
        xAxisG.selectAll(".tick text")
            .attr("font-size", `${xFs}px`).attr("fill", xFc)
            .attr("text-anchor", "middle")
            .attr("dx", "0")
            .attr("dy", "1em");

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
                .attr("fill", "none")
                .attr("stroke", serie.color)
                .attr("stroke-width", lineW)
                .attr("d", lineGen);

            if (showDots) {
                g.selectAll(null)
                    .data(validPoints)
                    .enter()
                    .append("circle")
                    .classed("series-dot", true)
                    .attr("cx", p => xScale(p.date))
                    .attr("cy", p => yScale(p.ratingNum))
                    .attr("r", dotR)
                    .attr("fill", serie.color)
                    .append("title")
                    // FIX: usa dateLabel (texto original) en el tooltip
                    .text(p => `${serie.name}: ${p.ratingText} — ${p.dateLabel}`);
            }
        });

        // ── LÍNEA GUÍA VERTICAL (crosshair) ───────────────────────────────────
        // Overlay transparente que captura el mouse sobre toda el área del gráfico
        const crosshairG = g.append("g").style("pointer-events", "none");

        // Línea vertical
        const crosshairLine = crosshairG.append("line")
            .attr("y1", 0).attr("y2", H)
            .attr("stroke", "#999999")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,3")
            .style("opacity", 0);

        // Caja del tooltip
        const tooltipPad = 8;
        const tooltipG = crosshairG.append("g").style("opacity", 0);
        const tooltipRect = tooltipG.append("rect")
            .attr("fill", "white")
            .attr("stroke", "#cccccc")
            .attr("stroke-width", 1)
            .attr("rx", 4);
        const tooltipDate = tooltipG.append("text")
            .attr("font-size", `${xFs + 1}px`)
            .attr("font-weight", "bold")
            .attr("fill", "#333333");
        // Filas de series (máx 10)
        const tooltipRows: d3.Selection<SVGTextElement, unknown, null, undefined>[] = [];
        const tooltipDots: d3.Selection<SVGCircleElement, unknown, null, undefined>[] = [];
        series.forEach((serie, i) => {
            tooltipDots.push(
                tooltipG.append("circle").attr("r", 4).attr("fill", serie.color)
            );
            tooltipRows.push(
                tooltipG.append("text")
                    .attr("font-size", `${xFs}px`)
                    .attr("fill", "#333333")
            );
        });

        // Área invisible de captura de eventos
        g.append("rect")
            .attr("width", W).attr("height", H)
            .attr("fill", "transparent")
            .on("mousemove", function (event) {
                const [mx] = d3.pointer(event);
                const hoverDate = xScale.invert(mx);

                // Encontrar el rating activo de cada serie en esa fecha
                // Con curveStepAfter, el rating válido es el último punto con date <= hoverDate
                const rows: { name: string; color: string; ratingText: string; ratingNum: number }[] = [];

                series.forEach(serie => {
                    const valid = serie.points.filter(
                        p => p.ratingNum >= dataYMin && p.ratingNum <= dataYMax && p.date <= hoverDate
                    );
                    if (valid.length === 0) return;
                    const last = valid[valid.length - 1];
                    const label = RATING_LABEL[last.ratingNum] ?? last.ratingText;
                    const spFitch = label.split(" (")[0].trim();  // "BBB-" sin "(Baa3)"

                    rows.push({
                        name: serie.name,
                        color: serie.color,
                        ratingText: spFitch,
                        ratingNum: last.ratingNum
                    });
                });

                if (rows.length === 0) {
                    crosshairLine.style("opacity", 0);
                    tooltipG.style("opacity", 0);
                    return;
                }

                // Mostrar línea guía
                crosshairLine
                    .attr("x1", mx).attr("x2", mx)
                    .style("opacity", 1);

                // Etiqueta de fecha — usa formatDate con el formato configurado
                const dateStr = (d3 as any).timeFormat("%d/%m/%Y")(hoverDate);

                // Construir tooltip
                const lineH = xFs + 6;
                const totalH = lineH + rows.length * lineH + tooltipPad;
                let maxW = dateStr.length * (xFs * 0.62) + tooltipPad * 2;

                tooltipDate.text(dateStr);

                rows.forEach((row, ri) => {
                    const label = `${row.name}: ${row.ratingText}`;
                    const tw = label.length * (xFs * 0.58) + tooltipPad * 2 + 14;
                    if (tw > maxW) maxW = tw;

                    tooltipDots[ri]
                        .attr("cx", tooltipPad + 4)
                        .attr("cy", lineH + ri * lineH + lineH * 0.3);

                    tooltipRows[ri]
                        .attr("x", tooltipPad + 14)
                        .attr("y", lineH + ri * lineH + lineH * 0.65)
                        .text(label);
                });

                // Ocultar filas extra si hay menos series visibles
                tooltipRows.forEach((row, ri) => row.style("opacity", ri < rows.length ? 1 : 0));
                tooltipDots.forEach((dot, ri) => dot.style("opacity", ri < rows.length ? 1 : 0));

                tooltipDate
                    .attr("x", tooltipPad)
                    .attr("y", lineH * 0.8);

                tooltipRect
                    .attr("width", maxW)
                    .attr("height", totalH + tooltipPad);

                // Posicionar tooltip — a la derecha del cursor, salvo que se salga
                let tx = mx + 12;
                if (tx + maxW > W) tx = mx - maxW - 8;
                const ty = Math.max(0, Math.min(H - totalH - tooltipPad, H / 2 - totalH / 2));
                tooltipG.attr("transform", `translate(${tx}, ${ty})`).style("opacity", 1);
            })
            .on("mouseleave", function () {
                crosshairLine.style("opacity", 0);
                tooltipG.style("opacity", 0);
            });

        // Leyenda
        if (showLeg) {
            const drawLeg = (
                legG: d3.Selection<SVGGElement, unknown, null, undefined>,
                vertical: boolean
            ) => {
                let offset = 0;
                const circR = 5; // radio del círculo de leyenda
                series.forEach(serie => {
                    // Círculo relleno como símbolo de la serie
                    legG.append("circle")
                        .attr("cx", vertical ? circR : offset + circR)
                        .attr("cy", vertical ? offset + 6 : 6)
                        .attr("r", circR)
                        .attr("fill", serie.color);
                    legG.append("text")
                        .attr("x", vertical ? circR * 2 + 6 : offset + circR * 2 + 6)
                        .attr("y", vertical ? offset + 10 : 10)
                        .attr("font-size", `${xFs}px`).attr("fill", xFc)
                        .attr("dominant-baseline", "middle")
                        .attr("dy", "0")
                        .text(serie.name);
                    offset += vertical ? xFs + 10 : circR * 2 + 6 + serie.name.length * xFs * 0.62 + 10;
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
            .attr("x", options.viewport.width / 2)
            .attr("y", options.viewport.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#888").attr("font-size", "13px")
            .text(msg);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}
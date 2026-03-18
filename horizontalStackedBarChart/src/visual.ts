/*
*  Power BI Custom Visual - Hardcoded Template Scorecard
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataViewTable = powerbi.DataViewTable;

import * as d3 from "d3";

// ------------------------------------------------------------------
// Interfaces para el Modelo de Datos (ViewModel)
// ------------------------------------------------------------------

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

export class Visual implements IVisual {
    private target: HTMLElement;
    private container: d3.Selection<HTMLDivElement, any, any, any>;
    
    // Dimensiones relativas para el dibujo del SVG
    private barMaxHeight = 24; 
    private barThickness = 8; 

    // ---- Hardcoded Palettes ----
    private palette10Colors = [
        "#1a9641", "#52b151", "#8cd060", "#c0e676", "#ffffbf", 
        "#ffdf90", "#fec160", "#f4943f", "#de5f2b", "#d7191c"
    ]; // Ejemplo de 10 colores semáforo (Verde a Rojo)
    
    private palette6Colors = [
        "#1a9641", "#8cd060", "#ffffbf", "#fec160", "#de5f2b", "#d7191c"
    ]; // Ejemplo de 6 colores distintos

    private defaultPalette = [
        "#e0e0e0", "#bdbdbd", "#9e9e9e", "#757575", "#424242"
    ]; // 5 colores neutros

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        
        this.container = d3.select(this.target)
            .append("div")
            .classed("scorecard-container", true);
    }

    public update(options: VisualUpdateOptions) {
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.container
            .style("width", `${width}px`)
            .style("height", `${height}px`);

        let dataView = options.dataViews[0];
        let viewModel = this.getViewModelFromTable(dataView?.table);

        if (!viewModel || viewModel.rows.length === 0) {
            this.container.selectAll(".scorecard-row").remove();
            return;
        }

        // --- BINDING HTML: Filas del Scorecard ---
        let rows = this.container.selectAll(".scorecard-row")
            .data(viewModel.rows, (d: ScorecardRow) => d.metricName);

        let rowsEnter = rows.enter()
            .append("div")
            .classed("scorecard-row", true);

        rowsEnter.append("div").classed("col-metric", true);
        rowsEnter.append("div").classed("col-status", true);
        
        let svgColEnter = rowsEnter.append("div").classed("col-visual", true);
        svgColEnter.append("svg")
            .classed("bar-svg", true)
            .style("width", "100%")
            .style("height", "100%")
            .append("g")
            .classed("chart-group", true);

        let rowsMerged = rowsEnter.merge(rows as any);

        rowsMerged.select(".col-metric").text(d => d.metricName);
        rowsMerged.select(".col-status").text(d => d.statusText);

        rows.exit().remove();

        // --- BINDING SVG: Gráficos independientes por fila ---
        let barMaxWidth = 500; 

        rowsMerged.select("svg.bar-svg")
            .attr("viewBox", `0 0 ${barMaxWidth} ${this.barMaxHeight}`)
            .attr("preserveAspectRatio", "none") 
            .each((rowData: ScorecardRow, i, nodes) => {
                let svg = d3.select(nodes[i]);
                let g = svg.select(".chart-group");
                
                // Escala propia basada en los parámetros hardcoded devueltos en viewModel
                let xScale = d3.scaleLinear()
                    .domain([rowData.rowMin, rowData.rowMax])
                    .range([0, barMaxWidth]);

                let yOffset = (this.barMaxHeight - this.barThickness) / 2;

                // 2. Data Binding: Segmentos
                let segments = g.selectAll(".segment")
                    .data(rowData.segments);

                segments.enter()
                    .append("rect")
                    .classed("segment", true)
                    .merge(segments as any)
                    .attr("x", d => xScale(d.startValue))          
                    .attr("y", yOffset)                           
                    .attr("width", d => Math.max(0, xScale(d.endValue) - xScale(d.startValue))) 
                    .attr("height", this.barThickness)            
                    .style("fill", d => d.color)                  
                    .style("stroke", "#fff")        
                    .attr("vector-effect", "non-scaling-stroke")
                    .style("stroke-width", "1.5px");

                segments.exit().remove();

                // 3. Data Binding: Marcador SVG Path (Flecha negra downward)
                let markerValuesData = rowData.markerValue !== null ? [rowData.markerValue] : [];
                let markers = g.selectAll(".marker")
                    .data(markerValuesData);

                let pointY = yOffset + this.barThickness / 2; 
                let arrowPath = `M 0,${pointY + 2} L -5,-3 L -2,-3 L -2,-12 L 2,-12 L 2,-3 L 5,-3 Z`;

                markers.enter()
                    .append("path")
                    .classed("marker", true)
                    .merge(markers as any)
                    .attr("d", arrowPath)
                    .attr("transform", m => {
                        let cx = xScale(m);
                        if (cx < 0) cx = 0;
                        if (cx > barMaxWidth) cx = barMaxWidth;
                        return `translate(${cx}, 0)`;
                    })
                    .style("fill", "#000")
                    .attr("vector-effect", "non-scaling-stroke");

                markers.exit().remove();
            });
    }

    /**
     * Extrae los datos desde un Table DataView y aplica la lógica
     * Hardcoded Switch evaluando la "Métrica".
     */
    private getViewModelFromTable(table: DataViewTable): ViewModel {
        if (!table || !table.rows || !table.columns) {
            return { rows: [] };
        }

        let idxMetric = -1;
        let idxStatus = -1;
        let idxMarker = -1;

        table.columns.forEach((col, idx) => {
            if (col.roles) {
                if (col.roles["metric"]) idxMetric = idx;
                if (col.roles["statusText"]) idxStatus = idx;
                if (col.roles["markerValue"]) idxMarker = idx;
            }
        });

        let rows: ScorecardRow[] = [];

        table.rows.forEach(row => {
            let mName = idxMetric !== -1 && row[idxMetric] != null ? String(row[idxMetric]) : "Unknown";
            let sText = idxStatus !== -1 && row[idxStatus] != null ? String(row[idxStatus]) : "";
            let mValue = idxMarker !== -1 && row[idxMarker] != null ? Number(row[idxMarker]) : null;

            // --- LÓGICA ARQUITECTÓNICA HARDCODED (SWITCH) ---
            let colorsArray: string[] = [];
            let segmentCount = 0;

            switch (mName.trim()) {
                case "Economic Risk":
                case "Industry Risk":
                    colorsArray = this.palette10Colors;
                    segmentCount = 10;
                    break;
                case "Business Position":
                    colorsArray = this.palette6Colors;
                    segmentCount = 6;
                    break;
                default:
                    colorsArray = this.defaultPalette;
                    segmentCount = 5;
                    break;
            }

            // Los segmentos siempre son del mismo grosor relacional por simplicidad
            let limitMax = segmentCount; 
            
            let generatedSegments: Segment[] = [];
            for (let s = 0; s < segmentCount; s++) {
                generatedSegments.push({
                    color: colorsArray[s],
                    width: 1,
                    startValue: s,
                    endValue: s + 1
                });
            }

            rows.push({
                metricName: mName,
                statusText: sText,
                markerValue: mValue,
                rowMin: 0,
                rowMax: limitMax,
                segments: generatedSegments
            });
        });

        return { rows };
    }
}
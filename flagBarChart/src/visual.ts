"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualSettings } from "./settings";
import * as d3 from "d3";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;

interface BarData {
    category: string;
    value: number;
    imageUrl: string;
}

export class Visual implements IVisual {
    private htmlHost: HTMLElement;
    private settings: VisualSettings;
    private formattingSettingsService: FormattingSettingsService;
    private tooltipService: powerbi.extensibility.ITooltipService;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.htmlHost = options.element;
        this.htmlHost.style.overflow = "hidden";
        this.tooltipService = options.host.tooltipService;
    }

    private loadImage(img: HTMLImageElement, url: string): void {
        // Try fetch → base64 first (bypasses CSP), fallback to direct src
        fetch(url)
            .then(resp => {
                if (!resp.ok) throw new Error("fetch failed");
                return resp.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    img.src = reader.result as string;
                    img.style.display = "block";
                };
                reader.readAsDataURL(blob);
            })
            .catch(() => {
                // Fallback: direct src
                img.src = url;
                img.onload = () => { img.style.display = "block"; };
                img.onerror = () => { img.style.display = "none"; };
            });
    }

    public update(options: VisualUpdateOptions): void {
        this.htmlHost.innerHTML = "";

        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualSettings,
            options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];
        if (!dataView?.categorical?.categories || !dataView?.categorical?.values) {
            return;
        }

        // --- Extract data: find columns by ROLE, not index ---
        const catCols = dataView.categorical.categories;
        let categoryCol: powerbi.DataViewCategoryColumn | null = null;
        let imageCol: powerbi.DataViewCategoryColumn | null = null;

        for (const col of catCols) {
            const roles = col.source.roles;
            if (roles?.["category"]) categoryCol = col;
            if (roles?.["imageUrl"]) imageCol = col;
        }

        if (!categoryCol) return;

        const valueCols = dataView.categorical.values;
        let measureCol: powerbi.DataViewValueColumn | null = null;
        for (const col of valueCols) {
            if (col.source.roles?.["measure"]) {
                measureCol = col;
                break;
            }
        }
        if (!measureCol && valueCols.length > 0) measureCol = valueCols[0];
        if (!measureCol) return;

        const data: BarData[] = categoryCol.values.map((cat, i) => {
            let catStr = String(cat);
            if (cat === null || cat === undefined || catStr === "null" || catStr.trim() === "") {
                catStr = "(En blanco)";
            }
            return {
                category: catStr,
                value: Number(measureCol.values[i]) || 0,
                imageUrl: imageCol ? String(imageCol.values[i] || "") : ""
            };
        });

        // --- Settings ---
        const barColor = (this.settings.yAxis.barColor.value as any).value;
        const barWidth = this.settings.yAxis.barWidth.value as number;
        
        const flagSize = this.settings.xAxis.flagSize.value as number;
        const showLabels = this.settings.xAxis.showLabels.value as boolean;
        const labelFontSize = this.settings.xAxis.labelFontSize.value as number;
        const labelColor = (this.settings.xAxis.labelColor.value as any).value;

        const showValues = this.settings.dataLabels.showValues.value as boolean;
        const valueFontSize = this.settings.dataLabels.fontSize.value as number;

        // --- Dimensions ---
        const vpWidth = options.viewport.width;
        const vpHeight = options.viewport.height;

        const minBarSlot = Math.max(flagSize + 14, barWidth + 10);
        const yAxisWidth = 40;
        const totalContentWidth = Math.max(vpWidth, data.length * minBarSlot + yAxisWidth);

        const marginTop = showValues ? valueFontSize + 8 : 8;
        const flagHeight = flagSize * 0.67;
        const labelSpace = showLabels ? 45 : 0; // Reduced space to force truncation
        // Added 22px safety padding for horizontal scrollbar so it doesn't cover flags
        const marginBottom = flagHeight + labelSpace + 22;
        const marginLeft = yAxisWidth;
        const marginRight = 10;

        const chartWidth = totalContentWidth - marginLeft - marginRight;
        const chartHeight = vpHeight - marginTop - marginBottom;
        if (chartHeight <= 10) return;

        // --- Scrollable wrapper ---
        const wrapper = document.createElement("div");
        wrapper.style.width = vpWidth + "px";
        wrapper.style.height = vpHeight + "px";
        wrapper.style.overflowX = "auto";
        wrapper.style.overflowY = "hidden";
        wrapper.className = "flag-chart-wrapper";
        this.htmlHost.appendChild(wrapper);

        // Map vertical mouse wheel scrolling to horizontal scroll
        wrapper.addEventListener("wheel", (evt: WheelEvent) => {
            if (evt.deltaY !== 0) {
                evt.preventDefault();
                wrapper.scrollLeft += evt.deltaY;
            }
        }, { passive: false });

        // --- Inner container ---
        const inner = document.createElement("div");
        inner.style.width = totalContentWidth + "px";
        inner.style.height = vpHeight + "px";
        inner.style.position = "relative";
        wrapper.appendChild(inner);

        // --- SVG for bars + axes ---
        const svg = d3.select(inner)
            .append("svg")
            .attr("width", totalContentWidth)
            .attr("height", marginTop + chartHeight)
            .style("display", "block")
            .style("overflow", "visible")
            .style("cursor", "default");

        const g = svg.append("g")
            .attr("transform", `translate(${marginLeft},${marginTop})`);

        // --- Scales ---
        const xScale = d3.scaleBand<string>()
            .domain(data.map(d => d.category))
            .range([0, chartWidth])
            .padding(0.40); // Increased padding to make bars much thinner

        const maxVal = d3.max(data, d => d.value) || 1;
        const yScale = d3.scaleLinear()
            .domain([0, maxVal * 1.1])
            .nice()
            .range([chartHeight, 0]);

        // --- Y Axis with grid ---
        const yAxis = d3.axisLeft(yScale)
            .ticks(3) // Reduced number of ticks to show only e.g. 0, 10, 20
            .tickSize(-chartWidth);

        const yAxisG = g.append("g")
            .classed("y-axis", true)
            .call(yAxis);

        yAxisG.selectAll(".tick line")
            .attr("stroke", "#e0e0e0")
            .attr("stroke-dasharray", "3,3");

        yAxisG.selectAll(".tick text")
            .attr("font-size", "11px")
            .attr("fill", "#666")
            .attr("dx", "-4px");

        yAxisG.select(".domain").remove();
        
        // Remove the dashed grid line at 0 to prevent it from making the solid baseline look broken
        yAxisG.selectAll(".tick").filter((d: any) => d === 0).select("line").remove();

        // --- X Axis baseline ---
        g.append("line")
            .attr("x1", -5) // Extend slightly to the left to close the gap
            .attr("x2", chartWidth)
            .attr("y1", chartHeight)
            .attr("y2", chartHeight)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1.5);

        // --- Tooltips Setup ---
        const catName = categoryCol?.source.displayName || "Categoría";
        const valName = measureCol?.source.displayName || "Valor";
        const tooltipSvc = this.tooltipService;

        // --- Bars ---
        const bars = g.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect")
            .classed("bar", true)
            .attr("x", d => xScale(d.category)! + Math.max(0, (xScale.bandwidth() - barWidth) / 2))
            .attr("y", d => yScale(d.value))
            .attr("width", () => Math.min(xScale.bandwidth(), barWidth)) 
            .attr("height", d => chartHeight - yScale(d.value))
            .attr("fill", barColor);

        // Native Power BI Tooltips for bars
        bars.on("mousemove", function(a: any, b: any) {
            const ev = (a && a.clientX) ? a : ((d3 as any).event || (window as any).event);
            const d = (a && a.category !== undefined) ? a : ((b && b.category !== undefined) ? b : null);
            if (!ev || !d || !tooltipSvc) return;

            tooltipSvc.show({
                coordinates: [ev.clientX, ev.clientY],
                isTouchEvent: false,
                dataItems: [
                    { displayName: catName, value: String(d.category) },
                    { displayName: valName, value: String(d.value) }
                ],
                identities: []
            });
        });

        bars.on("mouseout", () => {
            if (tooltipSvc) tooltipSvc.hide({ isTouchEvent: false, immediately: true });
        });

        // --- Value labels on top ---
        if (showValues) {
            g.selectAll(".value-label")
                .data(data)
                .enter()
                .append("text")
                .classed("value-label", true)
                .attr("x", d => xScale(d.category)! + xScale.bandwidth() / 2)
                .attr("y", d => yScale(d.value) - 4)
                .attr("text-anchor", "middle")
                .attr("font-size", valueFontSize + "px")
                .attr("font-family", "'Segoe UI', sans-serif")
                .attr("fill", "#333")
                .text(d => d.value % 1 === 0 ? String(d.value) : d.value.toFixed(2));
        }

        // --- HTML X-axis area (flags + tilted labels) ---
        const xAxisDiv = document.createElement("div");
        xAxisDiv.style.width = totalContentWidth + "px";
        xAxisDiv.style.position = "relative";
        xAxisDiv.style.height = marginBottom + "px";
        xAxisDiv.style.overflow = "hidden";
        inner.appendChild(xAxisDiv);

        data.forEach(d => {
            const cx = marginLeft + xScale(d.category)! + xScale.bandwidth() / 2;

            // --- Flag image ---
            if (d.imageUrl && d.imageUrl.length > 5) {
                const img = document.createElement("img");
                img.style.position = "absolute";
                img.style.left = (cx - flagSize / 2) + "px";
                img.style.top = (labelSpace + 8) + "px"; // Positioned below labels
                img.style.width = flagSize + "px";
                img.style.height = flagHeight + "px";
                img.style.objectFit = "contain";
                img.style.pointerEvents = "none";
                img.style.display = "none";
                xAxisDiv.appendChild(img);

                this.loadImage(img, d.imageUrl);
            }

            // --- Vertical labels with truncation ---
            if (showLabels) {
                // Pre-truncate string to force shorter labels
                const estimatedMaxChars = Math.max(4, Math.floor(labelSpace / (labelFontSize * 0.55)));
                let catText = d.category;
                if (catText.length > estimatedMaxChars) {
                    catText = catText.substring(0, estimatedMaxChars - 2) + "...";
                }

                const label = document.createElement("div");
                label.textContent = catText;
                label.title = d.category; // Tooltip for full name
                label.style.position = "absolute";
                label.style.left = (cx - (labelFontSize / 2) + 1) + "px";
                label.style.top = (labelSpace + 4) + "px"; // Anchor box bounds
                label.style.width = labelSpace + "px";
                label.style.fontSize = labelFontSize + "px";
                label.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
                label.style.color = labelColor;
                label.style.transformOrigin = "top left";
                label.style.transform = "rotate(-90deg)";
                label.style.whiteSpace = "nowrap";
                label.style.overflow = "hidden";
                // Right-align anchors the rotated text to the TOP (Axis line), 
                // leaving clean white space at the bottom, so it NEVER touches the flags!
                label.style.textAlign = "right"; 
                xAxisDiv.appendChild(label);
            }
        });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}

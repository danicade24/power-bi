"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import { VisualFormattingSettingsModel } from "./settings";

import * as noUiSlider from "nouislider";
import { min, max } from "d3";
import { AdvancedFilter, IAdvancedFilterCondition, IFilterColumnTarget, IAdvancedFilter } from "powerbi-models";

export class Visual implements IVisual {
    private target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    
    // UI Elements
    private container: HTMLElement;
    private startInput: HTMLInputElement;
    private endInput: HTMLInputElement;
    private sliderElement: HTMLElement;
    
    private slider: any;

    // State Elements
    private isUpdateInProgress: boolean = false;
    private dataView: DataView;
    private globalMinDate: Date;
    private globalMaxDate: Date;
    private currentStyle: string = "Between";

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();

        // 1. Setup DOM
        this.container = document.createElement("div");
        this.container.classList.add("monthEndSlicer");

        const inputsContainer = document.createElement("div");
        inputsContainer.classList.add("inputs-container");

        this.startInput = document.createElement("input");
        this.startInput.classList.add("date-input");
        this.startInput.type = "text";
        this.startInput.readOnly = true;

        this.endInput = document.createElement("input");
        this.endInput.classList.add("date-input");
        this.endInput.type = "text";
        this.endInput.readOnly = true;

        inputsContainer.appendChild(this.startInput);
        inputsContainer.appendChild(this.endInput);

        const sliderContainer = document.createElement("div");
        sliderContainer.classList.add("slider-container");
        this.sliderElement = document.createElement("div");
        sliderContainer.appendChild(this.sliderElement);

        this.container.appendChild(inputsContainer);
        this.container.appendChild(sliderContainer);

        this.target.appendChild(this.container);
    }

    private snapToNearestMonthEnd(value: number): number {
        if (!value) return value;
        let date = new Date(value);
        if (isNaN(date.getTime()) || date.getFullYear() < 1900) return value;

        let prevMonthEnd = new Date(date.getFullYear(), date.getMonth(), 0);
        let currMonthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        let diffPrev = Math.abs(date.getTime() - prevMonthEnd.getTime());
        let diffCurr = Math.abs(date.getTime() - currMonthEnd.getTime());

        return (diffPrev < diffCurr) ? prevMonthEnd.getTime() : currMonthEnd.getTime();
    }

    private formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    public update(options: VisualUpdateOptions) {
        this.isUpdateInProgress = true;
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);

        const dataView = options.dataViews[0];
        if (!dataView || !dataView.categorical || !dataView.categorical.categories || dataView.categorical.categories.length === 0) {
            this.isUpdateInProgress = false;
            return;
        }

        this.dataView = dataView;
        const category = dataView.categorical.categories[0];
        const rawDates = category.values as Date[];
        
        let validDates = rawDates.filter(d => d != null && !isNaN(new Date(d).getTime())).map(d => new Date(d));
        if (validDates.length === 0) {
            this.isUpdateInProgress = false;
            return;
        }

        this.globalMinDate = min(validDates);
        this.globalMaxDate = max(validDates);

        this.currentStyle = this.formattingSettings.slicerCard.style.value.value.toString();

        // Check if there is an active range filter applied
        let appliedMin = this.globalMinDate.getTime();
        let appliedMax = this.globalMaxDate.getTime();
        
        const jsonFilters = options.jsonFilters;
        if (jsonFilters && jsonFilters.length > 0) {
            const filter = jsonFilters[0] as IAdvancedFilter;
            if (filter.conditions) {
                const gt = filter.conditions.find(c => c.operator === "GreaterThan" || c.operator === "GreaterThanOrEqual");
                const lt = filter.conditions.find(c => c.operator === "LessThan" || c.operator === "LessThanOrEqual");
                if (gt) appliedMin = new Date(String(gt.value)).getTime();
                if (lt) appliedMax = new Date(String(lt.value)).getTime();
            }
        }

        // Configure Slider
        this.updateSliderUI(appliedMin, appliedMax);
        this.isUpdateInProgress = false;
    }

    private updateSliderUI(startVal: number, endVal: number) {
        if (this.slider) {
            this.slider.destroy(); // Recreate to configure ranges and handles correctly based on style
        }

        let isBefore = this.currentStyle === "Before";
        let isAfter = this.currentStyle === "After";

        let startHandles = [startVal, endVal];
        let connectStyle: boolean[] = [false, true, false];

        if (isBefore) {
            startHandles = [this.globalMinDate.getTime(), endVal];
            connectStyle = [true, false]; // connect from left to handle
        } else if (isAfter) {
            startHandles = [startVal, this.globalMaxDate.getTime()];
            connectStyle = [false, true]; // connect from handle to right
        }

        const sliderOptions: noUiSlider.Options = {
            start: isBefore ? endVal : isAfter ? startVal : startHandles,
            connect: isBefore ? 'lower' : isAfter ? 'upper' : true,
            range: {
                'min': this.globalMinDate.getTime(),
                'max': this.globalMaxDate.getTime()
            },
            behaviour: "tap-drag"
        };

        noUiSlider.create(this.sliderElement, sliderOptions);
        this.slider = (this.sliderElement as any).noUiSlider;

        this.updateInputVisibility(isBefore, isAfter);

        this.slider.on("slide", (values, handle) => {
            if (this.isUpdateInProgress) return;
            let numVals = values.map(Number);
            let snappedVals = numVals.map(v => this.snapToNearestMonthEnd(v));
            
            // Sync Text Boxes Only (live feedback)
            if (isBefore) {
                this.endInput.value = this.formatDate(new Date(snappedVals[0]));
            } else if (isAfter) {
                this.startInput.value = this.formatDate(new Date(snappedVals[0]));
            } else {
                this.startInput.value = this.formatDate(new Date(snappedVals[0]));
                this.endInput.value = this.formatDate(new Date(snappedVals[1]));
            }
        });

        this.slider.on("change", (values, handle) => {
            if (this.isUpdateInProgress) return;
            let numVals = values.map(Number);
            let snappedVals = numVals.map(v => this.snapToNearestMonthEnd(v));
            
            if (isBefore) snappedVals = [this.globalMinDate.getTime(), snappedVals[0]];
            else if (isAfter) snappedVals = [snappedVals[0], this.globalMaxDate.getTime()];

            // Update UI fully mapped to the new snapped points
            this.slider.set(isBefore ? snappedVals[1] : isAfter ? snappedVals[0] : snappedVals);
            this.applyFilter(snappedVals[0], snappedVals[1]);
        });
        
        // Initial inputs rendering
        if (isBefore) {
            this.startInput.value = this.formatDate(this.globalMinDate);
            this.endInput.value = this.formatDate(new Date(startVal === this.globalMinDate.getTime() ? endVal : startVal));
        } else if (isAfter) {
            this.startInput.value = this.formatDate(new Date(startVal));
            this.endInput.value = this.formatDate(this.globalMaxDate);
        } else {
            this.startInput.value = this.formatDate(new Date(startVal));
            this.endInput.value = this.formatDate(new Date(endVal));
        }
    }

    private updateInputVisibility(isBefore: boolean, isAfter: boolean) {
        if (isBefore) {
            this.startInput.disabled = true;
            this.endInput.disabled = false;
        } else if (isAfter) {
            this.startInput.disabled = false;
            this.endInput.disabled = true;
        } else {
            this.startInput.disabled = false;
            this.endInput.disabled = false;
        }
    }

    private applyFilter(minVal: number, maxVal: number) {
        const target: IFilterColumnTarget = {
            table: this.dataView.categorical.categories[0].source.queryName.split('.')[0],
            column: this.dataView.categorical.categories[0].source.queryName.split('.')[1]
        };

        const conditions: IAdvancedFilterCondition[] = [];
        
        if (minVal > this.globalMinDate.getTime()) {
            conditions.push({ operator: "GreaterThanOrEqual", value: new Date(minVal).toJSON() });
        }
        
        if (maxVal < this.globalMaxDate.getTime()) {
            conditions.push({ operator: "LessThanOrEqual", value: new Date(maxVal).toJSON() });
        }

        if (conditions.length === 0) {
            this.host.applyJsonFilter(null, "general", "filter", powerbi.FilterAction.remove);
        } else {
            const filter: IAdvancedFilter = {
              // eslint-disable-next-line powerbi-visuals/no-http-string
              $schema: "http://powerbi.com/product/schema#advanced",
              ...(new AdvancedFilter(target, "And", conditions))
            };
            this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
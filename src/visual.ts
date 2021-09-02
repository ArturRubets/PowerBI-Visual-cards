"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import {
    select as d3Select
} from "d3-selection";
const getEvent = () => require("d3-selection").event;
import {
    scaleLinear,
    scaleBand
} from "d3-scale";

type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import ScaleLinear = d3.ScaleLinear;

//powerbi.visuals
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewObjects = powerbi.DataViewObjects;
import Fill = powerbi.Fill;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimitiveValue = powerbi.PrimitiveValue;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;

//Было по умолчанию
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import {createTooltipServiceWrapper, ITooltipServiceWrapper} from "powerbi-visuals-utils-tooltiputils";

import { getValue, getCategoricalObjectValue, getValueMeasure, getNameMeasure } from "./objectEnumerationUtility";

import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { image } from "d3";
// import { linkVertical } from "d3";



interface CardViewModel {
    data: CardDataPoint[];
    settings: CardSettings;
}

interface CardDataPoint {
    url: string; // category data
    header: string; // category data
    info: {
        label: string;
        value: PrimitiveValue;
        colorValue: string;
    }[];
    selectionId: ISelectionId;
}

interface CardSettings {
    card: {
        width: number;
        borderRadius: number;
        opacity: number;
    };

    image: {
        borderRadius: number;
        height: number;
    };

    header: {
        fontSize: number;
        fill: string;
    };

    info: {
        fontSize: number;
        fillLabel: string;
    }
}

let defaultSettings: CardSettings = {
    card: {
        borderRadius: 15,
        width: 100,
        opacity: 100,
    },
    image: {
        borderRadius: 15,
        height: 100,
    },
    header: {
        fontSize: 18,
        fill: "#000000",
    },
    info: {
        fillLabel: "#D9D9D9",
        fontSize: 14,
    }
}


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): CardViewModel {
    let dataViews = options.dataViews;

    let viewModel: CardViewModel = {
        data: [],
        settings: <CardSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || (dataViews[0].categorical.categories.length < 2)
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.categories[1].source
        || !dataViews[0].categorical.values) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let categoryImage = categorical.categories[0];
    let categoryTitle = categorical.categories[1];
    let dataValue = categorical.values;

    let cardDataPoints: CardDataPoint[] = [];

    let objects = dataViews[0].metadata.objects;

    let cardSettings: CardSettings = {
        card: {
            opacity: getValue<number>(objects, 'card', 'opacity', defaultSettings.card.opacity),
            borderRadius: getValue<number>(objects, 'card', 'borderRadius', defaultSettings.card.borderRadius),
            width: getValue<number>(objects, 'card', 'width', defaultSettings.card.width),
        },
        image: {
            borderRadius: getValue<number>(objects, 'image', 'borderRadius', defaultSettings.image.borderRadius),
            height: getValue<number>(objects, 'image', 'height', defaultSettings.image.height),
        },
        header: {
            fill: getValue<Fill>(objects, "header", "fill", { solid: { color: defaultSettings.header.fill } })
                .solid.color,
            fontSize: getValue<number>(objects, "header", "fontSize", defaultSettings.header.fontSize)
        },
        info: {
            fontSize: getValue<number>(objects, "info", "fontSize", defaultSettings.info.fontSize),
            fillLabel: getValue<string>(objects, "info", "fillLabel", defaultSettings.info.fillLabel)
        }
    }

    let defaultColor: Fill = {
        solid: {
            color: "#000000"
        }
    }

    for (let index = 0, len = Math.max(categoryImage.values.length, categoryTitle.values.length, dataValue[0].values.length); index < len; index++) {
        const info: { colorValue: string, label: string, value: PrimitiveValue }[] = []

        for (let j = 0; j < dataValue.length; j++) {
            let indexCategory = index;
            info.push(
                {
                    colorValue: getCategoricalObjectValue<Fill>(
                        categoryImage,
                        indexCategory,
                        'colorSelector' + (j + 1),
                        'fill',
                        defaultColor
                    ).solid.color,
                    label: <string>getNameMeasure(dataValue, index, j),
                    value: getValueMeasure(dataValue, index, j)
                }
            )
        }

        const selectionId: ISelectionId = host.createSelectionIdBuilder().withCategory(categoryImage, index).createSelectionId();

        cardDataPoints.push({
            selectionId: selectionId,
            url: `${categoryImage.values[index]}`,
            header: `${categoryTitle.values[index]}`,
            info: info
        })

    }

    return {
        data: cardDataPoints,
        settings: cardSettings
    }
}





export class Visual implements IVisual {
    private svg: Selection<any>;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private cardDataPoints: CardDataPoint[];
    private cardDataSettings: CardSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private element: HTMLElement;
    private cardContainer: Selection<SVGElement>;
    private cardSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;



    static Config = {
        card: {
            indentOutX: 20,
            indentInnerX: 10,
            indentOutY: 20,
            indentInnerY: 10,
            solidOpacity: 1,
            transparentOpacity: 0.4,
            paddingBottom: 10
        },

        image: {
            indentX: 10,
            indentY: 10,
        },

        header: {
            paddingTop: 15
        },

        info: {
            paddingTop: 15
        }

    };

    constructor(options: VisualConstructorOptions) {
        debugger
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();


        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.cardSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
        });

        console.log(this.host.tooltipService);
        console.log(createTooltipServiceWrapper(this.host.tooltipService, options.element));
        
        
        //this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

    }
    private syncSelectionState(
        selection: Selection<CardDataPoint>,
        selectionIds: ISelectionId[]
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            const opacity: number = this.cardDataSettings.card.opacity / 100;
            selection
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);

            return;
        }

        const self: this = this;

        selection.each(function (cardDataPoint: CardDataPoint) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, cardDataPoint.selectionId);

            const opacity: number = isSelected
                ? Visual.Config.card.solidOpacity
                : Visual.Config.card.transparentOpacity;

            d3Select(this)
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
        });
    }

    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }

    public update(options: VisualUpdateOptions) {

        let viewModel: CardViewModel = visualTransform(options, this.host);

        let settings = this.cardDataSettings = viewModel.settings;
        this.cardDataPoints = viewModel.data;

        let width = options.viewport.width; //ширина визуального элемента
        let height = options.viewport.height;   //высота визуального элемента

        let translates = this.getTranslateCards(viewModel, width);

        let heightSvg = Math.max(...translates.translateY) + this.getHeightCard(viewModel);

        if (height < heightSvg) {
            this.turnOnScrollable();
            heightSvg += Visual.Config.card.indentOutY;
        }
        else {
            this.turnOffScrollable();
        }


        this.element.innerHTML = null;
        this.svg = d3Select(this.element)
            .append('svg')
            .classed('cardsVisual', true);

        this.cardContainer = this.svg
            .append('g')
            .classed('cardContainer', true);

        this.svg
            .attr("width", width)
            .attr("height", heightSvg);

        this.cardSelection = this.cardContainer
            .selectAll('.card')
            .data(this.cardDataPoints);


        const cardSelectionMerged = this.cardSelection
            .enter()
            .append('rect')
            .merge(<any>this.cardSelection);


        cardSelectionMerged.classed('bar', true);

        const opacity: number = viewModel.settings.card.opacity / 100;

        cardSelectionMerged
            .attr("width", settings.card.width)
            .attr("height", this.getHeightCard(viewModel))
            .attr("y", (d, i) => translates.translateY[i])
            .attr("x", (d, i) => translates.translateX[i])
            .style("fill-opacity", opacity)
            .style("stroke-opacity", opacity)
            .style("fill", "#ffddff");



        cardSelectionMerged.on('click', (d) => {

            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
           // if (this.host.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;

                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(cardSelectionMerged, ids);
                    });

                (<Event>getEvent()).stopPropagation();
            //}
        });
    }


    private getTranslateCards(cards: CardViewModel, widthVisual: number): { translateX: Array<number>, translateY: Array<number> } {
        let quantityCards = cards.data.length,
            translateX = new Array<number>(quantityCards),
            translateY = new Array<number>(quantityCards);
        for (let i = 0; i < quantityCards; i++) {
            if (i === 0) {
                translateX[i] = Visual.Config.card.indentOutX;
                translateY[i] = Visual.Config.card.indentOutY;
            } else {
                let prevCardsX = translateX[i - 1] + cards.settings.card.width;
                let currentCardWidth = Visual.Config.card.indentInnerX + cards.settings.card.width + Visual.Config.card.indentOutX;

                if (widthVisual > prevCardsX + currentCardWidth) {
                    translateX[i] = translateX[i - 1] + cards.settings.card.width + Visual.Config.card.indentInnerX;
                    translateY[i] = translateY[i - 1];
                } else {
                    translateX[i] = Visual.Config.card.indentOutX;
                    translateY[i] = translateY[i - 1] + this.getHeightCard(cards) + Visual.Config.card.indentInnerY;
                }
            }
        }
        return { translateX, translateY };
    }


    private getHeightCard(cards: CardViewModel): number {

        if (cards === undefined) {
            return 0;
        }
        if (cards.data === undefined) {
            return 0
        }

        let lengthInfo = cards.data[0].info.length; //количество мер

        let headerViewModel = cards.settings.header;
        let imageViewModel = cards.settings.image;
        let infoViewModel = cards.settings.info;

        let configCard = Visual.Config.card;
        let configImage = Visual.Config.image;
        let configHeader = Visual.Config.header;
        let configInfo = Visual.Config.info;


        let imageSize = configImage.indentY * 2 + imageViewModel.height;
        let headerSize = configHeader.paddingTop + headerViewModel.fontSize;
        let infoSize = (configInfo.paddingTop + infoViewModel.fontSize) * lengthInfo;

        return imageSize + headerSize + infoSize;
    }


    private turnOnScrollable(): void {
        this.element.style.overflowY = 'scroll';
    }

    private turnOffScrollable(): void {
        this.element.style.overflowY = 'hidden';
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.cardDataSettings ||
            !this.cardDataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'card':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        borderRadius: this.cardDataSettings.card.borderRadius,
                        width: this.cardDataSettings.card.width
                    },
                    selector: null
                });
                break;
            case 'colorSelector1':
                let numberMeasure = 1; //номер меры 
                this.colorSelector(numberMeasure, objectEnumeration, objectName);
                break;
            case 'colorSelector2':
                numberMeasure = 2; //номер меры 
                this.colorSelector(numberMeasure, objectEnumeration, objectName);
                break;
            case 'colorSelector3':
                numberMeasure = 3; //номер меры 
                this.colorSelector(numberMeasure, objectEnumeration, objectName);
                break;
            case 'colorSelector4':
                numberMeasure = 4; //номер меры 
                this.colorSelector(numberMeasure, objectEnumeration, objectName);
                break;
            case 'image':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        borderRadius: this.cardDataSettings.image.borderRadius,
                        height: this.cardDataSettings.image.height
                    },
                    selector: null
                });
                break;
            case 'header':
            case 'info':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fillLabel: this.cardDataSettings.info.fillLabel,
                        fontSize: this.cardDataSettings.info.fontSize
                    },
                    selector: null
                });
                break;
        };
        return objectEnumeration;
    }

    private colorSelector(numberMeasure: number, objectEnumeration: VisualObjectInstance[], objectName: string) {
        for (let i = 0; i < this.cardDataPoints.length; i++) {
            if (this.cardDataPoints[i].info[numberMeasure - 1]) {
                objectEnumeration.push({
                    objectName: objectName,
                    displayName: 'Card ' + (i + 1) + ': ' + this.cardDataPoints[i].info[numberMeasure - 1].label,
                    properties: {
                        fill: {
                            solid: {
                                color: this.cardDataPoints[i].info[numberMeasure - 1].colorValue
                            }
                        }
                    },
                    propertyInstanceKind: {
                        fill: VisualEnumerationInstanceKinds.ConstantOrRule
                    },
                    altConstantValueSelector: this.cardDataPoints[i].selectionId.getSelector(),
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals)
                });
            }
        }
    }

    public destroy(): void {
        // Perform any cleanup tasks here
    }

}
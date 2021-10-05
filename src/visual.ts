"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import {
    select as d3Select
} from "d3-selection";
const getEvent = () => require("d3-selection").event;

type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;

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
import "regenerator-runtime/runtime"; //необходим для подсказок

//Было по умолчанию
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { getValue, getCategoricalObjectValue, getValueMeasure, getNameMeasure } from "./objectEnumerationUtility";

import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { values } from "d3";


interface CardViewModel {
    data: CardDataPoint[];
    settings: CardSettings;
}

interface CardDataPoint {
    url: string; // category data
    header: string; // category data
    label: {
        value: string;
    }[];
    data: {
        value: PrimitiveValue;
        fill: string;
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

    label: {
        fontSize: number;
        fill: string;
    },
    data: {
        fontSize: number,
    }
}

let defaultSettings: CardSettings = {
    card: {
        borderRadius: 15,
        width: 150,
        opacity: 100,
    },
    image: {
        borderRadius: 15,
        height: 170,
    },
    header: {
        fontSize: 16,
        fill: "#000000",
    },
    label: {
        fill: "#909090",
        fontSize: 15,
    },
    data: {
        fontSize: 15,
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
    let dataValue = categorical.values.filter((value, index) => value.source.roles.measure === true);


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
        label: {
            fontSize: getValue<number>(objects, "label", "fontSize", defaultSettings.label.fontSize),
            fill: getValue<Fill>(objects, "label", "fill", { solid: { color: defaultSettings.label.fill } })
                .solid.color,
        },
        data: {
            fontSize: getValue<number>(objects, "data", "fontSize", defaultSettings.data.fontSize),
        }
    }


    let defaultColor: Fill = {
        solid: {
            color: "#000000"
        }
    }

    for (let index = 0, len = Math.max(categoryImage.values.length, categoryTitle.values.length, dataValue[0].values.length); index < len; index++) {
        const labels: { value: string }[] = []
        const data: { fill: string, value: PrimitiveValue }[] = []

        for (let j = 0; j < dataValue.length; j++) {
            let indexCategory = index;
            labels.push(
                {
                    value: <string>getNameMeasure(dataValue, index, j),
                }
            );
            data.push(
                {
                    fill: getCategoricalObjectValue<Fill>(
                        categoryImage,
                        indexCategory,
                        'colorSelector' + (j + 1),
                        'fill',
                        defaultColor
                    ).solid.color,
                    value: getValueMeasure(dataValue, index, j),
                }
            );
        }

        const selectionId: ISelectionId = host.createSelectionIdBuilder().withCategory(categoryImage, index).createSelectionId();

        cardDataPoints.push({
            selectionId: selectionId,
            url: `${categoryImage.values[index]}`,
            header: `${categoryTitle.values[index]}`,
            label: labels,
            data: data
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


    private isLandingPageOn: boolean;
    private LandingPageRemoved: boolean;
    private LandingPage: Selection<any>;


    private quantityMeasures: number = 0;
    private quantityCard: number = 0;

    private config() {
        let widthCard = defaultSettings.card.width;

        let imageIndentX = 10;
        let imageIndentY = 10;
        let imageWidth = this.cardDataSettings.card.width - imageIndentX * 2;
        
        let headerPaddingTop = this.cardDataSettings.header.fontSize;
        let headerCoordinateY = imageIndentY * 2 + this.cardDataSettings.image.height + headerPaddingTop;
        let headerCoordinateX = this.cardDataSettings.card.width / 2;

        let labelCoordinates: { x: number, y: number }[] = [];
        let dataCoordinates: { x: number, y: number }[] = [];
        let dataPaddingTop = 10;

        if (this.cardDataPoints[0]) {
            if (this.cardDataPoints[0].data) {
                for (let i = 0; i < this.quantityMeasures; i++) {
                    let labelFontSize = this.cardDataSettings.label.fontSize;
                    let labelCoordinateX = 10;
                    let labelCoordinateY = headerCoordinateY + (dataPaddingTop + labelFontSize) * (i + 1);

                    let dataCoordinateX = widthCard - labelCoordinateX;
                    let dataCoordinateY = labelCoordinateY;
                    labelCoordinates.push({ x: labelCoordinateX, y: labelCoordinateY });
                    dataCoordinates.push({ x: dataCoordinateX, y: dataCoordinateY });
                }
            }
        }




        return {
            card: {
                indentOutX: 20,
                indentInnerX: 15,
                indentOutY: 20,
                indentInnerY: 20,
                solidOpacity: 1,
                transparentOpacity: 0.3,
                paddingBottom: 10,
                fill: "#ffffff",
            },

            image: {
                indentX: imageIndentX,
                indentY: imageIndentY,
                width: imageWidth,
                coordinateX: imageIndentX,
                coordinateY: imageIndentY,
            },

            header: {
                paddingTop: headerPaddingTop,
                coordinateX: headerCoordinateX,
                coordinateY: headerCoordinateY,
            },

            data: {
                paddingTop: dataPaddingTop,
                coordinate: dataCoordinates
            },

            label: {
                paddingTop: dataPaddingTop,
                coordinate: labelCoordinates
            }
        }
    }


    constructor(options: VisualConstructorOptions) {

        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();

        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.cardSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
        });


        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);


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
            // selection
            //     .style("fill-opacity", opacity)
            //     .style("stroke-opacity", opacity);
         
            
            selection
                .selectAll('image')
                .style("opacity", opacity)
                .style("stroke-opacity", opacity);

            selection
                .selectAll('text')
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
            
            selection
                .selectAll('rect')
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
            return;
        }

        const self: this = this;

        let solidOpacity = this.config().card.solidOpacity
        let transparentOpacity = this.config().card.transparentOpacity


        selection.each(function (cardDataPoint: CardDataPoint) {

            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, cardDataPoint.selectionId);

            const opacity: number = isSelected
                ? solidOpacity
                : transparentOpacity;

            // d3Select(this)
            //     .style("fill-opacity", opacity)
            //     .style("stroke-opacity", opacity);

                
            d3Select(this)
                .selectAll('image')
                .style("opacity", opacity)
                .style("stroke-opacity", opacity);

            d3Select(this)
                .selectAll('text')
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
            
            d3Select(this)
                .selectAll('rect')
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

    private createSampleLandingPage(): Element {
        let div = document.createElement("div");

        let header = document.createElement("h1");
        header.textContent = "Sample Bar Chart Landing Page";
        header.setAttribute("class", "LandingPage");
        let p1 = document.createElement("a");
        p1.setAttribute("class", "LandingPageHelpLink");
        p1.textContent = "Learn more about Landing page";

        p1.addEventListener("click", () => {
            this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/docs/overview/");
        });

        div.appendChild(header);
        div.appendChild(p1);

        return div;
    }

    private handleLandingPage(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews.length) {
            if (!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                const SampleLandingPage: Element = this.createSampleLandingPage();
                this.element.appendChild(SampleLandingPage);

                this.LandingPage = d3Select(SampleLandingPage);
            }

        } else {
            if (this.isLandingPageOn && !this.LandingPageRemoved) {
                this.LandingPageRemoved = true;
                this.LandingPage.remove();
            }
        }
    }


    private getTooltipData(value: CardDataPoint): VisualTooltipDataItem[] {
        return [{
            displayName: value.url,
            value: value.header.toString(),
            color: "#ff00ff"
        }];
    }


    private getTranslateCards(cards: CardViewModel, widthVisual: number): { translateX: Array<number>, translateY: Array<number> } {
        let translateX = new Array<number>(this.quantityMeasures),
            translateY = new Array<number>(this.quantityMeasures);
        for (let i = 0; i < this.quantityCard; i++) {
            if (i === 0) {
                translateX[i] = this.config().card.indentOutX;
                translateY[i] = this.config().card.indentOutY;
            } else {
                let prevCardsX = translateX[i - 1] + cards.settings.card.width;
                let currentCardWidth = this.config().card.indentInnerX + cards.settings.card.width + this.config().card.indentOutX;

                if (widthVisual > prevCardsX + currentCardWidth) {
                    translateX[i] = translateX[i - 1] + cards.settings.card.width + this.config().card.indentInnerX;
                    translateY[i] = translateY[i - 1];
                } else {
                    translateX[i] = this.config().card.indentOutX;
                    translateY[i] = translateY[i - 1] + this.getHeightCard(cards) + this.config().card.indentInnerY;
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

        let lengthInfo = cards.data[0].data.length; //количество мер

        let headerViewModel = cards.settings.header;
        let imageViewModel = cards.settings.image;
        let labelViewModel = cards.settings.label;

        let configCard = this.config().card;
        let configImage = this.config().image;
        let configHeader = this.config().header;
        let configLabel = this.config().label;
        let configData = this.config().data;

        let imageSize = configImage.indentY * 2 + imageViewModel.height;
        let headerSize = configHeader.paddingTop + headerViewModel.fontSize;
        let infoSize = (Math.max(configLabel.paddingTop, configData.paddingTop) + labelViewModel.fontSize) * lengthInfo;

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
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSize: this.cardDataSettings.header.fontSize,
                        fill: this.cardDataSettings.header.fill
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'label':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fill: this.cardDataSettings.label.fill,
                        fontSize: this.cardDataSettings.label.fontSize,
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'data':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSize: this.cardDataSettings.data.fontSize,
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
        };
        return objectEnumeration;
    }

    private colorSelector(numberMeasure: number, objectEnumeration: VisualObjectInstance[], objectName: string) {
        for (let i = 0; i < this.cardDataPoints.length; i++) {
            if (this.cardDataPoints[i].data) {
                objectEnumeration.push({
                    objectName: objectName,
                    displayName: 'Card ' + (i + 1) + ': ' + this.cardDataPoints[i].label[numberMeasure - 1].value,
                    properties: {
                        fill: {
                            solid: {
                                color: this.cardDataPoints[i].data[numberMeasure - 1].fill
                            }
                        },
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

    private handleClick(barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>) {
        // Clear selection when clicking outside a bar
        this.svg.on('click', (d) => {
            //if (this.host.allowInteractions) {
            this.selectionManager
                .clear()
                .then(() => {
                    this.syncSelectionState(barSelection, []);
                });
            //}
        });
    }

    public update(options: VisualUpdateOptions) {
        this.element.innerHTML = null;

        this.handleLandingPage(options);
        let viewModel: CardViewModel = visualTransform(options, this.host);

        let settings = this.cardDataSettings = viewModel.settings;
        this.cardDataPoints = viewModel.data;

        this.quantityMeasures = this.cardDataPoints.length > 0? this.cardDataPoints[0].data.length: 0
        if(this.quantityMeasures === 0){
            return
        }
        this.quantityCard = this.cardDataPoints.length;


        let width = options.viewport.width; //ширина визуального элемента
        let height = options.viewport.height;   //высота визуального элемента


        let translates = this.getTranslateCards(viewModel, width);

        
        let heightAllCards = Math.max(...translates.translateY) + this.getHeightCard(viewModel);
        
        if (height < heightAllCards) {
            this.turnOnScrollable();
            heightAllCards += this.config().card.indentOutY;
        }
        else {
            this.turnOffScrollable();
        }

        
       
        this.svg = d3Select(this.element)
            .append('svg')
            .classed('cardsVisual', true);

        this.cardContainer = this.svg
            .append('g')
            .classed('cardContainer', true);

        this.svg
            .attr("width", width)
            .attr("height", Math.max(heightAllCards, height));

        this.cardSelection = this.cardContainer
            .selectAll('.card')
            .data(this.cardDataPoints);


        const opacity: number = viewModel.settings.card.opacity / 100;


        const cardSelectionMerged = this.cardSelection
            .enter()
            .append('g')
            .attr('transform',
                (d, i) => 'translate(' + translates.translateX[i] + ',' + translates.translateY[i] + ')')
            .merge(<any>this.cardSelection);


        cardSelectionMerged.classed('card', true);


        cardSelectionMerged
            .append("rect")
            .attr("width", settings.card.width)
            .attr("height", this.getHeightCard(viewModel))
            .attr("y", 0)
            .attr("x", 0)
            .style("fill", this.config().card.fill)
            .attr('rx', settings.card.borderRadius);

        const widthCard = settings.card.width - this.config().image.indentX * 2
        cardSelectionMerged
            .append('defs')
            .append("clipPath")
            .attr("id", "round-corner")
            .append("rect")
            .attr("x", this.config().image.indentX)
            .attr("y", this.config().image.indentY)
            .attr("width", widthCard)
            .attr('height', settings.image.height)
            .attr('rx', settings.image.borderRadius);



        cardSelectionMerged
            .append("image")
            .attr('x', this.config().image.coordinateX)
            .attr('y', this.config().image.coordinateY)
            .attr('height', settings.image.height)
            .attr('width', this.config().image.width)
            .attr('xlink:href', (d, i) => d.url)
            .attr("clip-path", "url(#round-corner)")
            .attr('preserveAspectRatio', 'xMidYMid slice');

       
            
        cardSelectionMerged
            .append('text')
            .attr('y', this.config().header.coordinateY)
            .attr('x', this.config().header.coordinateX)
            .attr('text-anchor', 'middle')
            .style('font-size', settings.header.fontSize)
            .style('font-weight', 500)
            .style('fill', settings.header.fill)
            .text((d, i) => d.header);


        for (let j = 0; j < this.quantityMeasures; j++) {
            //label
            cardSelectionMerged
                .append('text')
                .attr('y', this.config().label.coordinate[j].y)
                .attr('x', this.config().label.coordinate[j].x)
                .style('font-size', settings.label.fontSize)
                .style('fill', settings.label.fill)
                .text((d, i) => d.label[j].value);

                
            //data
            cardSelectionMerged
                .append('text')
                .attr('y', this.config().data.coordinate[j].y)
                .attr('x', widthCard + this.config().label.coordinate[j].x)
                 .attr('text-anchor', 'end')
                .style('font-size', settings.data.fontSize)
                .style('fill', (d, i) => d.data[j].fill)
                .text((d, i) => d.data[j].value);
        }


        this.tooltipServiceWrapper.addTooltip(cardSelectionMerged,
            (datapoint: CardDataPoint) => this.getTooltipData(datapoint),
            (datapoint: CardDataPoint) => datapoint.selectionId
        );



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


        this.syncSelectionState(cardSelectionMerged, this.selectionManager.getSelectionIds() as ISelectionId[]);


        this.handleClick(cardSelectionMerged);
    }
}
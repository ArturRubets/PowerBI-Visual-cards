"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
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

//Было по умолчанию
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

//import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { getValue, getCategoricalObjectValue, getValueMeasure, getNameMeasure } from "./objectEnumerationUtility";

import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
// import { linkVertical } from "d3";

//было по умолчанию
//import { CardSettings } from "./settings";


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
        width: 150,
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
                        'colorSelector' + (j+1),
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
    // private svg: Selection<any>;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private cardDataPoints: CardDataPoint[];
    private cardDataSettings: CardSettings;
    //private tooltipServiceWrapper: ITooltipServiceWrapper;
    private element: HTMLElement;

    static Config = {

    };

    constructor(options: VisualConstructorOptions) {



        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();



        // this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

    }

    public update(options: VisualUpdateOptions) {


        let viewModel: CardViewModel = visualTransform(options, this.host);
        let settings = this.cardDataSettings = viewModel.settings;
        this.cardDataPoints = viewModel.data;
        console.log(options.dataViews[0].categorical.categories);
        console.log(viewModel);


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

    private colorSelector(numberMeasure:number, objectEnumeration: VisualObjectInstance[], objectName:string) {
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
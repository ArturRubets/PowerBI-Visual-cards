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

import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { getValue, getCategoricalObjectValue, getValueMeasure } from "./objectEnumerationUtility";

import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { linkVertical } from "d3";

//было по умолчанию
//import { CardSettings } from "./settings";


interface CardViewModel {
    data: CardDataPoint[];
    settings: CardSettings;
}

interface CardDataPoint {
    url: string; // category data
    title: string; // category data
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

    title: {
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
    title: {
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
        title: {
            fill: getValue<Fill>(objects, "title", "fill", { solid: { color: defaultSettings.title.fill } })
                .solid.color,
            fontSize: getValue<number>(objects, "title", "fontSize", defaultSettings.title.fontSize)
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
        const info: {colorValue:string, label:string, value:PrimitiveValue}[] = []

        // for (let j = 0; j < dataValue.values.length; j++) {
        //     colorValues.push(
        //         getCategoricalObjectValue<Fill>(
        //             category,
        //             index,
        //             'colorSelector',
        //             'fill' + (j + 1),
        //             defaultColor
        //         ).solid.color
        //     );
        // }

        const selectionId: ISelectionId = host.createSelectionIdBuilder().withCategory(categoryImage, index).createSelectionId();

        cardDataPoints.push({
            selectionId: selectionId,
            url: `${categoryImage.values[index]}`,
            title: `${categoryTitle.values[index]}`,
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

    static Config = {

    };

    constructor(options: VisualConstructorOptions) {
        console.log('Visual constructor', options);
        this.target = options.element;
        this.updateCount = 0;
        if (document) {
            const new_p: HTMLElement = document.createElement("p");
            new_p.appendChild(document.createTextNode("Update count:"));
            const new_em: HTMLElement = document.createElement("em");
            this.textNode = document.createTextNode(this.updateCount.toString());
            new_em.appendChild(this.textNode);
            new_p.appendChild(new_em);
            this.target.appendChild(new_p);
        }
    }

    public update(options: VisualUpdateOptions) {
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        console.log('Visual update', options);
        if (this.textNode) {
            this.textNode.textContent = (this.updateCount++).toString();
        }
    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}
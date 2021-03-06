import { Primitive } from "d3-array";
import powerbiVisualApi from "powerbi-visuals-api";
import powerbi = powerbiVisualApi;

import DataViewObject = powerbi.DataViewObject;
import DataViewObjects = powerbi.DataViewObjects;
import DataViewCategoryColumn = powerbi.DataViewCategoricalColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import PrimitiveValue = powerbi.PrimitiveValue;

/**
 * Gets property value for a particular object.
 *
 * @function
 * @param {DataViewObjects} objects - Map of defined objects.
 * @param {string} objectName       - Name of desired object.
 * @param {string} propertyName     - Name of desired property.
 * @param {T} defaultValue          - Default value of desired property.
 */
export function getValue<T>(objects: DataViewObjects,
    objectName: string, properyName: string, defaultValue: T): T {
    if (objects) {
        let object = objects[objectName];
        if (object) {
            let property: T = <T>object[properyName];
            if (property !== undefined) {
                return property;
            }
        }
    }
    return defaultValue;
}

export function getValueMeasure(valuesMeasures: powerbi.DataViewValueColumn[], indexCard: number, indexMeasure: number):PrimitiveValue{
    if(valuesMeasures){
        let values = valuesMeasures[indexMeasure];
        if(values){
            if(values.values){
                return values.values[indexCard];
            }
        }
    }
    return null;
}

export function getNameMeasure(valuesMeasures: powerbi.DataViewValueColumn[], indexCard: number, indexMeasure: number):PrimitiveValue{
    if(valuesMeasures){
        let values = valuesMeasures[indexMeasure];
        if(values){
            return values.source.displayName;
        }
    }
    return null;
}


export function getCategoricalObjectValue<T>(category:DataViewCategoryColumn, index:number, objectName:string, propertName:string, defaultName:T):T{
    let categoryObjects = category.objects;
    if(categoryObjects){
        let categoryObject:DataViewObject = categoryObjects[index];
        if(categoryObject){
            let object = categoryObject[objectName];
            if(object){
                let property:T = <T>object[propertName];
                if(property !== undefined){
                    return property;
                }
            }
        }
    }
    return defaultName;
}


import { convertKitchenMetrics, getShorthandForMeasure, normalizeToGrams, getMaxSize } from "./conversion";
import { safeToObject } from "./utils";
function calculateEfficiency(neededAmount, minPurchase) {
    const efficiency = (neededAmount / (Math.ceil(neededAmount / minPurchase) * minPurchase)) * 100;
    return efficiency.toFixed(2); // Rounds to two decimal places
}

export function filter(itemList, filterObj) {
    let validList = []
    const skipConversion = filterObj.skipConversion === 'true' || filterObj.skipConversion === true;

    for (let item in itemList) {
        let current = itemList[item];
        let unit_price_converted = current.unit_price
        let unit_price_converted_type = current.quantity_unit
        let total_price;
        let match_efficiency;

        // Normalize requested quantity unit. If "any", try to treat as "each" for comparison.
        const requestedUnit = (filterObj.quantity_unit === "any" || !filterObj.quantity_unit) ? "each" : filterObj.quantity_unit;

        if (!skipConversion) {
            // ─── Step 1: Normalize requested qty to grams ───────────────────────
            // Use the global grams_per_each (from SearchLogLookup) if it's available and positive.
            // This is the key that lets "1 each carrot" and "60g carrot" both resolve to the same gram value.
            const globalGramsPerEach = (filterObj.grams_per_each && Number(filterObj.grams_per_each) > 0)
                ? Number(filterObj.grams_per_each)
                : (current.grams_per_each && current.grams_per_each > 0 ? current.grams_per_each : null);

            let targetNorm = normalizeToGrams(requestedUnit, filterObj.quantity, globalGramsPerEach);
            let itemNorm = normalizeToGrams(current.quantity_unit, current.quantity, (current.grams_per_each && current.grams_per_each > 0) ? current.grams_per_each : globalGramsPerEach);

            let targetGrams = targetNorm.value;
            let itemGrams = itemNorm.value;
            let conversion_source = itemNorm.source;

            if (targetGrams !== null && itemGrams !== null) {
                // ─── Step 2: Apply max size normalization ────────────────────────
                // Determine the max comparison size. It can be an explicit amount (e.g., 1000g)
                // or derived from the item's unit type.
                let comparisonGrams: number;

                if (filterObj.maxSize && filterObj.maxSizeUnit) {
                    // Explicit max size was passed (e.g., maxSize=1000 maxSizeUnit=gram)
                    const maxNorm = normalizeToGrams(filterObj.maxSizeUnit, parseFloat(filterObj.maxSize), current.grams_per_each);
                    comparisonGrams = maxNorm.value !== null ? maxNorm.value : targetGrams;
                } else {
                    // Derive from defaults: use the unit type of the item/request to pick max
                    const unitType = current.quantity_unit === 'each' ? 'each' :
                        (convertKitchenMetrics(current.quantity_unit, 1) ? 'weight' : 'each');
                    const maxSizeDef = getMaxSize(unitType, filterObj.category || null, filterObj.customMaxSizes || null);
                    const maxNorm = normalizeToGrams(maxSizeDef.unit, maxSizeDef.quantity, current.grams_per_each);
                    comparisonGrams = maxNorm.value !== null ? maxNorm.value : targetGrams;
                }

                // ─── Step 3: Price at max comparison size ────────────────────────
                // If the requested amount exceeds the max size, scale up to the next whole multiple
                // e.g., 2000g requested, max=1000g → comparisonGrams = 2000g (2× max)
                if (targetGrams > comparisonGrams) {
                    const multiples = Math.ceil(targetGrams / comparisonGrams);
                    comparisonGrams = comparisonGrams * multiples;
                }

                const gramPrice = current.price / itemGrams;           // price per gram
                unit_price_converted = gramPrice;
                unit_price_converted_type = "gram";
                total_price = gramPrice * comparisonGrams;             // total at comparison size
                match_efficiency = calculateEfficiency(targetGrams, itemGrams);
            } else {
                // Can't normalize — fall through to quantity-type matching
                if (!(matchQuantityType(current, filterObj))) {
                    continue;
                }
                total_price = (filterObj.quantity / current.quantity) * current.price;
                match_efficiency = 100;
            }
        } else {
            // skipConversion path — no normalization
            if (!(matchQuantityType(current, filterObj))) {
                continue;
            }
            total_price = (filterObj.quantity / current.quantity) * current.price;
            match_efficiency = 100;
        }

        // Only if we have a price!
        if (current.price === undefined || current.price === null) {
            continue
        }

        try {
            validList.push({
                ...safeToObject(current),
                "unit_price_converted_type": unit_price_converted_type,
                "unit_price_converted": unit_price_converted,
                "total_price": total_price,
                "match_efficiency": match_efficiency,
                "conversion_source": skipConversion ? null : (itemList[item] as any).conversion_source
            })
        } catch (e) {
            console.log(e)
            console.log("failed to push")
        }
    }

    let ranked = [...validList].sort((b, a) => b.total_price - a.total_price)
        .map((e, i) => ({ rank: i + 1, ...e }))
    if (filterObj.returnN) {
        return ranked.filter(e => (e.rank <= filterObj.returnN))
    }
    return ranked
}


function matchSupplier(item, filterObj) {
    if (filterObj.supplier === undefined) {
        return true
    }

    if (item.supplier === filterObj.supplier) {
        return true
    }

    return false
}

function matchCategory(item, filterObj) {
    if (item.category === filterObj.category)
        return true
    else
        return false
}

function matchQuantityType(item, filterObj) {
    // console.log(item.quantity_unit)
    // console.log(filterObj.quantity_unit)
    if (filterObj.quantity_unit === undefined) return true
    // LATER we will need to change this, as quanitty type and quantity UNIT are not the same... 
    if (item.quantity_unit === filterObj.quantity_unit)
        return true
    else
        return false
}

function matchName(item, filterObj) {
    if (filterObj.search_term === undefined) return true
    // let score = similarity(item.name.toLowerCase(),filterObj.search_term.toLowerCase())
    // console.log(score)
    // if (score > 0.1){
    //     return true
    // } else {
    //     return false
    // }
    if (item.name.toLowerCase().includes(filterObj.search_term.toLowerCase()))
        return true
    else
        return false
}

function isCheapest(currentCheapest, item) {
    if (currentCheapest === undefined) {
        return true
    } else if (item.price < currentCheapest.price) {
        return true
    } else {
        return false
    }
}

// https://stackoverflow.com/questions/10473745/compare-strings-javascript-return-of-likely
function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    let longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}


function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue),
                            costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}
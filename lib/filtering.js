

export function filter(itemList, filterObj) {
    let validList = []
    console.log(itemList)
    console.log(filterObj)
    for (let item in itemList) {
        let current = itemList[item];

        if (!(matchQuantityType(current, filterObj))) {
            continue
        }

        // Only if we have a price!
        if (current.price === undefined || current.price === null) {
            continue
        }

        // if (!(matchSupplier(current, filterObj))) {
        //     continue
        // }

        // if (!(matchName(current, filterObj))) {
        //     continue
        // }

        validList.push({ ...current.toObject(), "totalCost": current.price * current.quantity })
    }

    // let ranks = validList.map(e => e.totalCost).sort((a, b) => b - a)
    let ranked = [...validList].sort((b, a) => b.totalCost - a.totalCost)
        .map((e, i) => ({ rank: i + 1, ...e }))
    // let ranked = validList.map(e => ({ ...e, rank: (ranks.indexOf(e.price) + 1) }));
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
    // console.log(item.quantity_type)
    // console.log(filterObj.quantity_type)
    if (filterObj.quantity_type === undefined) return true
    if (item.quantity_type === filterObj.quantity_type)
        return true
    else
        return false
}

function matchName(item, filterObj) {
    if (item.name.toLowerCase().includes(filterObj.name.toLowerCase()))
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

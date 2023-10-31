

export function filter(itemList, filterObj) {
    let validList = []
    console.log(itemList)
    console.log(filterObj)
    for (let item in itemList) {
        let current = itemList[item];

        if (!(matchQuantityType(current, filterObj))) {
            
            continue
        }
        // console.log(item)

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
        try {
            // current.score = similarity(current.name.toLowerCase(),filterObj.search_term.toLowerCase())
            validList.push(current.toObject())
            // validList.push({ ...current.toObject(), "totalCost": current.price * current.quantity })
        } catch (e) {
            console.log(e)
            console.log("failed to push")
        }
    }


    // let ranks = validList.map(e => e.totalCost).sort((a, b) => b - a)
    let ranked = [...validList].sort((b, a) => b.unit_price - a.unit_price)
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
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
      return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
  }


  function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
  
    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
      var lastValue = i;
      for (var j = 0; j <= s2.length; j++) {
        if (i == 0)
          costs[j] = j;
        else {
          if (j > 0) {
            var newValue = costs[j - 1];
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
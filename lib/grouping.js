
 async function handleActiveSupplierChange(inputObject) {
    await updateSupplierFromInputObject(inputObject)

}

function generateKey(obj, keys) {
    return keys.map(key => `${key}=${obj[key]}`).join('|');
}

function processEmptyKeyObjects(emptyKeyObjects, groupedLists) {
    emptyKeyObjects.forEach(obj => {
        const emptyKey = "";
        const emptyGroupKey = generateKey(obj, [emptyKey]);

        if (!groupedLists[emptyGroupKey]) {
            groupedLists[emptyGroupKey] = [];
        }

        groupedLists[emptyGroupKey].push(obj);
    });
}

function processRegularObjects(regularObjects, keysToGroupBy, groupedLists) {
    regularObjects.forEach(obj => {
        const key = generateKey(obj, keysToGroupBy.filter(key => key !== "complete"));

        if (key === undefined) {
            return;
        }

        if (!groupedLists[key]) {
            groupedLists[key] = [];
        }

        groupedLists[key].push(obj);
    });
}

function processCompleteObjects(completeObjects, groupedLists) {
    completeObjects.forEach(obj => {
        const completeKey = "complete";
        const completeGroupKey = generateKey(obj, [completeKey]);

        if (!groupedLists[completeGroupKey]) {
            groupedLists[completeGroupKey] = [];
        }

        groupedLists[completeGroupKey].push(obj);
    });
}

export function groupByKeys(data, keysToGroupBy) {
    const groupedLists = {
        "": [] // Initialize an empty key for empty values
    };

    // Separate the objects into three arrays based on key conditions
    const emptyKeyObjects = [];
    const completeObjects = [];
    const regularObjects = [];

    // Iterate through each JSON object
    data.forEach(obj => {
        // Check for an empty key and add to the corresponding array
        if (generateKey(obj, keysToGroupBy) === "") {
            emptyKeyObjects.push(obj);
        }
        // Check for "complete" key and add to the corresponding array
        else if (obj.complete === true) {
            completeObjects.push(obj);
        }
        // Otherwise, add to the regular array
        else {
            regularObjects.push(obj);
        }
    });

    // Process empty key objects first
    processEmptyKeyObjects(emptyKeyObjects, groupedLists);

    // Process regular objects next
    processRegularObjects(regularObjects, keysToGroupBy, groupedLists);

    // Process complete objects last
    processCompleteObjects(completeObjects, groupedLists);


    return groupedLists;
}
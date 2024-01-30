import React from 'react';

function convertStringToJSON(inputString) {
  // Split the input string into key-value pairs
  const keyValuePairs = inputString.split('|');

  // Initialize an empty object to store the key-value pairs
  const jsonObject = {};

  // Iterate over each key-value pair
  keyValuePairs.forEach(pair => {
    // Split each pair into key and value
    const [key, value] = pair.split('=');

    // Trim any extra whitespace from key and value
    const trimmedKey = key.trim();
    const trimmedValue = value !== undefined ? value.trim() : undefined;

    // Add the key-value pair to the object
    jsonObject[trimmedKey] = trimmedValue;
  });

  return jsonObject;
}

function compareJSONKeysAndValues(obj1, obj2) {
  // Get the entries (key-value pairs) of each object
  const entries1 = Object.entries(obj1);
  const entries2 = Object.entries(obj2);

  console.log(entries1, entries2)

  // Use the filter method to find entries in obj2 that are not in obj1
  const differenceEntries = entries2.filter(([key, value]) => {
    const matchingEntry = entries1.find(([key1, value1]) => key === key1 && value === value1);
    return !matchingEntry;
  });

  // Convert the result back to an object
  const resultObject = {};
  differenceEntries.forEach(([key, value]) => {
    resultObject[key] = value;
  });

  return resultObject;
}

const HighlightedTitles = ({ data, order, current }) => {
  const keyDataArray = order;
  console.log(order)
  // console.log(data)

  for (let i = 0; i < order.length; i++) {

    const keyData = order[i];

    if (keyData === current && i - 1 >= 0) {
      const previousEntry = order[i - 1];
      const newKeys = compareJSONKeysAndValues(
        convertStringToJSON(previousEntry),
        convertStringToJSON(keyData)
      );

      return <>{JSON.stringify(newKeys)}</>;
    }
  }

  return <>{JSON.stringify(current)}</>;
};

export default HighlightedTitles;

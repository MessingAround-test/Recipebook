const axios = require('axios');
const { convertMetricReading } = require('./lib/conversion.js');

async function testWW() {
    let search_term = 'eggs';
    let response = await axios({
        method: 'get',
        url: `https://www.woolworths.com.au/apis/ui/v2/Search/products?searchTerm=${search_term}`,
        headers: {
            'User-Agent': 'PostmanRuntime/7.28.4',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.woolworths.com.au'
        }
    })

    let filteredDataArray = []

    if (response.data && response.data.Products) {
        for (let productGroup of response.data.Products) {
            if (!productGroup.Products || productGroup.Products.length === 0) continue;

            let filteredData = productGroup.Products[0]
            let internal_id = filteredData.Stockcode || ""
            let name = filteredData.Name

            let price = filteredData.Price || filteredData.price
            let quantity_unit = filteredData.PackageSize || filteredData.measure || filteredData.CupMeasure
            let quantity = 1
            let quantity_type = "each"

            if (price !== undefined && price !== null) {
                let nameConversion = convertMetricReading(name)
                if (nameConversion.quantity !== 1 || nameConversion.quantity_unit !== 'each') {
                    quantity = nameConversion.quantity
                    quantity_unit = nameConversion.quantity_unit
                    quantity_type = nameConversion.quantity_type
                } else if (quantity_unit) {
                    let unitConversion = convertMetricReading(quantity_unit)
                    quantity = unitConversion.quantity
                    quantity_unit = unitConversion.quantity_unit
                    quantity_type = unitConversion.quantity_type
                }
            } else if (filteredData.CupPrice !== undefined) {
                price = filteredData.CupPrice
                quantity_unit = filteredData.CupMeasure || "1 each"
                let unitConversion = convertMetricReading(quantity_unit)
                quantity = unitConversion.quantity
                quantity_unit = unitConversion.quantity_unit
                quantity_type = unitConversion.quantity_type
            }

            let unit_price = quantity > 0 ? parseFloat((price / quantity).toFixed(3)) : price

            filteredDataArray.push({
                name, price, unit_price, quantity_unit, quantity_type, quantity
            })
        }
    }

    console.log(JSON.stringify(filteredDataArray.slice(0, 5), null, 2))
}
testWW();

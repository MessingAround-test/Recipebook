const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection;
    const Ingredients = db.collection('ingredients');

    // Target any WW products that might have the incorrectly parsed data 
    // Specifically looking for ones where quantity = 1 and quantity_unit contains 'each' but name implies > 1
    // Simplest fix: we can just drop any WW ingredient that matches our problem case, or 
    // just let the user use force=true in the UI or let them naturally expire.
    // For safety, removing only "Woolworths 12 Extra Large Barn Laid Eggs" specifically 
    // to allow the UI to pull a fresh copy.
    const result = await Ingredients.deleteMany({ "name": /Extra Large Barn Laid Eggs/i, "source": "WW" });
    console.log(`Deleted ${result.deletedCount} problematic egg entries.`);

    mongoose.disconnect();
}
run().catch(console.error);

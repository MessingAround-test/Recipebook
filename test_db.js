const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection;
    const Ingredients = db.collection('ingredients');

    const eggs = await Ingredients.find({ name: { $regex: /egg/i }, source: 'WW' }).limit(5).toArray();
    console.log(JSON.stringify(eggs, null, 2));

    mongoose.disconnect();
}
run().catch(console.error);

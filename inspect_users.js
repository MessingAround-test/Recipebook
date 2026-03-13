
const mongoose = require('mongoose');

// Need to read the connection string from .env.local
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env.local');
  process.exit(1);
}

async function inspect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    role: String,
    id: mongoose.Schema.Types.Mixed, // Check if this field exists
  }, { strict: false });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const users = await User.find({}).lean();
  console.log('Users in DB:');
  users.forEach(u => {
    console.log(`- _id: ${u._id}, username: ${u.username}, email: ${u.email}, role: ${u.role}, id: ${u.id}`);
  });

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

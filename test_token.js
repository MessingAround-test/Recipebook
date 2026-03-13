
const { sign, verify } = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
const secret = "123123123123123123"; // From lib/dbsecret.js

async function testToken() {
  await mongoose.connect(MONGODB_URI);
  
  const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    role: String,
    passwordHash: String
  }, { strict: false });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  // Find the 'test' user
  const user = await User.findOne({ email: 'test@test' });
  if (!user) {
    console.error('Test user not found');
    process.exit(1);
  }

  console.log('Found user:', user.email, 'with role:', user.role);

  // Simulate token generation in login.js
  const token = sign(
    { id: user._id, email: user.email, role: user.role },
    secret
  );

  console.log('Generated token:', token);

  // Verify token as in lib/auth.ts
  const decoded = verify(token, secret);
  console.log('Decoded token:', decoded);

  if (decoded.role === 'admin') {
    console.log('DECIDED ROLE IS ADMIN!');
  } else {
    console.log('DECIDED ROLE IS NOT ADMIN');
  }

  await mongoose.disconnect();
}

testToken().catch(err => {
  console.error(err);
  process.exit(1);
});

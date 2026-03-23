const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// Generate secure demo password from environment or random value
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || crypto.randomBytes(8).toString('hex');

async function updateAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('[SEED] Using demo password:', DEMO_PASSWORD);

    // First, check what admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    console.log('Existing admin:', existingAdmin ? existingAdmin.email : 'None found');

    // Delete old admin if exists and create new one
    if (existingAdmin) {
      await User.deleteOne({ role: 'admin' });
      console.log('Deleted old admin');
    }

    // Create new admin with proper password hashing
    const newAdmin = await User.create({
      name: 'Placement Officer',
      email: process.env.ADMIN_EMAIL || 'admin@university.edu',
      password: DEMO_PASSWORD,
      role: 'admin',
      isVerified: true,
      isApprovedByAdmin: true
    });

    console.log('Admin created/updated successfully');
    console.log('Email:', newAdmin.email);
    console.log('Role:', newAdmin.role);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

updateAdmin();

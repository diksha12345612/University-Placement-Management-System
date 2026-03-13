const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find(
    { role: { $in: ['recruiter', 'student'] } },
    { name: 1, email: 1, role: 1 }
  ).sort({ role: 1, name: 1 });

  const recruiters = users
    .filter((u) => u.role === 'recruiter')
    .map((u) => ({ name: u.name, email: u.email }));

  const students = users
    .filter((u) => u.role === 'student')
    .map((u) => ({ name: u.name, email: u.email }));

  console.log(JSON.stringify({ recruiters, students }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

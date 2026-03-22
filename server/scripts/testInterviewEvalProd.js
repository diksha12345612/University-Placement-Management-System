const BASE = 'https://university-placement-portal-seven.vercel.app/api';

// Use demo password from environment or provide a warning
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '111111';

async function run() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.khanna@student.demo', password: DEMO_PASSWORD })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.log('Login failed:', loginRes.status, loginData);
    process.exit(1);
  }

  const token = loginData.token;
  console.log('Login OK');

  const qRes = await fetch(`${BASE}/preparation/interview/questions?role=Software%20Engineer&count=5&types=technical,behavioral,hr`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const qData = await qRes.json();
  if (!qRes.ok) {
    console.log('Question generation failed:', qRes.status, qData);
    process.exit(1);
  }

  console.log('Questions fetched:', Array.isArray(qData) ? qData.length : 'non-array');
  const first = qData[0];
  if (!first?._id) {
    console.log('No question ID available:', first);
    process.exit(1);
  }

  const evalRes = await fetch(`${BASE}/preparation/interview/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      questionId: first._id,
      studentAnswer: 'I would approach this with a clear structure, trade-offs, and practical examples.'
    })
  });

  const evalData = await evalRes.json();
  console.log('Evaluate status:', evalRes.status);
  console.log('Evaluate body:', JSON.stringify(evalData, null, 2));
}

run().catch((e) => {
  console.error('Script error:', e.message);
  process.exit(1);
});

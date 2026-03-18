async function main() {
  const loginRes = await fetch('http://localhost:3000/v1/dashboard-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ops+ab6b2eba@vervet.local',
      password: 'Vervet-ab6b2eba-Login!'
    })
  });
  
  const loginData = await loginRes.json();
  const sessionToken = loginData.data.accessToken;
  
  const createRes = await fetch('http://localhost:3000/v1/partners/me/api-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      label: 'Video Demo Key',
      scopes: ['resolution:read', 'resolution:batch']
    })
  });
  const createData = await createRes.json();
  console.log(JSON.stringify(createData, null, 2));
}
main();

require('dotenv').config();

function generateAuthUrl() {
  const clientId = process.env.ZOHO_CRM_CLIENT_ID;
  const scope = process.env.ZOHO_CRM_SCOPE || 'ZohoCRM.modules.contacts.ALL';
  const redirectUri = process.env.ZOHO_CRM_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
  const accountsUrl = process.env.ZOHO_CRM_ACCOUNTS_URL || 'https://accounts.zoho.com';
  
  if (!clientId) {
    console.error('❌ Error: ZOHO_CRM_CLIENT_ID is required in .env file');
    process.exit(1);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `${accountsUrl}/oauth/v2/auth?${params.toString()}`;
  
  console.log('🔗 Zoho CRM Authorization URL:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Click the URL above to authorize the application');
  console.log('2. Log in to your Zoho account and grant permissions');
  console.log('3. Copy the authorization code from the redirect URL');
  console.log('4. Use the authorization code with npm test');
  console.log('');
  console.log('⚠️  Note: Authorization codes expire in 3 minutes!');
}

generateAuthUrl();
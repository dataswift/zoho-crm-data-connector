const DataswiftWalletClient = require('../storage/dataswyft-wallet-client');

async function testMonzoWrite() {
  console.log('🔄 Testing Monzo endpoint write with complete auth flow...\n');
  
  // Initialize client in test mode to enable authentication flow
  const walletClient = new DataswiftWalletClient(true);
  
  try {
    console.log('='.repeat(60));
    console.log('🔐 STEP 1: Authentication Flow');
    console.log('='.repeat(60));
    
    // Test the complete authentication process
    console.log('🔄 Getting access token...');
    const accessToken = await walletClient.getValidAccessToken();
    console.log('✅ Access token obtained successfully');
    console.log(`📋 Access token (first 50 chars): ${accessToken.substring(0, 50)}...`);
    
    console.log('\n🔄 Getting application token...');
    const appToken = await walletClient.getValidApplicationToken();
    console.log('✅ Application token obtained successfully');
    console.log(`📋 App token (first 50 chars): ${appToken.substring(0, 50)}...`);
    
    console.log('\n' + '='.repeat(60));
    console.log('📝 STEP 2: Sample Data Preparation');
    console.log('='.repeat(60));
    
    // Sample contact data for monzo endpoint
    const sampleData = {
      id: "test_monzo_" + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: {
        provider: "zoho_crm",
        version: "v8",
        endpoint: "/crm/v8/Contacts/search",
        module: "Contacts"
      },
      content: {
        email: "test.monzo@example.com",
        firstname: "Test",
        lastname: "Monzo",
        company: "Monzo Bank",
        phone: "+44-20-7946-0958",
        jobtitle: "Software Engineer",
        country: "United Kingdom",
        city: "London",
        registration_number: "MONZO-TEST-001",
        address: "38 Finsbury Square",
        address2: "Floor 2",
        zip: "EC2A 1PX",
        tax_file_number: "GB123456789",
        sales_service_tax_number: "VAT-GB123456789",
        kyb_verified: true,
        kyb_verified_at: new Date().toISOString(),
        zoho_object_id: "monzo_test_12345",
        properties: {
          account_type: "business",
          industry: "fintech",
          annual_revenue: 500000,
          customer_segment: "SME"
        }
      },
      metadata: {
        sync_timestamp: new Date().toISOString(),
        connector_version: "1.0.0",
        schema_version: "1.0",
        import_trigger: "test_monzo_endpoint"
      }
    };
    
    console.log('✅ Sample data prepared');
    console.log('📊 Data structure:');
    console.log(`   - ID: ${sampleData.id}`);
    console.log(`   - Email: ${sampleData.content.email}`);
    console.log(`   - Company: ${sampleData.content.company}`);
    console.log(`   - Country: ${sampleData.content.country}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 STEP 3: Writing to Monzo Endpoint');
    console.log('='.repeat(60));
    
    // Test writing to monzo/test endpoint
    console.log('🔄 Writing to monzo/test endpoint...');
    console.log(`📡 Target URL: ${walletClient.apiUrl}/api/v2.6/data/monzo/test`);
    
    const result = await walletClient.writeToNamespace('monzo', 'test', sampleData);
    
    console.log('✅ Write successful!');
    console.log(`📋 Record ID: ${result.recordId}`);
    console.log(`📊 Status: ${result.status}`);
    console.log('📄 Response:', JSON.stringify(result.response, null, 2));
    
    // Also test monzo/contacts endpoint
    console.log('\n🔄 Writing to monzo/contacts endpoint...');
    console.log(`📡 Target URL: ${walletClient.apiUrl}/api/v2.6/data/monzo/contacts`);
    
    const contactResult = await walletClient.writeToNamespace('monzo', 'contacts', sampleData);
    
    console.log('✅ Write to contacts successful!');
    console.log(`📋 Record ID: ${contactResult.recordId}`);
    console.log(`📊 Status: ${contactResult.status}`);
    
    console.log('\n🎉 All Monzo endpoint tests passed!');
    console.log('✅ Authentication flow working correctly');
    console.log('✅ Data writing to monzo namespace successful');
    
  } catch (error) {
    console.error('❌ Monzo write test failed:', error.message);
    
    if (error.response) {
      console.error('📋 Error status:', error.response.status);
      console.error('📋 Error data:', error.response.data);
      console.error('📋 Error headers:', error.response.headers);
    }
    
    console.error('📋 Full error:', error);
    
    // Show the exact request details that were attempted
    console.log('\n🔍 Request Details:');
    console.log(`📡 API URL: ${walletClient.apiUrl}`);
    console.log(`🔐 Auth method: ${walletClient.isTestMode ? 'Application Token (test mode)' : 'Production Token'}`);
  }
}

// Run the test
if (require.main === module) {
  testMonzoWrite();
}

module.exports = testMonzoWrite;
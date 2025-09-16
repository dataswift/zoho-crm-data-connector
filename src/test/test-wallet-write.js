const DataswyftWalletClient = require('../storage/dataswyft-wallet-client');
const DataMapper = require('../connectors/data-mapper');
const ChecksumGenerator = require('../utils/checksum-generator');

async function testWalletWrite() {
  console.log('🔄 Testing Dataswyft wallet write operations...\n');
  
  // Initialize client in test mode to enable authentication flow
  const walletClient = new DataswyftWalletClient(true);
  
  try {
    // Test 1: Test checksum generation
    console.log('🔄 Test 1: Testing checksum generation...');
    const testData = {
      email: 'test@example.com',
      name: 'Test User',
      company: 'Test Company'
    };
    
    const checksum = ChecksumGenerator.computeChecksum(testData);
    console.log('✅ Checksum generated successfully!');
    console.log(`📋 Checksum: ${checksum}`);
    
    // Test 2: Test DataMapper payload creation
    console.log('\n🔄 Test 2: Testing DataMapper payload creation...');
    const dataMapper = new DataMapper();
    const inboxMessageId = 'test-msg-' + Date.now();
    const payload = dataMapper.createWalletPayload(testData, inboxMessageId);
    
    console.log('✅ Payload created successfully!');
    console.log('📋 Payload structure:', JSON.stringify(payload, null, 2));
    
    // Test 3: Simple write to namespace with new payload structure
    console.log('\n🔄 Test 3: Writing payload to zoho/test namespace...');
    const testResult = await walletClient.writeToNamespace('zoho', 'test', payload);
    
    console.log('✅ Test write successful!');
    console.log(`📋 Record ID: ${testResult.recordId}`);
    
    // Test 4: Test writeZohoCRMContact with new payload structure
    console.log('\n🔄 Test 4: Testing writeZohoCRMContact with checksum...');
    
    const sampleZohoData = {
      namespace: "zoho",
      endpoint: "/crm/v8/Contacts/search",
      data: {
        id: "test123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: {
          provider: "zoho_crm",
          version: "v8",
          endpoint: "/crm/v8/Contacts/search",
          module: "Contacts"
        },
        content: {
          email: "test@example.com",
          firstname: "Test",
          lastname: "User",
          company: "Test Company",
          phone: "+1-555-0123",
          jobtitle: "Developer",
          country: "United States",
          city: "New York",
          registration_number: "TEST-123",
          address: "123 Test Street",
          address2: null,
          zip: "12345",
          tax_file_number: "TAX-123",
          sales_service_tax_number: "SST-123",
          kyb_verified: true,
          kyb_verified_at: new Date().toISOString(),
          zoho_object_id: "test123",
          properties: {}
        },
        metadata: {
          sync_timestamp: new Date().toISOString(),
          connector_version: "1.0.0",
          schema_version: "1.0",
          import_trigger: "test"
        }
      }
    };
    
    const zohoInboxMessageId = 'zoho-test-msg-' + Date.now();
    const zohoCRMResult = await walletClient.writeZohoCRMContact(sampleZohoData, zohoInboxMessageId);
    
    console.log('✅ Zoho CRM write with checksum successful!');
    console.log(`📋 Record ID: ${zohoCRMResult.recordId}`);
    
    console.log('\n🎉 All wallet write tests passed!');
    console.log('✅ Ready to proceed with full integration');
    
  } catch (error) {
    console.error('❌ Wallet write test failed:', error.message);
    
    if (error.response) {
      console.error('📋 Error response:', error.response.data);
    }
    
    // Let's try to understand what namespaces are available
    console.log('\n🔄 Testing different namespace patterns...');
    
    const testPatterns = [
      { namespace: 'zoho', endpoint: 'test' },
      { namespace: 'zoho', endpoint: 'contacts' },
      { namespace: 'test', endpoint: 'zoho' },
      { namespace: 'data', endpoint: 'zoho' }
    ];
    
    for (const pattern of testPatterns) {
      try {
        console.log(`🔄 Trying ${pattern.namespace}/${pattern.endpoint}...`);
        const result = await walletClient.writeToNamespace(pattern.namespace, pattern.endpoint, {
          test: 'namespace_discovery',
          timestamp: new Date().toISOString()
        });
        console.log(`✅ ${pattern.namespace}/${pattern.endpoint} works! Record ID: ${result.recordId}`);
        break;
      } catch (patternError) {
        console.log(`❌ ${pattern.namespace}/${pattern.endpoint} failed: ${patternError.message}`);
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testWalletWrite();
}

module.exports = testWalletWrite;
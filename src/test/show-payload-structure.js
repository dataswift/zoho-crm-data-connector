const DataMapper = require('../connectors/data-mapper');
const ChecksumGenerator = require('../utils/checksum-generator');

async function showPayloadStructure() {
  console.log('🔄 Demonstrating payload structure for data wallet...\n');
  
  const dataMapper = new DataMapper();
  
  // Sample Zoho CRM contact data (what comes from API)
  const zohoContact = {
    id: "4876876000000665049",
    Email: "john.doe@example.com",
    First_Name: "John",
    Last_Name: "Doe",
    Company: "Acme Corporation",
    Phone: "+1-555-0123",
    Title: "Senior Developer",
    Country: "United States",
    City: "San Francisco",
    Street: "123 Main Street",
    Zip_Code: "94105",
    Created_Time: "2024-01-15T10:30:00-08:00",
    Modified_Time: "2024-01-15T10:30:00-08:00",
    Registration_Number: "REG-123456",
    KYB_Verified: true,
    KYB_Verified_At: "2024-01-15T10:30:00-08:00"
  };
  
  // Step 1: Transform to DATASWYFT schema
  console.log('📋 Step 1: Raw Zoho CRM data from API');
  console.log(JSON.stringify(zohoContact, null, 2));
  
  // Step 2: Transform the data
  const transformedData = dataMapper.transformZohoContactToDATASWYFTSchema(zohoContact);
  console.log('\n📋 Step 2: Transformed data (what goes into checksum calculation)');
  console.log(JSON.stringify(transformedData, null, 2));
  
  // Step 3: Calculate checksum
  const checksum = ChecksumGenerator.computeChecksum(transformedData);
  console.log('\n📋 Step 3: Computed checksum');
  console.log('Checksum:', checksum);
  
  // Step 4: Create final payload
  const inboxMessageId = 'inbox-msg-4876876000000665049';
  const finalPayload = dataMapper.createWalletPayload(transformedData, inboxMessageId);
  
  console.log('\n📋 Step 4: Final payload sent to data wallet');
  console.log('='.repeat(80));
  console.log('POST /api/v2.6/data/zoho/contacts');
  console.log('Content-Type: application/json');
  console.log('x-auth-token: [application_token]');
  console.log('');
  console.log('BODY:');
  console.log(JSON.stringify(finalPayload, null, 2));
  console.log('='.repeat(80));
  
  // Step 5: Show payload size and structure
  console.log('\n📊 Payload Statistics:');
  console.log(`Total payload size: ${JSON.stringify(finalPayload).length} characters`);
  console.log(`Metadata size: ${JSON.stringify(finalPayload.metadata).length} characters`);
  console.log(`Data size: ${JSON.stringify(finalPayload.data).length} characters`);
  console.log(`Checksum: ${finalPayload.metadata.checksum}`);
  console.log(`Inbox Message ID: ${finalPayload.metadata.inbox_message_id}`);
  console.log(`Created At: ${finalPayload.metadata.created_at}`);
}

// Run the demonstration
if (require.main === module) {
  showPayloadStructure();
}

module.exports = showPayloadStructure;
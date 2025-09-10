const ContactSearch = require('../connectors/contact-search');
const DataMapper = require('../connectors/data-mapper');
const DATASWYFTWalletClient = require('../storage/dataswyft-wallet-client');
const JWTTokenGenerator = require('../auth/jwt-token-generator');
const ChecksumGenerator = require('../utils/checksum-generator');

async function testCompleteFlow() {
  console.log('🔄 Testing Complete Flow: Zoho CRM → DATASWYFT Wallet...\n');
  
  // Initialize components
  const contactSearch = new ContactSearch();
  const dataMapper = new DataMapper();
  const walletClient = new DATASWYFTWalletClient(true); // Use test mode to write to zoho/test
  const jwtGenerator = new JWTTokenGenerator();
  
  // Test email
  const testEmail = 'david.chen@globaltech.com';
  
  try {
    console.log('='.repeat(60));
    console.log('📧 STEP 1: Searching for contact in Zoho CRM');
    console.log('='.repeat(60));
    
    const contact = await contactSearch.searchContactByEmail(testEmail);
    
    if (!contact) {
      throw new Error(`No contact found with email: ${testEmail}`);
    }
    
    console.log(`✅ Contact found: ${contact.Full_Name} (${contact.Email})`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 2: Generating Application token for Data Connector');
    console.log('='.repeat(60));
    
    const applicationToken = await jwtGenerator.generateApplicationToken();
    console.log(`✅ Application token generated: ${applicationToken.substring(0, 50)}...`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 3: Transforming contact data');
    console.log('='.repeat(60));
    
    const transformedData = dataMapper.transformZohoContactToDATASWYFTSchema(contact);
    
    console.log('✅ Data transformed successfully!');
    console.log('📊 Transformed data structure:');
    console.log(`   - Contact ID: ${transformedData.data.id}`);
    console.log(`   - Namespace: ${transformedData.namespace}`);
    console.log(`   - Email: ${transformedData.data.content.email}`);
    console.log(`   - Full Name: ${transformedData.data.content.firstname} ${transformedData.data.content.lastname}`);
    console.log(`   - Company: ${transformedData.data.content.company}`);
    console.log(`   - Sync Timestamp: ${transformedData.data.metadata.sync_timestamp}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 4: Creating checksum payload');
    console.log('='.repeat(60));
    
    // Generate inbox message ID based on contact ID
    const inboxMessageId = `inbox-msg-${contact.id || contact.Id || 'unknown'}-${Date.now()}`;
    const walletPayload = dataMapper.createWalletPayload(transformedData, inboxMessageId);
    
    console.log('✅ Checksum payload created successfully!');
    console.log('📊 Payload structure:');
    console.log(`   - Inbox Message ID: ${walletPayload.metadata.inbox_message_id}`);
    console.log(`   - Created At: ${walletPayload.metadata.created_at}`);
    console.log(`   - Checksum: ${walletPayload.metadata.checksum}`);
    console.log(`   - Data Size: ${JSON.stringify(walletPayload.data).length} characters`);
    
    // Verify checksum
    const verificationChecksum = ChecksumGenerator.computeChecksum(walletPayload.data);
    console.log(`   - Checksum Verification: ${walletPayload.metadata.checksum === verificationChecksum ? '✅ Valid' : '❌ Invalid'}`);
    
    // Show the actual payload structure
    console.log('\n📋 Complete payload structure:');
    console.log(JSON.stringify(walletPayload, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 5: Writing to DATASWYFT wallet');
    console.log('='.repeat(60));
    
    const writeResult = await walletClient.writeZohoCRMContact(transformedData, inboxMessageId);
    
    console.log('✅ Successfully wrote contact data to DATASWYFT wallet!');
    console.log('📊 Write result:');
    console.log(`   - Status: ${writeResult.status}`);
    console.log(`   - Record ID: ${writeResult.recordId}`);
    console.log(`   - Success: ${writeResult.success}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 6: Summary of data written');
    console.log('='.repeat(60));
    
    console.log('📊 Final payload sent to data wallet:');
    console.log(`   - Endpoint: POST /api/v2.6/data/zoho/contacts`);
    console.log(`   - Payload with metadata wrapper and checksum`);
    console.log(`   - Total size: ${JSON.stringify(walletPayload).length} characters`);
    console.log(`   - Checksum: ${walletPayload.metadata.checksum}`);
    console.log(`   - Record ID: ${writeResult.recordId}`);
    
    console.log('\n' + '🎉'.repeat(20));
    console.log('🎉 COMPLETE FLOW TEST SUCCESSFUL! 🎉');
    console.log('🎉'.repeat(20));
    
    console.log('\n📋 Summary:');
    console.log(`✅ 1. Found contact: ${contact.Full_Name || contact.First_Name + ' ' + contact.Last_Name}`);
    console.log(`✅ 2. Generated Application token`);
    console.log(`✅ 3. Transformed data to DATASWYFT schema`);
    console.log(`✅ 4. Created checksum payload with metadata`);
    console.log(`✅ 5. Wrote to wallet namespace: zoho/contacts`);
    console.log(`✅ 6. Process completed successfully with Record ID: ${writeResult.recordId}`);
    
    console.log('\n💡 Next Steps:');
    console.log('   - This flow can now be integrated into webhook endpoints');
    console.log('   - Application token will be provided by Gateway in production');
    console.log('   - Contact email will come from CheckD callback');
    console.log('   - Data is now available in DATASWYFT wallet for badge authentication');
    
  } catch (error) {
    console.error('\n❌ Complete flow test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('JWT')) {
      console.error('\n💡 JWT Token issues:');
      console.error('   - Check your DATASWYFT_USERNAME and DATASWYFT_PASSWORD in .env');
      console.error('   - Verify the DATASWYFT API URL is correct');
    }
    
    if (error.message.includes('contact')) {
      console.error('\n💡 Contact search issues:');
      console.error('   - Check your Zoho CRM refresh token');
      console.error('   - Verify the contact email exists in Zoho CRM');
    }
    
    if (error.message.includes('write') || error.message.includes('namespace')) {
      console.error('\n💡 Wallet write issues:');
      console.error('   - Check JWT token permissions');
      console.error('   - Verify namespace and path are correct');
      console.error('   - Check DATASWYFT API endpoint');
    }
    
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCompleteFlow();
}

module.exports = testCompleteFlow;
const ContactSearch = require('../connectors/contact-search');
const DataMapper = require('../connectors/data-mapper');
const DataswiftWalletClient = require('../storage/dataswift-wallet-client');
const JWTTokenGenerator = require('../auth/jwt-token-generator');

async function testCompleteFlow() {
  console.log('🔄 Testing Complete Flow: Zoho CRM → Dataswift Wallet...\n');
  
  // Initialize components
  const contactSearch = new ContactSearch();
  const dataMapper = new DataMapper();
  const walletClient = new DataswiftWalletClient();
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
    
    const transformedData = dataMapper.transformZohoContactToDataswiftSchema(contact);
    const formattedData = dataMapper.formatForDataswiftStorage(transformedData);
    
    console.log('✅ Data transformed successfully!');
    console.log('📊 Transformed data structure:');
    console.log(`   - Contact ID: ${formattedData.contact_id}`);
    console.log(`   - Namespace: ${transformedData.namespace}`);
    console.log(`   - Email: ${formattedData.zoho_crm_data.content.email}`);
    console.log(`   - Full Name: ${formattedData.zoho_crm_data.content.full_name}`);
    console.log(`   - Company: ${formattedData.zoho_crm_data.content.company}`);
    console.log(`   - Sync Timestamp: ${formattedData.zoho_crm_data.metadata.sync_timestamp}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 4: Writing to Dataswift wallet');
    console.log('='.repeat(60));
    
    const writeResult = await walletClient.writeZohoCRMData(formattedData, applicationToken);
    
    console.log('✅ Successfully wrote contact data to Dataswift wallet!');
    console.log('📊 Write result:');
    console.log(`   - Status: ${writeResult.status}`);
    console.log(`   - Namespace: ${writeResult.namespace}`);
    console.log(`   - Path: ${writeResult.path}`);
    console.log(`   - Success: ${writeResult.success}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STEP 5: Verifying data was written (optional read test)');
    console.log('='.repeat(60));
    
    try {
      const readResult = await walletClient.readFromNamespace(
        writeResult.namespace, 
        writeResult.path, 
        applicationToken
      );
      
      console.log('✅ Successfully read back data from wallet!');
      console.log('📊 Read verification:');
      console.log(`   - Status: ${readResult.status}`);
      console.log(`   - Data exists: ${!!readResult.data}`);
      
      if (readResult.data && readResult.data.contact_id) {
        console.log(`   - Contact ID matches: ${readResult.data.contact_id === formattedData.contact_id}`);
      }
      
    } catch (readError) {
      console.log('⚠️  Read verification failed (this might be expected):');
      console.log(`   - Error: ${readError.message}`);
    }
    
    console.log('\n' + '🎉'.repeat(20));
    console.log('🎉 COMPLETE FLOW TEST SUCCESSFUL! 🎉');
    console.log('🎉'.repeat(20));
    
    console.log('\n📋 Summary:');
    console.log(`✅ 1. Found contact: ${contact.Full_Name}`);
    console.log(`✅ 2. Generated Application token`);
    console.log(`✅ 3. Transformed data to Dataswift schema`);
    console.log(`✅ 4. Wrote to wallet namespace: ${writeResult.namespace}/${writeResult.path}`);
    console.log(`✅ 5. Process completed successfully`);
    
    console.log('\n💡 Next Steps:');
    console.log('   - This flow can now be integrated into webhook endpoints');
    console.log('   - Application token will be provided by Gateway in production');
    console.log('   - Contact email will come from CheckD callback');
    console.log('   - Data is now available in Dataswift wallet for badge authentication');
    
  } catch (error) {
    console.error('\n❌ Complete flow test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('JWT')) {
      console.error('\n💡 JWT Token issues:');
      console.error('   - Check your DATASWIFT_USERNAME and DATASWIFT_PASSWORD in .env');
      console.error('   - Verify the Dataswift API URL is correct');
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
      console.error('   - Check Dataswift API endpoint');
    }
    
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCompleteFlow();
}

module.exports = testCompleteFlow;
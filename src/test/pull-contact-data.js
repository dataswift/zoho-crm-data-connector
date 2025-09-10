const ZohoOAuthClient = require('../auth/oauth-client');
const axios = require('axios');

async function pullContactData(email) {
  console.log(`🔄 Pulling contact data for email: ${email}\n`);
  
  const oauthClient = new ZohoOAuthClient();
  
  try {
    // Get refresh token from environment
    const refreshToken = process.env.ZOHO_CRM_REFRESH_TOKEN;
    
    if (!refreshToken) {
      throw new Error('ZOHO_CRM_REFRESH_TOKEN is required in .env file');
    }
    
    // Step 1: Get access token using refresh token
    console.log('🔄 Step 1: Getting access token...');
    const tokenData = await oauthClient.refreshAccessToken(refreshToken);
    
    console.log('✅ Access token obtained successfully!\n');
    
    // Step 2: Search for contact by email with limited fields
    console.log('🔄 Step 2: Searching for contact by email with limited fields...');
    
    // Map requested fields to actual Zoho CRM field names
    const requestedFields = [
      'Email',
      'First_Name',
      'Last_Name', 
      'company',                    // Company -> company
      'Phone',
      'Title',
      'Mailing_Country',           // Country -> Mailing_Country
      'Mailing_City',              // City -> Mailing_City
      'Mailing_Street',            // Street -> Mailing_Street
      'address2',                  // Address_Line_2 -> address2
      'Mailing_Zip',               // Zip_Code -> Mailing_Zip
      'registration_number',       // Registration_Number -> registration_number
      'tax_file_number',           // Tax_File_Number -> tax_file_number
      'sales_service_tax_number',  // Sales_Service_Tax_Number -> sales_service_tax_number
      'kyb_verified',              // KYB_Verified -> kyb_verified
      'kyb_verified_at',           // KYB_Verified_At -> kyb_verified_at
      'id',
      'Created_Time',
      'Modified_Time'
    ];
    
    const fieldsParam = requestedFields.join(',');
    const searchUrl = `${tokenData.apiDomain}/crm/v8/Contacts/search?email=${encodeURIComponent(email)}&fields=${fieldsParam}`;
    
    console.log(`🔍 Using fields: ${fieldsParam}`);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `${tokenData.tokenType} ${tokenData.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Contact search completed!\n');
    
    // Step 3: Display raw response
    console.log('📋 Raw API Response:');
    console.log('═'.repeat(50));
    console.log(JSON.stringify(response.data, null, 2));
    
    // Step 4: Extract and display contact data
    const contacts = response.data.data || [];
    
    if (contacts.length === 0) {
      console.log('\n❌ No contacts found with this email address');
      return;
    }
    
    console.log('\n📊 Contact Data Summary:');
    console.log('═'.repeat(50));
    console.log(`Found ${contacts.length} contact(s):\n`);
    
    contacts.forEach((contact, index) => {
      console.log(`Contact ${index + 1}:`);
      console.log(`  ID: ${contact.id}`);
      console.log(`  Email: ${contact.Email}`);
      console.log(`  Name: ${contact.Full_Name || `${contact.First_Name || ''} ${contact.Last_Name || ''}`.trim()}`);
      console.log(`  Phone: ${contact.Phone || 'N/A'}`);
      console.log(`  Mobile: ${contact.Mobile || 'N/A'}`);
      console.log(`  Account: ${contact.Account_Name?.name || 'N/A'}`);
      console.log(`  Created: ${contact.Created_Time}`);
      console.log(`  Modified: ${contact.Modified_Time}`);
      console.log('');
    });
    
    // Step 5: Show all available fields
    const firstContact = contacts[0];
    const availableFields = Object.keys(firstContact);
    
    console.log('📋 Available Fields in Contact Record:');
    console.log('═'.repeat(50));
    availableFields.forEach(field => {
      const value = firstContact[field];
      const displayValue = typeof value === 'object' && value !== null ? 
        JSON.stringify(value) : 
        String(value);
      
      console.log(`${field}: ${displayValue}`);
    });
    
    // Step 6: Transform data for Dataswyft wallet format
    console.log('\n🔄 Step 6: Transforming data for Dataswyft wallet...');
    
    const transformedData = contacts.map(contact => transformToDATASWYFTFormat(contact));
    
    console.log('\n📦 Transformed Data for Dataswyft Wallet:');
    console.log('═'.repeat(50));
    console.log(JSON.stringify(transformedData[0], null, 2));
    
    console.log('\n🎉 Contact data pull and transformation completed successfully!');
    
  } catch (error) {
    console.error('❌ Contact data pull failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    process.exit(1);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  const email = process.argv[2] || 'michael.chen@globalfinance.com';
  pullContactData(email);
}

/**
 * Transform Zoho CRM contact data to Dataswyft wallet format
 * @param {Object} contact - Raw Zoho CRM contact object
 * @returns {Object} Transformed data for Dataswyft wallet
 */
function transformToDATASWYFTFormat(contact) {
  // Extract any additional properties not in the main content structure
  const mainFields = [
    'Email', 'First_Name', 'Last_Name', 'company', 'Phone', 'Title',
    'Mailing_Country', 'Mailing_City', 'Mailing_Street', 'address2', 'Mailing_Zip',
    'registration_number', 'tax_file_number', 'sales_service_tax_number',
    'kyb_verified', 'kyb_verified_at', 'id', 'Created_Time', 'Modified_Time'
  ];
  
  const properties = {};
  Object.keys(contact).forEach(key => {
    if (!mainFields.includes(key)) {
      properties[key] = contact[key];
    }
  });
  
  return {
    namespace: "zoho",
    endpoint: "/crm/v8/Contacts/search",
    data: {
      id: contact.id,
      created_at: contact.Created_Time,
      updated_at: contact.Modified_Time,
      source: {
        provider: "zoho_crm",
        version: "v8",
        endpoint: "/crm/v8/Contacts/search",
        module: "Contacts"
      },
      content: {
        email: contact.Email,
        firstname: contact.First_Name,
        lastname: contact.Last_Name,
        company: contact.company,
        phone: contact.Phone,
        jobtitle: contact.Title,
        country: contact.Mailing_Country,
        city: contact.Mailing_City,
        registration_number: contact.registration_number,
        address: contact.Mailing_Street,
        address2: contact.address2,
        zip: contact.Mailing_Zip,
        tax_file_number: contact.tax_file_number,
        sales_service_tax_number: contact.sales_service_tax_number,
        kyb_verified: contact.kyb_verified,
        kyb_verified_at: contact.kyb_verified_at,
        zoho_object_id: contact.id,
        properties: properties
      },
      metadata: {
        sync_timestamp: new Date().toISOString(),
        connector_version: "1.0.0",
        schema_version: "1.0",
        import_trigger: "badge_authentication"
      }
    }
  };
}

module.exports = { pullContactData, transformToDATASWYFTFormat };
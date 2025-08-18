const ZohoOAuthClient = require('../auth/oauth-client');
const axios = require('axios');

/**
 * Zoho CRM Connector for pulling contact data with limited fields
 * Optimized for production use with Dataswyft wallet integration
 */
class ZohoCRMConnector {
  constructor() {
    this.oauthClient = new ZohoOAuthClient();
    
    // Define the specific fields we want to retrieve from Zoho CRM
    this.requiredFields = [
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
  }

  /**
   * Get access token using refresh token
   * @returns {Promise<Object>} Token data with access token and API domain
   */
  async getAccessToken() {
    const refreshToken = process.env.ZOHO_CRM_REFRESH_TOKEN;
    
    if (!refreshToken) {
      throw new Error('ZOHO_CRM_REFRESH_TOKEN is required in environment variables');
    }
    
    return await this.oauthClient.refreshAccessToken(refreshToken);
  }

  /**
   * Search for contact by email with limited fields
   * @param {string} email - Email address to search for
   * @returns {Promise<Array>} Array of contact objects
   */
  async searchContactByEmail(email) {
    const tokenData = await this.getAccessToken();
    
    // Build the search URL with limited fields
    const fieldsParam = this.requiredFields.join(',');
    const searchUrl = `${tokenData.apiDomain}/crm/v8/Contacts/search?email=${encodeURIComponent(email)}&fields=${fieldsParam}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `${tokenData.tokenType} ${tokenData.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.data || [];
  }

  /**
   * Transform Zoho CRM contact data to Dataswyft wallet format
   * @param {Object} contact - Raw Zoho CRM contact object
   * @returns {Object} Transformed data for Dataswyft wallet
   */
  transformToDataswiftFormat(contact) {
    // Extract any additional properties not in the main content structure
    const properties = {};
    Object.keys(contact).forEach(key => {
      if (!this.requiredFields.includes(key)) {
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

  /**
   * Get contact by email and transform to Dataswyft format
   * @param {string} email - Email address to search for
   * @returns {Promise<Object|null>} Transformed contact data or null if not found
   */
  async getContactForDataswyft(email) {
    try {
      const contacts = await this.searchContactByEmail(email);
      
      if (contacts.length === 0) {
        return null;
      }
      
      // Return the first matching contact transformed to Dataswyft format
      return this.transformToDataswiftFormat(contacts[0]);
      
    } catch (error) {
      // Re-throw with more context
      throw new Error(`Failed to get contact for email ${email}: ${error.message}`);
    }
  }

  /**
   * Get multiple contacts by email and transform to Dataswyft format
   * @param {string} email - Email address to search for
   * @returns {Promise<Array>} Array of transformed contact data
   */
  async getAllContactsForDataswyft(email) {
    try {
      const contacts = await this.searchContactByEmail(email);
      
      return contacts.map(contact => this.transformToDataswiftFormat(contact));
      
    } catch (error) {
      // Re-throw with more context
      throw new Error(`Failed to get contacts for email ${email}: ${error.message}`);
    }
  }
}

module.exports = ZohoCRMConnector;
const ChecksumGenerator = require('../utils/checksum-generator');

class DataMapper {
  constructor() {
    this.connectorVersion = '1.0.0';
    this.schemaVersion = '1.0';
  }

  transformZohoContactToDataswiftSchema(zohoContact) {
    const timestamp = new Date().toISOString();
    
    return {
      namespace: "zoho",
      endpoint: "/crm/v8/Contacts/search",
      data: {
        id: zohoContact.id,
        created_at: this.convertToISO8601(zohoContact.Created_Time),
        updated_at: this.convertToISO8601(zohoContact.Modified_Time),
        source: {
          provider: "zoho_crm",
          version: "v8",
          endpoint: "/crm/v8/Contacts/search",
          module: "Contacts"
        },
        content: {
          // Required fields
          email: zohoContact.Email,
          zoho_contact_id: zohoContact.id,
          
          // Core mapped fields from requirements
          firstname: zohoContact.First_Name,
          lastname: zohoContact.Last_Name,
          company: zohoContact.Company,
          phone: zohoContact.Phone,
          jobtitle: zohoContact.Title,
          country: zohoContact.Country,
          city: zohoContact.City,
          address: zohoContact.Street,
          address2: zohoContact.Address_Line_2,
          zip: zohoContact.Zip_Code,
          
          // Business/Tax information
          registration_number: zohoContact.Registration_Number,
          tax_file_number: zohoContact.Tax_File_Number,
          sales_service_tax_number: zohoContact.Sales_Service_Tax_Number,
          
          // KYB verification
          kyb_verified: zohoContact.KYB_Verified,
          kyb_verified_at: this.convertToISO8601(zohoContact.KYB_Verified_At),
          
          // Additional properties extracted beyond core mapped fields
          properties: this.extractCustomProperties(zohoContact)
        },
        metadata: {
          sync_timestamp: timestamp,
          connector_version: this.connectorVersion,
          schema_version: this.schemaVersion,
          import_trigger: "badge_authentication"
        }
      }
    };
  }

  convertToISO8601(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return date.toISOString();
    } catch (error) {
      console.warn(`Failed to convert date: ${dateString}`, error);
      return dateString; // Return original if conversion fails
    }
  }

  extractCustomProperties(zohoContact) {
    // Extract additional properties beyond the core mapped fields
    const customProperties = {};
    
    // Parse the properties field if it exists
    if (zohoContact.properties) {
      try {
        const parsedProperties = typeof zohoContact.properties === 'string' 
          ? JSON.parse(zohoContact.properties)
          : zohoContact.properties;
        Object.assign(customProperties, parsedProperties);
      } catch (error) {
        console.warn('Failed to parse properties:', zohoContact.properties, error);
        customProperties.raw_properties = zohoContact.properties;
      }
    }
    
    // Add additional fields that aren't in the core mapping
    const additionalFields = {
      // Contact details
      full_name: zohoContact.Full_Name,
      salutation: zohoContact.Salutation,
      mobile: zohoContact.Mobile,
      home_phone: zohoContact.Home_Phone,
      other_phone: zohoContact.Other_Phone,
      assistant_phone: zohoContact.Asst_Phone,
      fax: zohoContact.Fax,
      secondary_email: zohoContact.Secondary_Email,
      
      // Address information
      mailing_street: zohoContact.Mailing_Street,
      mailing_city: zohoContact.Mailing_City,
      mailing_state: zohoContact.Mailing_State,
      mailing_zip: zohoContact.Mailing_Zip,
      mailing_country: zohoContact.Mailing_Country,
      
      other_street: zohoContact.Other_Street,
      other_city: zohoContact.Other_City,
      other_state: zohoContact.Other_State,
      other_zip: zohoContact.Other_Zip,
      other_country: zohoContact.Other_Country,
      
      // Business information
      department: zohoContact.Department,
      lead_source: zohoContact.Lead_Source,
      email_opt_out: zohoContact.Email_Opt_Out,
      unsubscribed_mode: zohoContact.Unsubscribed_Mode,
      unsubscribed_time: zohoContact.Unsubscribed_Time,
      
      // Additional contact info
      twitter: zohoContact.Twitter,
      skype_id: zohoContact.Skype_ID,
      date_of_birth: zohoContact.Date_of_Birth,
      description: zohoContact.Description,
      assistant: zohoContact.Assistant,
      reporting_to: zohoContact.Reporting_To,
      vendor_name: zohoContact.Vendor_Name,
      
      // Owner and creation info
      owner: zohoContact.Owner,
      created_by: zohoContact.Created_By,
      modified_by: zohoContact.Modified_By,
      
      // Zoho-specific fields
      zoho_object_id: zohoContact.zoho_object_id,
      last_activity_time: zohoContact.Last_Activity_Time,
      
      // System fields
      currency_symbol: zohoContact.$currency_symbol,
      approval_state: zohoContact.$approval_state,
      sharing_permission: zohoContact.$sharing_permission,
      locked_for_me: zohoContact.$locked_for_me,
      editable: zohoContact.$editable,
      
      // Tags and categorization
      tags: zohoContact.Tag || [],
      
      // Layout information
      layout_id: zohoContact.$layout_id
    };
    
    // Only include fields that have values
    Object.keys(additionalFields).forEach(key => {
      if (additionalFields[key] !== null && additionalFields[key] !== undefined) {
        customProperties[key] = additionalFields[key];
      }
    });
    
    return customProperties;
  }

  formatForDataswiftStorage(transformedData) {
    // Format the data for Dataswift storage
    return {
      contact_id: transformedData.data.id,
      zoho_data: transformedData.data,
      metadata: transformedData.metadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create wallet payload with checksum metadata
   * @param {Object} transformedData - Data from external API after transformation
   * @param {string} inboxMessageId - Unique identifier for the inbox message
   * @returns {Object} - Complete payload ready for wallet storage
   */
  createWalletPayload(transformedData, inboxMessageId) {
    const checksum = ChecksumGenerator.computeChecksum(transformedData);
    
    return {
      metadata: {
        inbox_message_id: inboxMessageId,
        created_at: new Date().toISOString(),
        checksum: checksum
      },
      data: transformedData
    };
  }
}

module.exports = DataMapper;
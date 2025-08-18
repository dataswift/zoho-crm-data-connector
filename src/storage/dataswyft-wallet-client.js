const axios = require('axios');
const DataMapper = require('../connectors/data-mapper');
require('dotenv').config();

/**
 * Dataswyft Wallet API Client
 * Handles authentication and data storage to Dataswyft wallet namespaces
 */
class DataswiftWalletClient {
  constructor(isTestMode = false) {
    this.apiUrl = process.env.DATASWIFT_API_URL;
    this.username = process.env.DATASWIFT_USERNAME;
    this.password = process.env.DATASWIFT_PASSWORD;
    this.isTestMode = isTestMode;
    
    if (!this.apiUrl) {
      throw new Error('DATASWIFT_API_URL is required in environment variables');
    }
    
    // Only require username/password for test mode
    if (this.isTestMode && (!this.username || !this.password)) {
      throw new Error('DATASWIFT_USERNAME and DATASWIFT_PASSWORD are required for test mode');
    }
    
    this.accessToken = null;
    this.tokenExpiry = null;
    this.applicationToken = null;
    this.appTokenExpiry = null;
  }

  /**
   * Get access token from Dataswyft API (test mode only)
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    if (!this.isTestMode) {
      throw new Error('Access token authentication is only available in test mode');
    }
    
    try {
      console.log('🔄 Getting Dataswyft access token...');
      
      const response = await axios.get(`${this.apiUrl}/users/access_token`, {
        headers: {
          'Accept': 'application/json',
          'username': this.username,
          'password': this.password
        },
        timeout: 30000
      });

      console.log('✅ Access token obtained successfully!');
      
      // Store token and set expiry (assuming 1 hour expiry)
      this.accessToken = response.data.accessToken || response.data;
      this.tokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now
      
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Failed to get access token:', error.response?.data || error.message);
      throw new Error(`Failed to get Dataswyft access token: ${error.message}`);
    }
  }

  /**
   * Get application token from Dataswyft API (test mode only)
   * @returns {Promise<string>} Application token
   */
  async getApplicationToken() {
    if (!this.isTestMode) {
      throw new Error('Application token authentication is only available in test mode');
    }
    
    try {
      console.log('🔄 Getting Dataswyft application token...');
      
      // First ensure we have a valid access token
      const accessToken = await this.getValidAccessToken();
      
      const applicationId = process.env.DS_APPLICATION_ID;
      if (!applicationId) {
        throw new Error('DS_APPLICATION_ID is required in environment variables');
      }
      
      // Setup step - call application setup endpoint before getting token
      console.log('🔄 Setting up application...');
      try {
        const setupResponse = await axios.get(`${this.apiUrl}/api/v2.6/applications/${applicationId}/setup`, {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': accessToken
          },
          timeout: 30000
        });
        console.log('✅ Application setup completed successfully!');
        console.log('📋 Setup response:', setupResponse.data);
      } catch (setupError) {
        console.log('⚠️ Application setup failed, continuing anyway:', setupError.response?.data || setupError.message);
      }
      
      const response = await axios.get(`${this.apiUrl}/api/v2.6/applications/${applicationId}/access-token`, {
        headers: {
          'Accept': 'application/json',
          'x-auth-token': accessToken
        },
        timeout: 30000
      });

      console.log('✅ Application token obtained successfully!');
      
      // Store token and set expiry (assuming 1 hour expiry)
      this.applicationToken = response.data.accessToken || response.data;
      this.appTokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now
      
      return this.applicationToken;
      
    } catch (error) {
      console.error('❌ Failed to get application token:', error.response?.data || error.message);
      throw new Error(`Failed to get Dataswyft application token: ${error.message}`);
    }
  }

  /**
   * Get valid access token, refreshing if necessary (test mode only)
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken() {
    if (!this.isTestMode) {
      throw new Error('Access token authentication is only available in test mode');
    }
    
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    // Get new token
    return await this.getAccessToken();
  }

  /**
   * Get valid application token, refreshing if necessary (test mode only)
   * @returns {Promise<string>} Valid application token
   */
  async getValidApplicationToken() {
    if (!this.isTestMode) {
      throw new Error('Application token authentication is only available in test mode');
    }
    
    // Check if we have a valid token
    if (this.applicationToken && this.appTokenExpiry && Date.now() < this.appTokenExpiry) {
      return this.applicationToken;
    }
    
    // Get new token
    return await this.getApplicationToken();
  }

  /**
   * Get authentication token for API calls
   * In test mode: returns application token
   * In production mode: returns pre-configured production token
   * @returns {Promise<string>} Authentication token
   */
  async getAuthToken() {
    if (this.isTestMode) {
      return await this.getValidApplicationToken();
    } else {
      // In production, the application token is provided externally
      const productionToken = process.env.DATASWIFT_PRODUCTION_TOKEN;
      if (!productionToken) {
        throw new Error('DATASWIFT_PRODUCTION_TOKEN is required in production mode');
      }
      return productionToken;
    }
  }

  /**
   * Write data to a specific namespace in Dataswyft wallet
   * @param {string} namespace - The namespace to write to (e.g., 'zoho')
   * @param {string} endpoint - The endpoint path (e.g., 'contacts')
   * @param {Object} data - The data to write
   * @returns {Promise<Object>} Response from Dataswyft API including recordId
   */
  async writeToNamespace(namespace, endpoint, data) {
    try {
      console.log(`🔄 Writing data to namespace: ${namespace}/${endpoint}`);
      
      const authToken = await this.getAuthToken();
      
      const response = await axios.post(
        `${this.apiUrl}/api/v2.6/data/${namespace}/${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken
          },
          timeout: 30000
        }
      );

      console.log('✅ Data written successfully to Dataswyft wallet!');
      console.log(`📋 Response status: ${response.status}`);
      
      return {
        success: true,
        recordId: response.data.recordId || response.data.id,
        response: response.data,
        status: response.status
      };
      
    } catch (error) {
      console.error('❌ Failed to write to namespace:', error.response?.data || error.message);
      throw new Error(`Failed to write to Dataswyft namespace ${namespace}/${endpoint}: ${error.message}`);
    }
  }

  /**
   * Write Zoho CRM contact data to appropriate namespace
   * @param {Object} transformedData - Transformed contact data from ZohoCRMConnector
   * @param {string} inboxMessageId - Unique identifier for the inbox message
   * @returns {Promise<Object>} Response including recordId
   */
  async writeZohoCRMContact(transformedData, inboxMessageId) {
    const dataMapper = new DataMapper();
    const payload = dataMapper.createWalletPayload(transformedData, inboxMessageId);
    
    const namespace = 'zoho';
    const endpoint = 'contacts';
    return await this.writeToNamespace(namespace, endpoint, payload);
  }

  /**
   * Test the connection to Dataswyft wallet
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      console.log('🔄 Testing Dataswyft wallet connection...');
      
      if (this.isTestMode) {
        // Test authentication flow: access token -> application token -> data write
        console.log('Step 1: Getting access token...');
        const accessToken = await this.getValidAccessToken();
        console.log('✅ Access token obtained');
        
        console.log('Step 2: Getting application token...');
        const applicationToken = await this.getValidApplicationToken();
        console.log('✅ Application token obtained');
        
        console.log('Step 3: Testing data write with application token...');
      } else {
        console.log('Production mode: Using pre-configured token for data write...');
      }
      
      // Test with a simple data write
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Connection test from Zoho CRM connector',
        mode: this.isTestMode ? 'test' : 'production'
      };
      
      const result = await this.writeToNamespace('test', 'connection', testData);
      
      console.log('✅ Dataswyft wallet connection test successful!');
      console.log(`📋 Test record ID: ${result.recordId}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Dataswyft wallet connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = DataswiftWalletClient;
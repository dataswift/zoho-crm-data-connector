const axios = require('axios');
require('dotenv').config();

class ZohoOAuthClient {
  constructor() {
    this.clientId = process.env.ZOHO_CRM_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CRM_CLIENT_SECRET;
    this.accountsUrl = process.env.ZOHO_CRM_ACCOUNTS_URL || 'https://accounts.zoho.eu';
    this.tokenUrl = `${this.accountsUrl}/oauth/v2/token`;
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('ZOHO_CRM_CLIENT_ID and ZOHO_CRM_CLIENT_SECRET are required');
    }
  }

  async getAccessTokenFromCode(authorizationCode) {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authorizationCode
      });

      console.log('Access Token Request URL:', this.tokenUrl);
      console.log('Access Token Request Params:', {
        grant_type: 'authorization_code',
        client_id: this.clientId ? `${this.clientId.substring(0, 8)}...` : 'undefined',
        client_secret: this.clientSecret ? `${this.clientSecret.substring(0, 8)}...` : 'undefined',
        code: authorizationCode ? `${authorizationCode.substring(0, 8)}...` : 'undefined'
      });

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      console.log('Access Token Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.access_token) {
        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          tokenType: response.data.token_type || 'Bearer',
          expiresIn: response.data.expires_in || 3600,
          apiDomain: response.data.api_domain || process.env.ZOHO_CRM_API_DOMAIN || 'https://www.zohoapis.eu',
          expiresAt: Date.now() + (response.data.expires_in * 1000)
        };
      } else {
        throw new Error(`No access token received from Zoho. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        throw new Error(`Access token exchange failed: ${errorData.error || error.response.status} - ${errorData.error_description || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Access token exchange failed: Network error or timeout');
      } else {
        throw new Error(`Access token exchange error: ${error.message}`);
      }
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      });

      console.log('Refresh Token Request URL:', this.tokenUrl);
      console.log('Refresh Token Request Params:', {
        grant_type: 'refresh_token',
        client_id: this.clientId ? `${this.clientId.substring(0, 8)}...` : 'undefined',
        client_secret: this.clientSecret ? `${this.clientSecret.substring(0, 8)}...` : 'undefined',
        refresh_token: refreshToken ? `${refreshToken.substring(0, 8)}...` : 'undefined'
      });

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      console.log('Refresh Token Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.access_token) {
        return {
          accessToken: response.data.access_token,
          tokenType: response.data.token_type || 'Bearer',
          expiresIn: response.data.expires_in || 3600,
          apiDomain: response.data.api_domain || process.env.ZOHO_CRM_API_DOMAIN || 'https://www.zohoapis.eu',
          expiresAt: Date.now() + (response.data.expires_in * 1000)
        };
      } else {
        throw new Error(`No access token received from refresh. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        throw new Error(`Token refresh failed: ${errorData.error || error.response.status} - ${errorData.error_description || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Token refresh failed: Network error or timeout');
      } else {
        throw new Error(`Token refresh error: ${error.message}`);
      }
    }
  }

  async validateToken(tokenData) {
    if (!tokenData || !tokenData.accessToken) {
      return false;
    }

    // Check if token is expired (with 5-minute buffer)
    const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() < (tokenData.expiresAt - buffer);
  }
}

module.exports = ZohoOAuthClient;
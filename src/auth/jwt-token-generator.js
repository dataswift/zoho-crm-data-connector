const axios = require('axios');
require('dotenv').config();

class JWTTokenGenerator {
  constructor() {
    this.apiUrl = process.env.DATASWIFT_API_URL;
    this.username = process.env.DATASWIFT_USERNAME;
    this.password = process.env.DATASWIFT_PASSWORD;
    this.applicationId = process.env.DS_APPLICATION_ID;
    
    if (!this.apiUrl) {
      throw new Error('DATASWIFT_API_URL is required');
    }
    
    if (!this.username || !this.password) {
      throw new Error('DATASWIFT_USERNAME and DATASWIFT_PASSWORD are required');
    }
    
    if (!this.applicationId) {
      throw new Error('DS_APPLICATION_ID is required');
    }
  }

  async generateJWTToken() {
    try {
      console.log('🔐 Generating JWT token for Dataswift authentication...');
      console.log(`📡 API URL: ${this.apiUrl}/users/access_token`);
      console.log(`👤 Username: ${this.username}`);
      
      const response = await axios.get(`${this.apiUrl}/users/access_token`, {
        headers: {
          'Accept': 'application/json',
          'username': this.username,
          'password': this.password
        },
        timeout: 30000
      });

      console.log('📊 JWT Token Response Status:', response.status);
      console.log('📋 JWT Token Response:', response.data);

      if (response.data) {
        // Check if response contains a token property or if the entire response is the token
        const token = response.data.token || response.data.access_token || response.data.accessToken || response.data;
        
        if (typeof token === 'string') {
          console.log('✅ JWT token generated successfully!');
          return token;
        } else {
          console.log('📦 Full response structure:', JSON.stringify(response.data, null, 2));
          throw new Error('JWT token not found in response');
        }
      } else {
        throw new Error('No response data received');
      }
      
    } catch (error) {
      if (error.response) {
        console.error('🚨 JWT Token Generation Error:', error.response.status, error.response.data);
        throw new Error(`JWT token generation failed: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('JWT token generation failed: Network error or timeout');
      } else {
        throw new Error(`JWT token generation error: ${error.message}`);
      }
    }
  }

  async generateApplicationToken() {
    try {
      console.log('🔐 Generating application token for data connector...');
      
      // First, get the access token
      const accessToken = await this.generateJWTToken();
      
      console.log(`📡 Application API URL: ${this.apiUrl}/api/v2.6/applications/${this.applicationId}/access-token`);
      console.log(`🎯 Application ID: ${this.applicationId}`);
      
      const response = await axios.get(`${this.apiUrl}/api/v2.6/applications/${this.applicationId}/access-token`, {
        headers: {
          'x-auth-token': accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('📊 Application Token Response Status:', response.status);
      console.log('📋 Application Token Response:', response.data);

      if (response.data) {
        // The response should be the application token
        const applicationToken = response.data.accessToken || response.data.token || response.data.access_token || response.data;
        
        if (typeof applicationToken === 'string') {
          console.log('✅ Application token generated successfully!');
          return applicationToken;
        } else {
          console.log('📦 Full response structure:', JSON.stringify(response.data, null, 2));
          throw new Error('Application token not found in response');
        }
      } else {
        throw new Error('No response data received');
      }
      
    } catch (error) {
      if (error.response) {
        console.error('🚨 Application Token Generation Error:', error.response.status, error.response.data);
        throw new Error(`Application token generation failed: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Application token generation failed: Network error or timeout');
      } else {
        throw new Error(`Application token generation error: ${error.message}`);
      }
    }
  }

  async validateJWTToken(token) {
    // Simple validation - check if token exists and is a string
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Basic JWT structure check (should have 3 parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  }
}

module.exports = JWTTokenGenerator;
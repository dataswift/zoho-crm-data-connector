const jwt = require('jsonwebtoken');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

/**
 * Test suite for the /connect endpoint
 * Creates JWT tokens, starts callback server, and validates the complete flow
 */
class ConnectEndpointTest {
  constructor() {
    this.callbackServer = null;
    this.callbackPort = 3001;
    this.connectorPort = process.env.CONNECTOR_PORT || 8080;
    this.connectorUrl = `http://localhost:${this.connectorPort}`;
    this.callbackUrl = `http://localhost:${this.callbackPort}/callback`;
    this.receivedCallbacks = [];
    
    // Test configuration
    this.testConfig = {
      pdaUrl: process.env.DATASWIFT_API_URL,
      applicationId: process.env.DS_APPLICATION_ID,
      testEmail: 'sarah.johnson@techcorp.com', // From test data
      secretKey: 'test-secret-key-for-jwt-signing' // For test JWT signing
    };
    
    if (!this.testConfig.pdaUrl) {
      throw new Error('DATASWIFT_API_URL is required for testing');
    }
    
    if (!this.testConfig.applicationId) {
      throw new Error('DS_APPLICATION_ID is required for testing');
    }
  }

  /**
   * Create a test JWT token that matches the ApplicationToken interface
   * @param {Object} options - Token options
   * @returns {string} Signed JWT token
   */
  createTestJWT(options = {}) {
    const payload = {
      iss: options.pda_url || this.testConfig.pdaUrl,           // PDA URL (issuer)
      sub: options.subject || 'test-user-123',                 // Subject
      application: options.application || this.testConfig.applicationId, // Application ID
      user_id: options.user_id || 'test-user-123',            // User ID
      iat: Math.floor(Date.now() / 1000),                     // Issued at
      exp: options.exp !== undefined ? options.exp : Math.floor(Date.now() / 1000) + (60 * 60), // Use custom exp or default
      ...options.additionalClaims
    };

    return jwt.sign(payload, this.testConfig.secretKey, { algorithm: 'HS256' });
  }

  /**
   * Start callback server to receive responses from the connector
   */
  async startCallbackServer() {
    return new Promise((resolve) => {
      const app = express();
      app.use(express.json());

      // Callback endpoint to receive connector responses
      app.post('/callback', (req, res) => {
        this.receivedCallbacks.push({
          timestamp: new Date().toISOString(),
          body: req.body,
          headers: req.headers
        });

        res.status(200).json({ 
          status: 'received',
          message: 'Callback processed successfully'
        });
      });

      // Health check for callback server
      app.get('/health', (req, res) => {
        res.json({ 
          status: 'healthy',
          callbacks_received: this.receivedCallbacks.length
        });
      });

      this.callbackServer = app.listen(this.callbackPort, () => {
        resolve();
      });
    });
  }

  /**
   * Stop callback server
   */
  async stopCallbackServer() {
    if (this.callbackServer) {
      return new Promise((resolve) => {
        this.callbackServer.close(() => {
          resolve();
        });
      });
    }
  }

  /**
   * Test the /connect endpoint with success scenario
   */
  async testSuccessScenario() {
    console.log('\n🧪 Testing SUCCESS scenario...');
    
    // Clear previous callbacks
    this.receivedCallbacks = [];
    
    // Create test JWT
    const testToken = this.createTestJWT();
    console.log('🔑 Created test JWT token');
    
    // Prepare test data
    const testData = {
      email: this.testConfig.testEmail
    };
    
    const requestId = `test_req_${Date.now()}`;
    
    // Build request URL
    const connectUrl = `${this.connectorUrl}/connect?` + new URLSearchParams({
      token: testToken,
      callback_url: this.callbackUrl,
      data: JSON.stringify(testData),
      request_id: requestId
    });
    
    console.log('🚀 Calling /connect endpoint...');
    
    try {
      // Call the connect endpoint
      const response = await axios.get(connectUrl, { timeout: 10000 });
      
      // Wait for async processing and callback
      await this.waitForCallback(requestId, 30000); // 30 second timeout
      
      // Validate callback
      const callback = this.receivedCallbacks.find(cb => cb.body.request_id === requestId);
      
      if (!callback) {
        throw new Error('No callback received for request');
      }
      
      // Validate success callback structure
      this.validateSuccessCallback(callback.body);
      
      console.log('✅ SUCCESS scenario test passed!');
      return {
        success: true,
        immediate_response: response.data,
        callback_response: callback.body
      };
      
    } catch (error) {
      console.error('❌ SUCCESS scenario test failed:', error.message);
      return {
        success: false,
        error: error.message,
        callbacks_received: this.receivedCallbacks
      };
    }
  }

  /**
   * Test the /connect endpoint with error scenario (invalid email)
   */
  async testErrorScenario() {
    console.log('\n🧪 Testing ERROR scenario (invalid email)...');
    
    // Clear previous callbacks
    this.receivedCallbacks = [];
    
    // Create test JWT
    const testToken = this.createTestJWT();
    console.log('🔑 Created test JWT token');
    
    // Prepare test data with invalid email
    const testData = {
      email: 'nonexistent@example.com'
    };
    
    const requestId = `test_error_${Date.now()}`;
    
    // Build request URL
    const connectUrl = `${this.connectorUrl}/connect?` + new URLSearchParams({
      token: testToken,
      callback_url: this.callbackUrl,
      data: JSON.stringify(testData),
      request_id: requestId
    });
    
    console.log('🚀 Calling /connect endpoint with invalid email...');
    
    try {
      // Call the connect endpoint
      const response = await axios.get(connectUrl, { timeout: 10000 });
      
      console.log('✅ Immediate response received:', response.status, response.data);
      
      // Wait for async processing and error callback
      console.log('⏳ Waiting for async processing and error callback...');
      await this.waitForCallback(requestId, 30000);
      
      // Validate error callback
      const callback = this.receivedCallbacks.find(cb => cb.body.request_id === requestId);
      
      if (!callback) {
        throw new Error('No callback received for error request');
      }
      
      // Validate error callback structure and error page URL
      this.validateErrorCallbackWithPage(callback.body);
      
      console.log('✅ ERROR scenario test passed!');
      return {
        success: true,
        immediate_response: response.data,
        callback_response: callback.body
      };
      
    } catch (error) {
      console.error('❌ ERROR scenario test failed:', error.message);
      return {
        success: false,
        error: error.message,
        callbacks_received: this.receivedCallbacks
      };
    }
  }

  /**
   * Test invalid JWT token scenario
   */
  async testInvalidTokenScenario() {
    console.log('\n🧪 Testing INVALID TOKEN scenario...');
    
    // Clear previous callbacks
    this.receivedCallbacks = [];
    
    // Create expired JWT token (expired 1 hour ago)
    const expiredToken = this.createTestJWT({
      exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
    });
    
    const testData = { email: this.testConfig.testEmail };
    const requestId = `test_invalid_${Date.now()}`;
    
    const connectUrl = `${this.connectorUrl}/connect?` + new URLSearchParams({
      token: expiredToken,
      callback_url: this.callbackUrl,
      data: JSON.stringify(testData),
      request_id: requestId
    });
    
    console.log('🚀 Calling /connect endpoint with expired token...');
    
    try {
      const response = await axios.get(connectUrl, { timeout: 10000 });
      
      // Wait for error callback
      await this.waitForCallback(requestId, 15000);
      
      const callback = this.receivedCallbacks.find(cb => cb.body.request_id === requestId);
      
      if (callback && callback.body.status === 'failure') {
        // Validate error callback structure and error page URL
        this.validateErrorCallbackWithPage(callback.body);
        console.log('✅ INVALID TOKEN scenario test passed!');
        return { success: true, callback_response: callback.body };
      } else {
        throw new Error('Expected error callback for invalid token');
      }
      
    } catch (error) {
      console.error('❌ INVALID TOKEN scenario test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for callback to be received
   */
  async waitForCallback(requestId, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const callback = this.receivedCallbacks.find(cb => cb.body.request_id === requestId);
      if (callback) {
        return callback;
      }
      
      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Callback timeout: No callback received for request ${requestId} within ${timeout}ms`);
  }

  /**
   * Validate success callback structure
   */
  validateSuccessCallback(callback) {
    const required = ['status', 'request_id', 'summary', 'record_ids', 'timestamp'];
    
    for (const field of required) {
      if (!(field in callback)) {
        throw new Error(`Missing required field in success callback: ${field}`);
      }
    }
    
    if (callback.status !== 'success') {
      throw new Error(`Expected success status, got: ${callback.status}`);
    }
    
    if (!callback.summary.data_extracted) {
      throw new Error('Expected data_extracted to be true');
    }
    
    if (!callback.summary.zoho_namespace_stored) {
      throw new Error('Expected zoho_namespace_stored to be true');
    }
    
    if (!callback.record_ids.zoho_record_id) {
      throw new Error('Missing zoho_record_id in callback');
    }
    
    console.log('✅ Success callback validation passed');
  }

  /**
   * Validate error callback structure
   */
  validateErrorCallback(callback) {
    const required = ['status', 'request_id', 'error'];
    
    for (const field of required) {
      if (!(field in callback)) {
        throw new Error(`Missing required field in error callback: ${field}`);
      }
    }
    
    if (callback.status !== 'failure') {
      throw new Error(`Expected failure status, got: ${callback.status}`);
    }
    
    if (!callback.error.code || !callback.error.message) {
      throw new Error('Error callback missing error code or message');
    }
    
    console.log('✅ Error callback validation passed');
  }

  /**
   * Test parameter validation error page redirect
   */
  async testParameterValidationError() {
    console.log('\n🧪 Testing PARAMETER VALIDATION error page redirect...');
    
    try {
      // Call endpoint with missing parameters
      const connectUrl = `${this.connectorUrl}/connect?token=invalid`;
      
      const response = await axios.get(connectUrl, { 
        timeout: 10000,
        maxRedirects: 0, // Don't follow redirects automatically
        validateStatus: function (status) {
          return true; // Accept all status codes
        }
      });
      
      // Check for redirect response (303)
      if (response.status === 303 && response.headers.location) {
        const redirectUrl = response.headers.location;
        
        // Verify it's redirecting to error page
        if (redirectUrl.includes('/error') && redirectUrl.includes('INVALID_DATA')) {
          console.log('✅ PARAMETER VALIDATION error page test passed!');
          return { success: true, redirect_url: redirectUrl };
        } else {
          throw new Error('Redirect URL does not contain expected error parameters');
        }
      } else {
        throw new Error(`Expected 303 redirect, got ${response.status}`);
      }
      
    } catch (error) {
      if (error.response && error.response.status === 303) {
        const redirectUrl = error.response.headers.location;
        if (redirectUrl && redirectUrl.includes('/error')) {
          console.log('✅ PARAMETER VALIDATION error page test passed!');
          return { success: true, redirect_url: redirectUrl };
        }
      }
      
      console.error('❌ PARAMETER VALIDATION error page test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test error page rendering
   */
  async testErrorPageRendering() {
    console.log('\n🧪 Testing ERROR PAGE rendering...');
    
    try {
      // Test different error types
      const errorTypes = [
        { type: 'EMAIL_NOT_FOUND', expected: 'Contact Not Found' },
        { type: 'INVALID_TOKEN', expected: 'Authentication Failed' },
        { type: 'API_ERROR', expected: 'Service Error' }
      ];
      
      const results = [];
      
      for (const errorType of errorTypes) {
        const errorUrl = `${this.connectorUrl}/error?${new URLSearchParams({
          type: errorType.type,
          message: `Test ${errorType.type} message`,
          request_id: 'test_error_page_123'
        })}`;
        
        const response = await axios.get(errorUrl, { 
          timeout: 10000,
          validateStatus: function (status) {
            return true; // Accept all status codes
          }
        });
        
        // Verify HTML response
        if (response.status >= 200 && response.status < 600) {
          const html = response.data;
          
          // Check if HTML contains expected elements
          const containsTitle = html.includes(errorType.expected);
          const containsRequestId = html.includes('test_error_page_123');
          const containsErrorIcon = html.includes('error-icon');
          const containsUserAction = html.includes('What to do next');
          
          if (containsTitle && containsRequestId && containsErrorIcon && containsUserAction) {
            results.push({ type: errorType.type, success: true });
          } else {
            results.push({ type: errorType.type, success: false, reason: 'Missing HTML elements' });
          }
        } else {
          results.push({ type: errorType.type, success: false, reason: `Status ${response.status}` });
        }
      }
      
      const allPassed = results.every(r => r.success);
      console.log(allPassed ? '✅ ERROR PAGE rendering test passed!' : '❌ Some error pages failed');
      
      return { success: allPassed, results };
      
    } catch (error) {
      console.error('❌ ERROR PAGE rendering test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update error callback validation to check for error page URLs
   */
  validateErrorCallbackWithPage(callback) {
    const required = ['status', 'request_id', 'error'];
    
    for (const field of required) {
      if (!(field in callback)) {
        throw new Error(`Missing required field in error callback: ${field}`);
      }
    }
    
    if (callback.status !== 'failure') {
      throw new Error(`Expected failure status, got: ${callback.status}`);
    }
    
    if (!callback.error.code || !callback.error.message) {
      throw new Error('Error callback missing error code or message');
    }
    
    // Check for error page URL (if present)
    if (callback.error.error_page_url) {
      if (!callback.error.error_page_url.includes('/error')) {
        throw new Error('Error page URL does not contain /error endpoint');
      }
    }
    
    if (callback.redirect_url) {
      if (!callback.redirect_url.includes('/error')) {
        throw new Error('Redirect URL does not contain /error endpoint');
      }
    }
    
    console.log('✅ Error callback with error page validation passed');
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Connect Endpoint Test Suite');
    console.log('=' .repeat(50));
    
    try {
      // Start callback server
      await this.startCallbackServer();
      
      // Wait a bit for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const results = {
        success_test: await this.testSuccessScenario(),
        error_test: await this.testErrorScenario(),
        invalid_token_test: await this.testInvalidTokenScenario(),
        parameter_validation_test: await this.testParameterValidationError(),
        error_page_rendering_test: await this.testErrorPageRendering()
      };
      
      // Summary
      console.log('\n📊 TEST SUMMARY');
      console.log('=' .repeat(50));
      
      const allPassed = Object.values(results).every(result => result.success);
      
      for (const [testName, result] of Object.entries(results)) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${testName}: ${status}`);
        if (!result.success) {
          console.log(`  Error: ${result.error}`);
        }
      }
      
      console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      console.log(`Total Callbacks Received: ${this.receivedCallbacks.length}`);
      
      return { success: allPassed, results, callbacks: this.receivedCallbacks };
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      return { success: false, error: error.message };
    } finally {
      // Cleanup
      await this.stopCallbackServer();
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new ConnectEndpointTest();
  
  test.runAllTests()
    .then((results) => {
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = ConnectEndpointTest;
const axios = require('axios');
const ZohoCRMConnector = require('../connectors/zoho-crm-connector');
const DataswyftWalletClient = require('../storage/dataswyft-wallet-client');
const { decodeApplicationToken, isTokenExpired } = require('../auth/token-utils');
require('dotenv').config();

/**
 * Connect Controller
 * Handles all business logic for the /connect endpoint
 */

// Initialize connectors
const zohoCRM = new ZohoCRMConnector();

/**
 * Handle GET /connect endpoint
 * GET /connect?token=eyJhbGc...&callback_url=https://checkd.io/api/callback&data={"email":"merchant@example.com"}&request_id=req_123456
 */
async function handleConnect(req, res) {
  const { token, callback_url, callback_label, data, request_id } = req.query;
  
  console.log('🚀 /connect endpoint called');

  // Validate required parameters
  if (!token || !callback_url || !data || !request_id) {
    console.error('❌ Missing required parameters');
    
    const errorUrl = `/error?${new URLSearchParams({
      type: 'MISSING_PARAMS',
      message: 'Missing required parameters: token, callback_url, data, request_id',
      request_id: request_id || 'unknown',
      callback_url: callback_url || '',
      callback_label: callback_label || 'Return to Application'
    })}`;
    return res.redirect(303, errorUrl);
  }

  // Send immediate acknowledgment
  res.status(200).json({
    status: 'accepted',
    message: 'Request received, processing started',
    request_id
  });

  // Process request asynchronously
  processConnectRequest(req, token, callback_url, callback_label, data, request_id);
}

/**
 * Asynchronous processing of the connect request
 */
async function processConnectRequest(req, token, callback_url, callback_label, data, request_id) {
  try {
    console.log('🔄 Starting async processing...');
    
    // Step 1: Decode and validate JWT token
    let tokenPayload;
    try {
      tokenPayload = decodeApplicationToken(token);
    } catch (decodeError) {
      throw new Error('TOKEN_INVALID: ' + decodeError.message);
    }
    
    // Step 2: Check token expiration
    if (isTokenExpired(token)) {
      throw new Error('TOKEN_EXPIRED: Token has expired');
    }
    
    // Step 3: Validate application ID (required for security)
    const expectedAppId = process.env.DS_APPLICATION_ID;
    if (!expectedAppId) {
      throw new Error('INTERNAL_ERROR: DS_APPLICATION_ID not configured in environment');
    }
    
    if (tokenPayload.application !== expectedAppId) {
      console.error(`Application ID mismatch: expected ${expectedAppId}, got ${tokenPayload.application}`);
      throw new Error(`APP_MISMATCH: Expected ${expectedAppId}, Received ${tokenPayload.application}`);
    }
    
    // Step 4: Parse data to extract merchant email
    let merchantData;
    try {
      merchantData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (parseError) {
      throw new Error('INVALID_DATA: Invalid JSON data format');
    }
    
    const merchantEmail = merchantData.email;
    if (!merchantEmail) {
      throw new Error('MISSING_EMAIL: Email not found in data object');
    }
    
    // Step 5: Authenticate with Zoho CRM and search for contact
    const contactData = await zohoCRM.getContactForDataswyft(merchantEmail);
    
    if (!contactData) {
      throw new Error('EMAIL_NOT_FOUND');
    }
    
    // Step 6: Store data in wallet using existing Dataswyft client
    const dataswyftClient = new DataswyftWalletClient();
    
    // Store in appropriate namespace (test for testing, zoho-crm for production)
    const isTestMode = process.env.NODE_ENV === 'test' || request_id.includes('test_');
    
    let zohoRecord;
    if (isTestMode) {
      zohoRecord = await dataswyftClient.writeToNamespace('zoho', 'test', contactData);
    } else {
      zohoRecord = await dataswyftClient.writeZohoCRMContact(contactData);
    }
    
    // Step 7: Report success to callback URL
    const successResponse = {
      status: 'success',
      request_id: request_id,
      summary: {
        data_extracted: true,
        zoho_namespace_stored: true,
        badge_authenticated: true
      },
      record_ids: {
        zoho_record_id: zohoRecord.recordId
      },
      timestamp: new Date().toISOString()
    };
    
    await sendCallback(callback_url, successResponse);
    
    // Generate success page URL with callback parameters
    const successPageUrl = `${req.protocol}://${req.get('host')}/success?${new URLSearchParams({
      request_id: request_id,
      callback_url: callback_url || '',
      callback_label: callback_label || 'Return to Application'
    })}`;
    
    console.log(`✅ Success page URL: ${successPageUrl}`);
    
  } catch (error) {
    console.error('❌ Processing error:', error.message);
    
    // Map error to appropriate error code
    let errorCode = 'API_ERROR';
    let errorDetails = '';
    
    // Extract error code from error message if present
    const errorMatch = error.message.match(/^([A-Z_]+):\s*(.+)$/);
    if (errorMatch) {
      errorCode = errorMatch[1];
      
      // Special handling for APP_MISMATCH to extract expected/received values
      if (errorCode === 'APP_MISMATCH') {
        const mismatchMatch = errorMatch[2].match(/Expected\s+(.+),\s+Received\s+(.+)/);
        if (mismatchMatch) {
          errorDetails = `Expected: ${mismatchMatch[1]} | Received: ${mismatchMatch[2]}`;
        }
      }
    }
    
    // Create error page URL with callback parameters
    const errorPageUrl = `${req.protocol}://${req.get('host')}/error?${new URLSearchParams({
      type: errorCode,
      message: error.message.replace(/^[A-Z_]+:\s*/, ''), // Remove error code prefix from message
      request_id: request_id,
      details: errorDetails || (error.stack ? error.stack.split('\n')[0] : ''),
      callback_url: callback_url || '',
      callback_label: callback_label || 'Return to Application'
    })}`;
    
    // Send callback with error page URL
    const errorResponse = {
      status: 'failure',
      request_id: request_id,
      error: {
        code: errorCode,
        message: error.message.replace(/^[A-Z_]+:\s*/, ''), // Clean message
        timestamp: new Date().toISOString(),
        error_page_url: errorPageUrl
      },
      redirect_url: errorPageUrl
    };
    
    await sendCallback(callback_url, errorResponse);
  }
}

/**
 * Send callback to the provided URL
 */
async function sendCallback(callbackUrl, data) {
  try {
    await axios.post(callbackUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error('❌ Failed to send callback:', error.message);
    // Don't throw - we don't want callback failures to crash the main process
  }
}

module.exports = {
  handleConnect
};
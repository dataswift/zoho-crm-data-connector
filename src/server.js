const express = require('express');
const jwt = require('jsonwebtoken');
const ZohoCRMConnector = require('./connectors/zoho-crm-connector');
const DataswiftWalletClient = require('./storage/dataswyft-wallet-client');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.CONNECTOR_PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize connectors
const zohoCRM = new ZohoCRMConnector();

/**
 * Decode application token without verification (assuming gateway already verified)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
function decodeApplicationToken(token) {
  try {
    // Decode without verification (gateway already verified)
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      throw new Error('Invalid token format');
    }
    
    // Validate required fields
    if (!decoded.iss) {
      throw new Error('Token missing issuer (iss) claim');
    }
    
    if (!decoded.application) {
      throw new Error('Token missing application claim');
    }
    
    return decoded;
  } catch (error) {
    console.error('Token decode error:', error);
    throw new Error(`Failed to decode token: ${error.message}`);
  }
}

/**
 * Extract PDA URL from JWT token's iss claim
 * Auto-prepends https:// if missing
 * @param {string} token - JWT token to extract PDA URL from
 * @returns {string} PDA URL with https:// protocol
 */
function extractPdaUrl(token) {
  try {
    const decoded = decodeApplicationToken(token);
    let pdaUrl = decoded.iss;
    
    // Auto-prepend https:// if missing
    if (!pdaUrl.startsWith('http://') && !pdaUrl.startsWith('https://')) {
      pdaUrl = 'https://' + pdaUrl;
    }
    
    return pdaUrl;
  } catch (error) {
    throw new Error(`Failed to extract PDA URL: ${error.message}`);
  }
}

/**
 * Check if token has expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.exp) {
      return false; // No expiration claim, consider valid
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime > decoded.exp;
  } catch (error) {
    return true; // Consider expired if we can't decode
  }
}

/**
 * Main endpoint called by the Data Connector Gateway
 * GET /connect?token=eyJhbGc...&callback_url=https://checkd.io/api/callback&data={"email":"merchant@example.com"}&request_id=req_123456
 */
app.get('/connect', async (req, res) => {
  const { token, callback_url, data, request_id } = req.query;
  
  console.log('🚀 /connect endpoint called');

  // Validate required parameters
  if (!token || !callback_url || !data || !request_id) {
    console.error('❌ Missing required parameters');
    
    const errorUrl = `/error?${new URLSearchParams({
      type: 'INVALID_DATA',
      message: 'Missing required parameters: token, callback_url, data, request_id',
      request_id: request_id || 'unknown'
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
  processConnectRequest(req, token, callback_url, data, request_id);
});

/**
 * Asynchronous processing of the connect request
 */
async function processConnectRequest(req, token, callback_url, data, request_id) {
  try {
    console.log('🔄 Starting async processing...');
    
    // Step 1: Decode and validate JWT token
    let tokenPayload;
    try {
      tokenPayload = decodeApplicationToken(token);
    } catch (decodeError) {
      throw new Error('INVALID_TOKEN: ' + decodeError.message);
    }
    
    // Step 2: Check token expiration
    if (isTokenExpired(token)) {
      throw new Error('INVALID_TOKEN: Token has expired');
    }
    
    // Step 3: Validate application ID (required for security)
    const expectedAppId = process.env.DS_APPLICATION_ID;
    if (!expectedAppId) {
      throw new Error('INVALID_TOKEN: DS_APPLICATION_ID not configured in environment');
    }
    
    if (tokenPayload.application !== expectedAppId) {
      console.error(`Application ID mismatch: expected ${expectedAppId}, got ${tokenPayload.application}`);
      throw new Error('INVALID_TOKEN: Application ID mismatch');
    }
    
    // Extract PDA URL from token's iss claim with auto-prepended https://
    const pdaUrl = extractPdaUrl(token);
    const applicationId = tokenPayload.application;
    
    // Step 3: Parse data to extract merchant email
    let merchantData;
    try {
      merchantData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (parseError) {
      throw new Error('Invalid JSON data format');
    }
    
    const merchantEmail = merchantData.email;
    if (!merchantEmail) {
      throw new Error('Email not found in data object');
    }
    
    // Step 4: Authenticate with Zoho CRM and search for contact
    const contactData = await zohoCRM.getContactForDataswyft(merchantEmail);
    
    if (!contactData) {
      throw new Error('EMAIL_NOT_FOUND');
    }
    
    // Step 5: Store data in wallet using existing Dataswyft client
    const dataswiftClient = new DataswiftWalletClient();
    
    // Store in appropriate namespace (test for testing, zoho-crm for production)
    const isTestMode = process.env.NODE_ENV === 'test' || request_id.includes('test_');
    
    let zohoRecord;
    if (isTestMode) {
      zohoRecord = await dataswiftClient.writeToNamespace('zoho', 'test', contactData);
    } else {
      zohoRecord = await dataswiftClient.writeZohoCRMContact(contactData);
    }
    
    // Step 6: Report success to callback URL
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
    
  } catch (error) {
    console.error('❌ Processing error:', error.message);
    
    // Map error to appropriate error code
    let errorCode = 'API_ERROR';
    let statusCode = 500;
    
    if (error.message === 'EMAIL_NOT_FOUND') {
      errorCode = 'EMAIL_NOT_FOUND';
      statusCode = 404;
    } else if (error.message.includes('JWT') || error.message.includes('token') || error.message.includes('INVALID_TOKEN') || error.message.includes('Application ID mismatch')) {
      errorCode = 'INVALID_TOKEN';
      statusCode = 401;
    } else if (error.message.includes('Email not found')) {
      errorCode = 'INVALID_DATA';
      statusCode = 400;
    }
    
    // Create error page URL
    const errorPageUrl = `${req.protocol}://${req.get('host')}/error?${new URLSearchParams({
      type: errorCode,
      message: error.message,
      request_id: request_id,
      details: error.stack ? error.stack.split('\n')[0] : ''
    })}`;
    
    // Send callback with error page URL
    const errorResponse = {
      status: 'failure',
      request_id: request_id,
      error: {
        code: errorCode,
        message: error.message,
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

/**
 * PDA Wallet Client using JWT token for authentication
 * Implements wallet service with PDA URL extraction according to authentication plan
 */
class PDAWalletClient {
  constructor(pdaUrl, jwtToken) {
    // Auto-prepend https:// to PDA URLs if missing
    if (!pdaUrl.startsWith('http://') && !pdaUrl.startsWith('https://')) {
      pdaUrl = 'https://' + pdaUrl;
    }
    this.pdaUrl = pdaUrl;
    this.jwtToken = jwtToken;
  }
  
  async writeToNamespace(namespace, dataPath, data) {
    try {
      // Construct wallet API endpoint: {pdaUrl}/api/v2/data/{namespace}/{dataPath}
      const endpoint = `${this.pdaUrl}/api/v2/data/${namespace}/${dataPath}`;
      console.log(`🔄 Writing to PDA: ${endpoint}`);
      
      const response = await axios.post(
        endpoint,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            // Pass original JWT token as X-Auth-Token header for wallet authentication
            'X-Auth-Token': this.jwtToken
          },
          timeout: 30000
        }
      );
      
      console.log('✅ Data written to PDA successfully');
      
      return {
        success: true,
        recordId: response.data.recordId || response.data.id || 'unknown',
        response: response.data,
        status: response.status
      };
      
    } catch (error) {
      console.error('❌ Failed to write to PDA:', error.response?.data || error.message);
      throw new Error(`Failed to write to PDA namespace ${namespace}/${dataPath}: ${error.message}`);
    }
  }
}

/**
 * Error page endpoint
 * GET /error?type=EMAIL_NOT_FOUND&message=Contact not found&request_id=123
 */
app.get('/error', (req, res) => {
  const { type, message, request_id, details } = req.query;
  
  
  // Define error page content based on error type
  const errorInfo = getErrorPageInfo(type, message, request_id, details);
  
  const htmlContent = generateErrorPageHTML(errorInfo);
  
  res.status(errorInfo.statusCode).send(htmlContent);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get error page information based on error type
 */
function getErrorPageInfo(type, message, request_id, details) {
  const errorTypes = {
    EMAIL_NOT_FOUND: {
      title: 'Contact Not Found',
      statusCode: 404,
      icon: '🔍',
      description: 'The merchant email address could not be found in Zoho CRM.',
      userAction: 'Please contact support or verify the email address is correct.',
      color: '#f59e0b'
    },
    INVALID_TOKEN: {
      title: 'Authentication Failed',
      statusCode: 401,
      icon: '🔐',
      description: 'The authentication token is invalid or has expired.',
      userAction: 'Please try again or contact your system administrator.',
      color: '#ef4444'
    },
    OAUTH_FAILURE: {
      title: 'Zoho CRM Connection Error',
      statusCode: 401,
      icon: '🔗',
      description: 'Unable to connect to Zoho CRM. Authentication failed.',
      userAction: 'Please check the connector configuration.',
      color: '#ef4444'
    },
    API_ERROR: {
      title: 'Service Error',
      statusCode: 500,
      icon: '⚠️',
      description: 'An unexpected error occurred while processing your request.',
      userAction: 'Please try again later or contact support.',
      color: '#dc2626'
    },
    INVALID_DATA: {
      title: 'Invalid Request',
      statusCode: 400,
      icon: '📋',
      description: 'The request data is invalid or missing required information.',
      userAction: 'Please check the request parameters and try again.',
      color: '#f59e0b'
    }
  };

  const errorInfo = errorTypes[type] || errorTypes.API_ERROR;
  
  return {
    ...errorInfo,
    message: message || errorInfo.description,
    request_id: request_id || 'Unknown',
    details: details || '',
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate HTML error page
 */
function generateErrorPageHTML(errorInfo) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${errorInfo.title} - Zoho CRM Data Connector</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .error-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        
        .error-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            display: block;
        }
        
        .error-title {
            color: ${errorInfo.color};
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 16px;
        }
        
        .error-message {
            color: #4b5563;
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        
        .error-details {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
            text-align: left;
        }
        
        .error-details h3 {
            color: #374151;
            font-size: 1rem;
            margin-bottom: 12px;
            font-weight: 600;
        }
        
        .detail-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .detail-item:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            color: #6b7280;
            font-weight: 500;
        }
        
        .detail-value {
            color: #374151;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
        }
        
        .user-action {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
        }
        
        .user-action-title {
            color: #1e40af;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .user-action-text {
            color: #1e3a8a;
        }
        
        .actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
            font-size: 0.95rem;
        }
        
        .btn-primary {
            background: ${errorInfo.color};
            color: white;
        }
        
        .btn-primary:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        
        .btn-secondary:hover {
            background: #e5e7eb;
        }
        
        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 0.875rem;
        }
        
        @media (max-width: 640px) {
            .error-container {
                padding: 24px;
            }
            
            .error-title {
                font-size: 1.5rem;
            }
            
            .actions {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">${errorInfo.icon}</div>
        <h1 class="error-title">${errorInfo.title}</h1>
        <p class="error-message">${errorInfo.message}</p>
        
        <div class="error-details">
            <h3>Error Details</h3>
            <div class="detail-item">
                <span class="detail-label">Error Code:</span>
                <span class="detail-value">${errorInfo.statusCode}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Request ID:</span>
                <span class="detail-value">${errorInfo.request_id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-value">${new Date(errorInfo.timestamp).toLocaleString()}</span>
            </div>
            ${errorInfo.details ? `
            <div class="detail-item">
                <span class="detail-label">Details:</span>
                <span class="detail-value">${errorInfo.details}</span>
            </div>
            ` : ''}
        </div>
        
        <div class="user-action">
            <div class="user-action-title">What to do next:</div>
            <div class="user-action-text">${errorInfo.userAction}</div>
        </div>
        
        <div class="actions">
            <button class="btn btn-primary" onclick="window.history.back()">Go Back</button>
            <button class="btn btn-secondary" onclick="window.location.reload()">Try Again</button>
        </div>
        
        <div class="footer">
            Zoho CRM Data Connector v1.0.0<br>
            If you continue to experience issues, please contact support with the Request ID above.
        </div>
    </div>
</body>
</html>`;
}

// Start server
app.listen(port, () => {
  console.log(`🚀 Zoho CRM Data Connector Server running on port ${port}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET /connect - Main data connector endpoint`);
  console.log(`   GET /error - Error page display`);
  console.log(`   GET /health - Health check`);
});

module.exports = app;
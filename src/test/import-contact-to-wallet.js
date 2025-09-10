const ZohoCRMConnector = require('../connectors/zoho-crm-connector');
const DATASWYFTWalletClient = require('../storage/dataswyft-wallet-client');

// Error codes and retry strategies matching the screenshot specification
const ERROR_CODES = {
  EMAIL_NOT_FOUND: {
    code: 404,
    message: 'Merchant email not found in Zoho CRM',
    retryable: false,
    userAction: 'Contact support'
  },
  OAUTH_FAILURE: {
    code: 401,
    message: 'Unable to authenticate with Zoho CRM',
    retryable: true,
    userAction: 'Check configuration',
    retryStrategy: 'token_refresh_once'
  },
  ZOHO_CRM_API_ERROR: {
    code: 503,
    message: 'Zoho CRM service temporarily unavailable',
    retryable: true,
    userAction: 'Retry later',
    retryStrategy: 'exponential_backoff',
    maxAttempts: 3
  },
  INVALID_EMAIL: {
    code: 400,
    message: 'Invalid email format provided',
    retryable: false,
    userAction: 'Check email'
  },
  RATE_LIMITED: {
    code: 429,
    message: 'Too many requests, please wait',
    retryable: true,
    userAction: 'Wait 10 minutes',
    retryStrategy: 'rate_limit_window',
    waitTime: 600 // 10 minutes
  },
  NO_MODULE_ACCESS: {
    code: 403,
    message: 'Cannot access Contacts module',
    retryable: false,
    userAction: 'Config error'
  },
  TOKEN_EXPIRED: {
    code: 401,
    message: 'OAuth token expired',
    retryable: true,
    userAction: 'Refresh token',
    retryStrategy: 'token_refresh_once'
  },
  NETWORK_ERROR: {
    code: 500,
    message: 'Network connection error',
    retryable: true,
    userAction: 'Check connection',
    retryStrategy: 'immediate_then_exponential'
  }
};

/**
 * Determine error type based on error characteristics
 * @param {Error} error - The error object
 * @returns {Object} Error details with code, message, retryable, userAction, retryStrategy
 */
function determineErrorType(error) {
  // Check for specific error patterns
  if (error.message.includes('No contact found') || error.message.includes('EMAIL_NOT_FOUND')) {
    return ERROR_CODES.EMAIL_NOT_FOUND;
  }
  
  if (error.message.includes('token expired') || error.message.includes('TOKEN_EXPIRED')) {
    return ERROR_CODES.TOKEN_EXPIRED;
  }
  
  if (error.message.includes('oauth') || error.message.includes('authenticate') || error.message.includes('401')) {
    return ERROR_CODES.OAUTH_FAILURE;
  }
  
  if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('Too many requests')) {
    return ERROR_CODES.RATE_LIMITED;
  }
  
  if (error.message.includes('403') || error.message.includes('module') || error.message.includes('access')) {
    return ERROR_CODES.NO_MODULE_ACCESS;
  }
  
  if (error.message.includes('Invalid email') || error.message.includes('email format') || error.message.includes('400')) {
    return ERROR_CODES.INVALID_EMAIL;
  }
  
  if (error.message.includes('Network') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  
  // Default to Zoho CRM API error for unknown errors (503)
  return ERROR_CODES.ZOHO_CRM_API_ERROR;
}

/**
 * Calculate exponential backoff delay as per requirements
 * @param {number} attempt - Current attempt number (1-based)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  return Math.pow(2, attempt - 1) * 1000;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry operation with exponential backoff as per requirements
 * @param {Function} operation - The operation to retry
 * @param {number} maxAttempts - Maximum number of attempts (default: 3)
 * @returns {Promise<any>} Result of the operation
 */
async function withRetry(operation, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorDetails = determineErrorType(error);
      
      // If not retryable or last attempt, throw the error
      if (!errorDetails.retryable || attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay and log retry attempt
      const delay = calculateBackoffDelay(attempt);
      console.log(`🔄 Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      console.log(`   Retrying in ${delay/1000} seconds... (${errorDetails.userAction})`);
      
      await sleep(delay);
    }
  }
}

/**
 * Import contact from Zoho CRM to Dataswyft wallet with retry logic
 * @param {string} email - Email address to search for in Zoho CRM
 * @returns {Promise<Object>} Import result with record ID
 */
async function importContactToWallet(email) {
  console.log(`🔄 Importing contact ${email} from Zoho CRM to Dataswyft wallet...\n`);
  
  const crmConnector = new ZohoCRMConnector();
  const walletClient = new DATASWYFTWalletClient();
  
  try {
    // Step 1: Get contact from Zoho CRM with retry logic
    console.log('🔍 Step 1: Searching for contact in Zoho CRM...');
    const contactData = await withRetry(
      () => crmConnector.getContactForDataswyft(email),
      3 // maxAttempts as per requirements
    );
    
    if (!contactData) {
      console.log('❌ No contact found in Zoho CRM with this email address');
      
      const errorDetails = ERROR_CODES.EMAIL_NOT_FOUND;
      const callbackUrl = process.env.CALLBACK_URL || 'https://example.com/callback';
      const callbackUrlWithError = `${callbackUrl}?status=failure&code=${errorDetails.code}&message=${encodeURIComponent(errorDetails.message)}&userAction=${encodeURIComponent(errorDetails.userAction)}`;
      
      console.log(`📞 Error Callback URL: ${callbackUrlWithError}`);
      
      return {
        success: false,
        code: errorDetails.code,
        message: errorDetails.message,
        retryable: errorDetails.retryable,
        userAction: errorDetails.userAction,
        retryStrategy: errorDetails.retryStrategy,
        email: email,
        callbackUrl: callbackUrlWithError
      };
    }
    
    console.log('✅ Contact found in Zoho CRM!');
    console.log(`📋 Contact: ${contactData.data.content.firstname} ${contactData.data.content.lastname}`);
    console.log(`📋 Company: ${contactData.data.content.company}`);
    console.log(`📋 Zoho ID: ${contactData.data.content.zoho_object_id}`);
    
    // Step 2: Write to Dataswyft wallet (test namespace) with retry logic
    console.log('\n💾 Step 2: Writing contact to Dataswyft wallet (test namespace)...');
    const walletResult = await withRetry(
      () => walletClient.writeToNamespace('test', 'zoho-crm', contactData),
      3 // maxAttempts as per requirements
    );
    
    console.log('✅ Contact successfully written to Dataswyft wallet!');
    console.log(`📋 Record ID: ${walletResult.recordId}`);
    console.log(`📋 Status: ${walletResult.status}`);
    
    // Step 3: Prepare callback URL with recordId for success
    const callbackUrl = process.env.CALLBACK_URL || 'https://example.com/callback';
    const callbackUrlWithRecord = `${callbackUrl}?recordId=${walletResult.recordId}&status=success&code=200`;
    
    console.log(`📞 Success Callback URL: ${callbackUrlWithRecord}`);
    
    // Step 4: Return success result with callback URL
    return {
      success: true,
      code: 200,
      recordId: walletResult.recordId,
      zohoCRMId: contactData.data.content.zoho_object_id,
      email: email,
      contactName: `${contactData.data.content.firstname} ${contactData.data.content.lastname}`,
      company: contactData.data.content.company,
      syncTimestamp: contactData.data.metadata.sync_timestamp,
      callbackUrl: callbackUrlWithRecord,
      walletResponse: walletResult.response
    };
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    
    // Determine error type based on requirements.md error codes
    let errorDetails = determineErrorType(error);
    
    // Prepare callback URL for error case
    const callbackUrl = process.env.CALLBACK_URL || 'https://example.com/callback';
    const callbackUrlWithError = `${callbackUrl}?status=failure&code=${errorDetails.code}&message=${encodeURIComponent(errorDetails.message)}&userAction=${encodeURIComponent(errorDetails.userAction)}`;
    
    console.log(`📞 Error Callback URL: ${callbackUrlWithError}`);
    
    return {
      success: false,
      code: errorDetails.code,
      message: errorDetails.message,
      retryable: errorDetails.retryable,
      userAction: errorDetails.userAction,
      retryStrategy: errorDetails.retryStrategy,
      email: email,
      callbackUrl: callbackUrlWithError
    };
  }
}

/**
 * Test the complete import process
 */
async function testImportProcess() {
  console.log('🔄 Testing complete import process...\n');
  
  try {
    // Test 1: Import a known contact
    const email = 'michael.chen@globalfinance.com';
    const result = await importContactToWallet(email);
    
    if (result.success) {
      console.log('\n🎉 Import test completed successfully!');
      console.log('═'.repeat(50));
      console.log('📊 Import Summary:');
      console.log(`   Email: ${result.email}`);
      console.log(`   Contact: ${result.contactName}`);
      console.log(`   Company: ${result.company}`);
      console.log(`   Zoho CRM ID: ${result.zohoCRMId}`);
      console.log(`   Wallet Record ID: ${result.recordId}`);
      console.log(`   Sync Timestamp: ${result.syncTimestamp}`);
      
      console.log('\n✅ Ready for production use!');
      
    } else {
      console.log('\n❌ Import test failed:');
      console.log(`   Error Code: ${result.error}`);
      console.log(`   Message: ${result.message}`);
    }
    
    // Test 2: Test connection to wallet
    console.log('\n🔄 Testing Dataswyft wallet connection...');
    const walletClient = new DATASWYFTWalletClient();
    const connectionTest = await walletClient.testConnection();
    
    if (connectionTest) {
      console.log('✅ Dataswyft wallet connection test passed!');
    } else {
      console.log('❌ Dataswyft wallet connection test failed!');
    }
    
  } catch (error) {
    console.error('❌ Test process failed:', error.message);
    process.exit(1);
  }
}

// Export functions for use in other modules
module.exports = {
  importContactToWallet,
  testImportProcess
};

// Run test if this file is executed directly
if (require.main === module) {
  const email = process.argv[2];
  
  if (email) {
    // Import specific email
    importContactToWallet(email)
      .then(result => {
        console.log('\n📋 Final Result:');
        console.log(JSON.stringify(result, null, 2));
      })
      .catch(error => {
        console.error('❌ Script execution failed:', error.message);
        process.exit(1);
      });
  } else {
    // Run full test
    testImportProcess();
  }
}
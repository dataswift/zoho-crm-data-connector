/**
 * HTML Page Generation for Zoho CRM Data Connector
 * Handles success and error page rendering
 */

/**
 * Get error page information based on error type
 */
function getErrorPageInfo(type, message, request_id, details) {
  const errorTypes = {
    EMAIL_NOT_FOUND: {
      title: 'Email Not Found',
      statusCode: 404,
      icon: '🔍',
      description: 'Your email address was not found in the Zoho CRM contacts.',
      userAction: 'Please ensure you are using the correct email address associated with your account.',
      color: '#f59e0b'
    },
    INVALID_TOKEN: {
      title: 'Invalid Token',
      statusCode: 401,
      icon: '🔐',
      description: 'The authentication token provided is invalid or malformed.',
      userAction: 'Please request a new connection from CheckD.',
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
      title: 'Invalid Data Format',
      statusCode: 400,
      icon: '📋',
      description: 'The data parameter contains invalid or malformed JSON.',
      userAction: 'Please ensure the data parameter is properly formatted and URL-encoded.',
      color: '#f59e0b'
    },
    APP_MISMATCH: {
      title: 'Application Mismatch',
      statusCode: 401,
      icon: '🚫',
      description: 'The application ID in your authentication token does not match this connector.',
      userAction: 'Please ensure you are using the correct application credentials.',
      color: '#ef4444'
    },
    TOKEN_EXPIRED: {
      title: 'Token Expired',
      statusCode: 401,
      icon: '⏰',
      description: 'Your authentication token has expired.',
      userAction: 'Please request a new connection from CheckD.',
      color: '#ef4444'
    },
    MISSING_PARAMS: {
      title: 'Missing Parameters',
      statusCode: 400,
      icon: '❗',
      description: 'Required parameters are missing from the authentication request.',
      userAction: 'Please ensure the request includes token, callback URL, data, and request ID parameters.',
      color: '#f59e0b'
    },
    MISSING_EMAIL: {
      title: 'Missing Email Address',
      statusCode: 400,
      icon: '📧',
      description: 'No email address was provided in the authentication data.',
      userAction: 'Please ensure your email address is included in the request.',
      color: '#f59e0b'
    },
    SERVICE_ERROR: {
      title: 'Service Unavailable',
      statusCode: 503,
      icon: '🔧',
      description: 'The connector service is temporarily unavailable. Please try again later.',
      userAction: 'This is likely a temporary issue. Please wait a few moments and try again.',
      color: '#dc2626'
    },
    WALLET_ERROR: {
      title: 'Wallet Connection Error',
      statusCode: 502,
      icon: '💾',
      description: 'Failed to write data to your Dataswyft wallet. Please try again.',
      userAction: 'This may be a temporary issue with the wallet service or network connectivity.',
      color: '#dc2626'
    },
    CALLBACK_ERROR: {
      title: 'Callback Redirect Error',
      statusCode: 502,
      icon: '↩️',
      description: 'Failed to redirect back to the originating application.',
      userAction: 'The callback URL may be invalid or unreachable. Please contact support.',
      color: '#dc2626'
    },
    INTERNAL_ERROR: {
      title: 'Internal Server Error',
      statusCode: 500,
      icon: '💥',
      description: 'An unexpected internal error occurred. Please try again or contact support.',
      userAction: 'If this problem persists, please contact support with the request ID.',
      color: '#dc2626'
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
 * Generate HTML success page
 */
function generateSuccessPageHTML(successInfo) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Success - Zoho CRM Data Connector</title>
    <link rel="stylesheet" href="/styles.css">
    <style>
        .page-title {
            color: var(--primary-green);
        }
        
        .btn-primary {
            background: var(--primary-green);
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="page-icon">✅</div>
        <h1 class="page-title">Data Import Successful</h1>
        <p class="page-message">Your Zoho CRM contact data has been successfully imported and stored in your wallet.</p>
        
        <div class="page-details">
            <h3>Import Details</h3>
            <div class="detail-item">
                <span class="detail-label">Request ID:</span>
                <span class="detail-value">${successInfo.request_id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value">Completed</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-value">${new Date(successInfo.timestamp).toLocaleString()}</span>
            </div>
        </div>
        
        <div class="actions">
            ${successInfo.callback_url ? `
            <a href="${successInfo.callback_url}" class="btn btn-primary">${successInfo.callback_label}</a>
            ` : ''}
        </div>
        
        <div class="footer">
            Zoho CRM Data Connector v1.0.0<br>
            Your data has been securely stored in your personal data wallet.
        </div>
    </div>
</body>
</html>`;
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
    <link rel="stylesheet" href="/styles.css">
    <style>
        .page-title {
            color: ${errorInfo.color};
        }
        
        .btn-primary {
            background: ${errorInfo.color};
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="page-icon">${errorInfo.icon}</div>
        <h1 class="page-title">${errorInfo.title}</h1>
        <p class="page-message">${errorInfo.message}</p>
        
        <div class="page-details">
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
            ${errorInfo.callback_url ? `
            <a href="${errorInfo.callback_url}" class="btn btn-primary">${errorInfo.callback_label}</a>
            ` : ''}
        </div>
        
        <div class="footer">
            Zoho CRM Data Connector v1.0.0<br>
            If you continue to experience issues, please contact support with the Request ID above.
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
  getErrorPageInfo,
  generateSuccessPageHTML,
  generateErrorPageHTML
};
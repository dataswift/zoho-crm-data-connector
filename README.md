# Zoho CRM Data Connector

A production-ready webhook-driven data connector service that receives requests from the CheckD Data Connector Gateway, authenticates with Zoho CRM using OAuth 2.0, extracts merchant contact data, and stores it in Dataswyft Wallets with comprehensive error handling and user-friendly error pages.

## Features

- 🚀 **Production API Endpoint** - `/connect` endpoint for Data Connector Gateway integration
- 🔐 **Application Token Authentication** - Validates and processes Application tokens from the gateway
- 📧 **Email-Based Contact Search** - Searches Zoho CRM contacts by merchant email
- 💾 **Single Namespace Storage** - Stores data in `zoho/contacts` namespace
- 🔒 **Data Integrity Verification** - MD5 checksum validation for all stored data
- 📦 **Structured Payload Format** - Metadata wrapper with checksum and traceability
- 📄 **User-Friendly Error Pages** - Professional error pages for different failure scenarios
- 📞 **Callback Integration** - Returns status and record IDs via callback URLs
- 🔗 **Return to Application** - Success and error pages include buttons to return users to calling application
- 🧪 **Comprehensive Testing** - Full end-to-end test suite with checksum validation

## Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd zoho-crm-data-connector
npm install
```

### 2. Environment Configuration

Create your environment file:

```bash
cp .env.example .env
```

Configure your credentials in `.env`:

```bash
# Zoho CRM OAuth Configuration (Self-Client)
ZOHO_CRM_CLIENT_ID=your_client_id_here
ZOHO_CRM_CLIENT_SECRET=your_client_secret_here
ZOHO_CRM_REFRESH_TOKEN=your_refresh_token_here

# Data Connector Configuration (Required for production)
DS_APPLICATION_ID=oi-s-zohodataconnector
DS_NAMESPACE=zoho
DS_DATA_PATH=contacts
CONNECTOR_PORT=8080
CALLBACK_URL=https://example.com/callback

# Test-Only Configuration (Only needed for running test scripts)
DATASWIFT_API_URL=https://your-wallet-instance.hubat.net
DATASWIFT_USERNAME=your_username
DATASWIFT_PASSWORD=your_password
NODE_ENV=development
```

### 3. Zoho CRM Authentication Setup

#### Create Self-Client Application

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a new application → Select **"Self Client"**
3. Configure scopes: `ZohoCRM.modules.contacts.ALL`
4. Note your `Client ID` and `Client Secret`

#### Generate Refresh Token

1. In API Console → "Generate Code" tab
2. Select scopes: `ZohoCRM.modules.contacts.ALL`
3. Generate authorization code (**expires in 3 minutes**)
4. Add your Client ID and Client Secret to `.env` file first
5. Run the test suite to exchange authorization code for refresh token:

```bash
npm test
```

When prompted, enter your authorization code. The test will validate your setup and display the refresh token to copy to your `.env` file.

### 4. Test Data Setup

Import sample contacts to your Zoho CRM:

1. **Sample contacts included:**
   - `sarah.johnson@techcorp.com` - TechCorp Solutions (US)
   - `michael.chen@globalfinance.com` - Global Finance Ltd (UK)  
   - `emma.rodriguez@innovatestart.com` - InnovateStart Inc (Australia)

2. **Import to Zoho CRM:**
   - Upload `test_data/zoho_sample_data.csv` to your Contacts module
   - Map CSV columns to Zoho CRM fields

## Usage

### Start the Server

```bash
# Production mode
npm start

# Development mode  
npm run dev
```

Server runs on `http://localhost:8080` (or `CONNECTOR_PORT`)

### Main API Endpoint

#### `GET /connect` - Data Connector Gateway Endpoint

**Query Parameters:**
- `token` (required) - JWT token containing PDA URL and application ID
- `callback_url` (required) - URL to redirect after completion
- `callback_label` (optional) - Text for return button (defaults to "Return to Application")  
- `data` (required) - JSON object containing merchant email
- `request_id` (required) - Request identifier for tracking

**Example Request:**
```
GET /connect?token=eyJhbGc...&callback_url=https://checkd.io/api/callback&callback_label=Back%20to%20CheckD&data={"email":"merchant@example.com"}&request_id=req_123456
```

**Response Flow:**
1. **Immediate Response** - 200 OK with processing status
2. **Async Processing** - Validates JWT, searches Zoho CRM, stores data
3. **Callback Response** - Success/failure status with record IDs or error page URL

### User Interface Pages

The connector provides user-friendly pages for different scenarios:

#### Success Page
- **✅ Data Import Successful** - `/success?request_id=123&callback_url=https://app.com&callback_label=Return`
- Shows completion status with import details
- Includes return button to calling application

#### Error Pages  
- **🔍 Contact Not Found (404)** - `/error?type=EMAIL_NOT_FOUND`
- **🔐 Authentication Failed (401)** - `/error?type=INVALID_TOKEN`
- **🔗 Zoho CRM Error (401)** - `/error?type=OAUTH_FAILURE`
- **⚠️ Service Error (500)** - `/error?type=API_ERROR`
- **📋 Invalid Request (400)** - `/error?type=INVALID_DATA`

**Error Page Parameters:**
- `callback_url` (optional) - URL for return button
- `callback_label` (optional) - Text for return button
- When provided, only the return button is shown (no "Go Back" or "Try Again")

## Testing

### Run Test Suite

```bash
npm test
```

The test suite validates the complete `/connect` endpoint workflow including success scenarios, error handling, JWT token validation, error page functionality, and callback URL integration.

### Test Callback Functionality

To test the callback URL and return button functionality:

```bash
# Test success page with callback
curl "http://localhost:8080/success?request_id=test_123&callback_url=https://your-app.com/dashboard&callback_label=Back%20to%20Dashboard"

# Test error page with callback  
curl "http://localhost:8080/error?type=EMAIL_NOT_FOUND&message=Contact%20not%20found&request_id=test_456&callback_url=https://your-app.com&callback_label=Return%20to%20App"

# Open pages in browser for visual testing
open "http://localhost:8080/success?request_id=demo&callback_url=https://checkd.io&callback_label=Back%20to%20CheckD"
open "http://localhost:8080/error?type=EMAIL_NOT_FOUND&message=Demo%20error&request_id=demo&callback_url=https://checkd.io&callback_label=Back%20to%20CheckD"
```

## Data Flow

### Success Flow
1. **Gateway Request** → `/connect` endpoint with JWT token and callback parameters
2. **JWT Validation** → Extract PDA URL and validate expiration  
3. **Contact Search** → Find merchant in Zoho CRM by email
4. **Data Transform** → Convert to Dataswyft wallet format
5. **Checksum Generation** → Compute MD5 hash for data integrity
6. **Payload Creation** → Wrap data with metadata (inbox_message_id, timestamp, checksum)
7. **Storage** → Save to `zoho/contacts` namespace
8. **Callback** → Send success status with record ID
9. **Success Page** → User can view success page and return to calling application

### Error Flow  
1. **Error Detection** → Invalid token, missing email, API failure
2. **Error Page Generation** → Create user-friendly error page with return button
3. **Callback** → Send failure status with error page URL for user redirection
4. **Error Page** → User can view error details and return to calling application

## Data Structure

### Input (from Gateway)
```javascript
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // JWT with PDA URL
  callback_url: "https://checkd.io/api/callback",
  callback_label: "Back to CheckD Dashboard",           // Return button text
  data: "{\"email\":\"merchant@example.com\"}",       // Merchant email
  request_id: "req_123456"
}
```

### Output (to Dataswyft Wallet)
```javascript
// POST /api/v2.6/data/zoho/contacts
{
  "metadata": {
    "inbox_message_id": "inbox-msg-6899019000000603062-1755544928715",
    "created_at": "2025-08-18T19:23:01.604Z",
    "checksum": "a8e007b487bb707b04e6afc9fa7d0df9"
  },
  "data": {
    "namespace": "zoho",
    "endpoint": "/crm/v8/Contacts/search",
    "data": {
      "id": "6899019000000603062",
      "created_at": "2025-07-16T12:34:51-04:00",
      "source": {
        "provider": "zoho_crm",
        "version": "v8",
        "module": "Contacts"
      },
      "content": {
        "email": "merchant@example.com",
        "firstname": "John",
        "lastname": "Doe",
        "company": "Example Corp",
        "phone": "+1-555-0123",
        "jobtitle": "CEO",
        "country": "United States",
        // ... additional fields
      },
      "metadata": {
        "sync_timestamp": "2025-07-30T22:15:30.123Z",
        "connector_version": "1.0.0",
        "schema_version": "1.0"
      }
    }
  }
}
```

## Project Structure

```
src/
├── server.js                     # Main Express server with /connect endpoint
├── auth/
│   ├── oauth-client.js           # Zoho CRM OAuth 2.0 client
│   ├── token-manager.js          # Token caching and refresh
│   └── jwt-token-generator.js    # JWT utilities
├── connectors/
│   ├── zoho-crm-connector.js     # CRM API client with field optimization
│   ├── contact-search.js         # Email-based contact search
│   └── data-mapper.js            # Data transformation with checksum payload creation
├── storage/
│   └── dataswyft-wallet-client.js # Dataswyft Wallet API client
├── utils/
│   └── checksum-generator.js     # MD5 checksum generation for data integrity
└── test/
    ├── test-connect-endpoint.js   # Main endpoint test suite
    ├── run-connect-test.js        # Test runner with server management
    ├── test-connection.js         # OAuth authentication test
    ├── test-complete-flow.js      # End-to-end flow with checksum validation
    ├── test-wallet-write.js       # Wallet write tests with new payload structure
    └── show-payload-structure.js  # Payload structure demonstration
```

## Data Integrity & Checksum

### Checksum Implementation

The connector implements MD5 checksum validation for all data stored in the wallet:

- **Checksum Generation**: Computed from the transformed Zoho CRM data before storage
- **Algorithm**: MD5 hash of sorted keys and normalized values  
- **Purpose**: Detect data corruption or tampering
- **Location**: Stored in payload metadata for verification

### Payload Structure

All data written to the wallet uses a structured format:

```javascript
{
  "metadata": {
    "inbox_message_id": "unique-message-identifier",  // Traceability
    "created_at": "2025-08-18T19:23:01.604Z",        // Timestamp
    "checksum": "a8e007b487bb707b04e6afc9fa7d0df9"    // Data integrity hash
  },
  "data": {
    // Complete transformed Zoho CRM contact data
  }
}
```

### Testing Checksum

Verify checksum functionality:

```bash
# Test checksum generation and validation
node src/test/show-payload-structure.js

# Test complete flow with checksum
node src/test/test-complete-flow.js

# Test wallet writes with new structure  
node src/test/test-wallet-write.js
```

## Health Checks

### Server Health
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0", 
  "timestamp": "2025-07-30T22:15:30.123Z"
}
```

## Production Deployment

### Environment Variables
- Set `NODE_ENV=production` for production namespace usage
- Ensure `ZOHO_CRM_REFRESH_TOKEN` is valid and secure

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 8080
CMD ["npm", "start"]
```


## Error Handling

### Error Codes and HTTP Status Mapping

The connector provides comprehensive error handling with specific error codes and appropriate HTTP status codes:

#### 4xx Client Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `MISSING_PARAMS` | 400 | Required parameters (token, callback_url, data, request_id) are missing from the request |
| `MISSING_EMAIL` | 400 | No email address was provided in the authentication data object |
| `INVALID_DATA` | 400 | The data parameter contains invalid or malformed JSON that cannot be parsed |
| `EMAIL_NOT_FOUND` | 404 | The provided email address was not found in Zoho CRM contacts |
| `TOKEN_EXPIRED` | 401 | The authentication token has expired and is no longer valid |
| `TOKEN_INVALID` | 401 | The authentication token is malformed or invalid |
| `APP_MISMATCH` | 401 | The application ID in the token does not match the expected connector ID |
| `INVALID_TOKEN` | 401 | General token validation failure (legacy fallback) |
| `OAUTH_FAILURE` | 401 | Failed to authenticate with Zoho CRM using OAuth 2.0 |

#### 5xx Server Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `API_ERROR` | 500 | General unexpected error occurred during processing |
| `INTERNAL_ERROR` | 500 | Internal server error requiring support assistance |
| `WALLET_ERROR` | 502 | Failed to write data to Dataswyft wallet due to connectivity or service issues |
| `CALLBACK_ERROR` | 502 | Failed to send callback to the provided callback URL |
| `SERVICE_ERROR` | 503 | The connector service is temporarily unavailable |

### Error Response Format

All errors are returned with a structured response to the callback URL:

```json
{
  "status": "failure",
  "request_id": "req_123456",
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your authentication token has expired",
    "timestamp": "2025-08-29T12:00:00Z",
    "error_page_url": "https://connector.example.com/error?type=TOKEN_EXPIRED&..."
  },
  "redirect_url": "https://connector.example.com/error?..."
}
```

### Retry Strategy
- **Non-retryable**: Email not found, invalid tokens
- **Retryable**: OAuth failures, API errors, network issues
- **Automatic**: Exponential backoff for transient failures

## Performance

### Targets
- OAuth token acquisition: < 1 second
- Contact search: < 1 second  
- Data transformation: < 100ms
- Wallet storage: < 2 seconds
- **Total processing time: < 5 seconds**

### Optimization
- Limited field extraction from Zoho CRM
- In-memory token caching
- Namespace separation for test/production
- Connection pooling for external APIs

## Security

- ✅ **JWT token validation** with expiration checking
- ✅ **OAuth refresh tokens** stored securely as environment variables
- ✅ **Access tokens** never persisted to disk
- ✅ **HTTPS-only** communication with external APIs
- ✅ **Input validation** for all request parameters
- ✅ **Error page sanitization** to prevent XSS

## Troubleshooting

### Common Issues

**"Token has expired"**
- Regenerate authorization code in Zoho API Console
- Run `npm test` to get new refresh token

**"Contact not found"**  
- Verify email exists in Zoho CRM Contacts
- Check test data import was successful
- Ensure contact has required fields populated

**"Tests failing"**
- Verify all environment variables are set
- Check Zoho CRM refresh token is valid
- Ensure Dataswyft wallet credentials are correct

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run test suite: `npm test`
5. Submit pull request

## License

[Your License Here]
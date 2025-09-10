const jwt = require('jsonwebtoken');

/**
 * JWT Token Utilities for Zoho CRM Data Connector
 * Handles token decoding, validation, and PDA URL extraction
 */

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

module.exports = {
  decodeApplicationToken,
  extractPdaUrl,
  isTokenExpired
};
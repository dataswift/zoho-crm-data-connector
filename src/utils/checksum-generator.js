const crypto = require('crypto');

class ChecksumGenerator {
  /**
   * Compute a checksum for any structured data object
   * @param {Object|Array|*} data - The data to compute checksum for
   * @returns {string} - MD5 hash in lowercase hexadecimal
   */
  static computeChecksum(data) {
    const { keys, values } = this.extractKeysAndValues(data);
    
    const checksumString = [
      keys.sort().join(''),
      values.map(this.cleanupValue).sort().join('')
    ].join('');
    
    return this.md5Hash(checksumString);
  }

  /**
   * Extract all keys and values from nested data structure
   * @param {*} data - Input data of any type
   * @returns {Object} - Object containing arrays of keys and values
   */
  static extractKeysAndValues(data) {
    const keys = [];
    const values = [];
    
    this.doExtractKeysAndValues(data, keys, values);
    
    return { keys, values };
  }

  /**
   * Recursive function to extract keys and values
   * @param {*} data - Current data node
   * @param {Array} keys - Accumulator for keys
   * @param {Array} values - Accumulator for values
   */
  static doExtractKeysAndValues(data, keys, values) {
    if (data === null || data === undefined) {
      values.push(String(data));
      return;
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
      // Handle objects (maps)
      Object.entries(data).forEach(([key, value]) => {
        keys.push(String(key));
        this.doExtractKeysAndValues(value, keys, values);
      });
    } else if (Array.isArray(data)) {
      // Handle arrays
      data.forEach(item => {
        this.doExtractKeysAndValues(item, keys, values);
      });
    } else {
      // Handle primitive values
      values.push(String(data));
    }
  }

  /**
   * Clean up value by converting to lowercase and removing non-alphanumeric characters
   * @param {string} value - Input value as string
   * @returns {string} - Cleaned value
   */
  static cleanupValue(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Compute MD5 hash of input string
   * @param {string} input - Input string to hash
   * @returns {string} - MD5 hash in lowercase hexadecimal
   */
  static md5Hash(input) {
    return crypto.createHash('md5').update(input).digest('hex');
  }
}

module.exports = ChecksumGenerator;
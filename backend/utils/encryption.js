const crypto = require('crypto');

class DatabaseEncryption {
  constructor() {
    // AES-256-GCM parameters
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 12;  // 96 bits (recommended for GCM)
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment variable
    this.masterKey = this.deriveMasterKey(process.env.DB_ENCRYPTION_KEY);
    
    if (!this.masterKey) {
      throw new Error('DB_ENCRYPTION_KEY environment variable is required');
    }
  }

  deriveMasterKey(password) {
    if (!password) return null;
    
    // Use PBKDF2 to derive a consistent key from the password
    const salt = Buffer.from(process.env.DB_ENCRYPTION_SALT || 'default-salt-change-in-production');
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
      return plaintext; // Return as-is if not a string or empty
    }

    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipherGCM(this.algorithm, this.masterKey, iv);
      
      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8');
      cipher.final();
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data and convert to hex
      const combined = Buffer.concat([iv, tag, encrypted]);
      return combined.toString('hex');
      
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData; // Return as-is if not encrypted string
    }

    try {
      // Convert from hex to buffer
      const combined = Buffer.from(encryptedData, 'hex');
      
      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipherGCM(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decipher.final();
      
      return decrypted;
      
    } catch (error) {
      console.error('Decryption error:', error);
      // In production, you might want to handle this differently
      throw new Error('Failed to decrypt data');
    }
  }

  // Utility methods for specific field types
  encryptEmail(email) {
    return this.encrypt(email?.toLowerCase()?.trim());
  }

  encryptName(name) {
    return this.encrypt(name?.trim());
  }

  encryptText(text) {
    return this.encrypt(text);
  }

  // Search-friendly hashing for emails (for lookups)
  hashForSearch(value) {
    if (!value) return null;
    return crypto.createHmac('sha256', this.masterKey)
      .update(value.toLowerCase().trim())
      .digest('hex');
  }
}

// Export a single instance (singleton pattern)
module.exports = new DatabaseEncryption();
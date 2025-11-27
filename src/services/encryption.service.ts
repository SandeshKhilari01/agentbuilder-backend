import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class EncryptionService {
    private key: Buffer;

    constructor() {
        const keyHex = process.env.ENCRYPTION_KEY;
        if (!keyHex || keyHex.length !== KEY_LENGTH * 2) {
            throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
        }
        this.key = Buffer.from(keyHex, 'hex');
    }

    /**
     * Encrypt plaintext using AES-256-GCM
     * Returns: base64(iv + authTag + ciphertext)
     */
    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Combine: iv + authTag + encrypted
        const combined = Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);

        return combined.toString('base64');
    }

    /**
     * Decrypt ciphertext
     * Input: base64(iv + authTag + ciphertext)
     */
    decrypt(ciphertext: string): string {
        const combined = Buffer.from(ciphertext, 'base64');

        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Mask a secret for display (show first 3 and last 3 chars)
     */
    mask(secret: string): string {
        if (secret.length <= 6) {
            return '***';
        }
        return `${secret.substring(0, 3)}...${secret.substring(secret.length - 3)}`;
    }
}

export default new EncryptionService();

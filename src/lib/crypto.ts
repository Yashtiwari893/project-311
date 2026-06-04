import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY!
const ALGORITHM = 'aes-256-cbc'

/**
 * Encrypts a string using AES-256-CBC
 * @param text - The text to encrypt
 * @returns Encrypted string in format: ivHex:encryptedHex
 */
export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a string encrypted by encrypt()
 * @param encrypted - The encrypted string in format: ivHex:encryptedHex
 * @returns Decrypted text
 */
export function decrypt(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(':')
  
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted format')
  }
  
  const iv = Buffer.from(ivHex, 'hex')
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

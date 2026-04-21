/**
 * Token conversion utilities
 * Converts between INR (fiat) and PROP tokens
 */

// Conversion rate: 100 INR = 1 PROP token
// This can be adjusted based on your tokenomics
const INR_TO_TOKEN_RATE = 0.01 // 1 INR = 0.01 PROP, so 100 INR = 1 PROP

/**
 * Convert INR amount to PROP tokens
 * @param {number} amountInINR - Amount in Indian Rupees
 * @returns {number} Amount in PROP tokens
 */
export const inrToTokens = (amountInINR) => {
  return amountInINR * INR_TO_TOKEN_RATE
}

/**
 * Convert PROP tokens to INR
 * @param {number} amountInTokens - Amount in PROP tokens
 * @returns {number} Amount in Indian Rupees
 */
export const tokensToINR = (amountInTokens) => {
  return amountInTokens / INR_TO_TOKEN_RATE
}

/**
 * Format token amount for display
 * @param {number} amount - Amount in tokens
 * @param {string} currency - Currency code (PROP, INR, etc.)
 * @returns {string} Formatted string
 */
export const formatTokenAmount = (amount, currency = 'PROP') => {
  if (currency === 'PROP') {
    return `${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} PROP`
  }
  return `₹${parseFloat(amount).toLocaleString('en-IN')}`
}

/**
 * Get conversion rate
 * @returns {number} Current conversion rate
 */
export const getConversionRate = () => {
  return INR_TO_TOKEN_RATE
}


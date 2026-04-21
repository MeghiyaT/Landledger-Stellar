/**
 * Token conversion utilities
 * Converts between INR (fiat) and XLM tokens
 */

// Conversion rate: 100 INR = 1 XLM token
// This is a fixed rate for the hackathon simulation
const INR_TO_XLM_RATE = 0.01 // 1 INR = 0.01 XLM, so 100 INR = 1 XLM

/**
 * Convert INR amount to XLM tokens
 * @param {number} amountInINR - Amount in Indian Rupees
 * @returns {number} Amount in XLM tokens
 */
export const inrToTokens = (amountInINR) => {
  return amountInINR * INR_TO_XLM_RATE
}

/**
 * Convert XLM tokens to INR
 * @param {number} amountInXlm - Amount in XLM tokens
 * @returns {number} Amount in Indian Rupees
 */
export const tokensToINR = (amountInXlm) => {
  return amountInXlm / INR_TO_XLM_RATE
}

/**
 * Format token amount for display
 * @param {number} amount - Amount in tokens
 * @param {string} currency - Currency code (XLM, INR, etc.)
 * @returns {string} Formatted string
 */
export const formatTokenAmount = (amount, currency = 'XLM') => {
  if (currency === 'XLM') {
    return `${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} XLM`
  }
  return `₹${parseFloat(amount).toLocaleString('en-IN')}`
}

/**
 * Get conversion rate
 * @returns {number} Current conversion rate
 */
export const getConversionRate = () => {
  return INR_TO_XLM_RATE
}

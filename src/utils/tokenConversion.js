/**
 * Token conversion utilities
 * Converts between Fiat (INR, USD, etc.) and XLM tokens
 */

// Reasonable exchange rates relative to 1 XLM (approximate market rates)
// These can be updated via an API call in a production environment
export const EXCHANGE_RATES = {
  XLM: 1,
  INR: 16.75, // 1 XLM = 16.75 INR
  USD: 0.20,   // 1 XLM = 0.20 USD
  EUR: 0.18,   // 1 XLM = 0.18 EUR
  GBP: 0.16,   // 1 XLM = 0.16 GBP
}

/**
 * Convert Fiat amount to XLM tokens
 * @param {number} amount - Amount in fiat currency
 * @param {string} fromCurrency - Currency code (INR, USD, etc.)
 * @returns {number} Amount in XLM tokens
 */
export const fiatToTokens = (amount, fromCurrency = 'INR') => {
  const rate = EXCHANGE_RATES[fromCurrency.toUpperCase()] || EXCHANGE_RATES.INR
  return amount / rate
}

/**
 * Convert XLM tokens to Fiat
 * @param {number} amountInXlm - Amount in XLM tokens
 * @param {string} toCurrency - Target currency code
 * @returns {number} Amount in target fiat currency
 */
export const tokensToFiat = (amountInXlm, toCurrency = 'INR') => {
  const rate = EXCHANGE_RATES[toCurrency.toUpperCase()] || EXCHANGE_RATES.INR
  return amountInXlm * rate
}

/**
 * Format currency amount for display
 * @param {number|string} amount - Amount to format
 * @param {string} currency - Currency code (XLM, INR, USD, etc.)
 * @returns {string} Formatted string
 */
export const formatCurrency = (amount, currency = 'XLM') => {
  const val = parseFloat(amount || 0)
  const curr = currency.toUpperCase()
  
  if (curr === 'XLM') {
    return `${val.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 7 
    })} XLM`
  }

  const options = {
    INR: { style: 'currency', currency: 'INR', locale: 'en-IN' },
    USD: { style: 'currency', currency: 'USD', locale: 'en-US' },
    EUR: { style: 'currency', currency: 'EUR', locale: 'de-DE' },
    GBP: { style: 'currency', currency: 'GBP', locale: 'en-GB' },
  }

  const config = options[curr] || options.INR
  return new Intl.NumberFormat(config.locale, {
    style: config.style,
    currency: config.currency,
  }).format(val)
}

/**
 * Legacy support for INR to Tokens conversion
 */
export const inrToTokens = (amountInINR) => {
  return fiatToTokens(amountInINR, 'INR')
}

/**
 * Legacy support for Tokens to INR conversion
 */
export const tokensToINR = (amountInXlm) => {
  return tokensToFiat(amountInXlm, 'INR')
}

/**
 * Get conversion rate for a specific currency
 * @param {string} currency - Currency code
 * @returns {number} Current conversion rate
 */
export const getConversionRate = (currency = 'INR') => {
  return EXCHANGE_RATES[currency.toUpperCase()] || EXCHANGE_RATES.INR
}

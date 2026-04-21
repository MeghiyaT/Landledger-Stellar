// Placeholder image utilities

// Simple SVG placeholder that always works (no external requests)
export const getPlaceholderImage = (width = 800, height = 600, text = 'No Image') => {
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e5e7eb"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af" text-anchor="middle" dy=".3em">${text}</text>
    </svg>
  `)}`
}

// Default placeholder for properties
export const PROPERTY_PLACEHOLDER = getPlaceholderImage(800, 600, 'Property Image')

// Check if a URL is a blob URL (temporary, will expire)
export const isBlobUrl = (url) => {
  return url && typeof url === 'string' && url.startsWith('blob:')
}

// Get a safe image URL - converts blob URLs to placeholder
export const getSafeImageUrl = (url) => {
  if (!url) return PROPERTY_PLACEHOLDER
  if (isBlobUrl(url)) return PROPERTY_PLACEHOLDER
  return url
}








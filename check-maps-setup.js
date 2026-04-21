#!/usr/bin/env node
/* eslint-env node */

/**
 * Google Maps Setup Checker
 * 
 * Run this script to verify your Google Maps API integration is properly configured.
 * 
 * Usage: node check-maps-setup.js
 */

const fs = require('fs')
const path = require('path')

console.log('🗺️  Google Maps Integration Setup Checker\n')
console.log('=' .repeat(50))

let allChecksPass = true

// Check 1: .env file exists
console.log('\n📋 Checking .env file...')
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  console.log('✅ .env file found')
  
  // Check if it contains the Google Maps API key
  const envContent = fs.readFileSync(envPath, 'utf8')
  if (envContent.includes('VITE_GOOGLE_MAPS_API_KEY')) {
    console.log('✅ VITE_GOOGLE_MAPS_API_KEY variable found')
    
    // Check if it's not empty or placeholder
    const match = envContent.match(/VITE_GOOGLE_MAPS_API_KEY=(.+)/)
    if (match && match[1] && !match[1].includes('your_') && match[1].trim().length > 20) {
      console.log('✅ API key appears to be configured')
    } else {
      console.log('⚠️  API key looks like a placeholder - please add your actual key')
      allChecksPass = false
    }
  } else {
    console.log('❌ VITE_GOOGLE_MAPS_API_KEY not found in .env')
    console.log('   Add: VITE_GOOGLE_MAPS_API_KEY=your_api_key_here')
    allChecksPass = false
  }
} else {
  console.log('❌ .env file not found')
  console.log('   Create one based on ENV_TEMPLATE.md')
  allChecksPass = false
}

// Check 2: MapComponent exists
console.log('\n📦 Checking MapComponent...')
const mapComponentPath = path.join(__dirname, 'src', 'components', 'MapComponent.jsx')
if (fs.existsSync(mapComponentPath)) {
  console.log('✅ MapComponent.jsx found')
} else {
  console.log('❌ MapComponent.jsx not found at src/components/MapComponent.jsx')
  allChecksPass = false
}

// Check 3: Dependencies installed
console.log('\n📚 Checking dependencies...')
const packageJsonPath = path.join(__dirname, 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  if (packageJson.dependencies && packageJson.dependencies['@googlemaps/react-wrapper']) {
    console.log('✅ @googlemaps/react-wrapper installed')
  } else {
    console.log('⚠️  @googlemaps/react-wrapper not found in dependencies')
    console.log('   Run: npm install @googlemaps/react-wrapper')
    allChecksPass = false
  }
} else {
  console.log('❌ package.json not found')
  allChecksPass = false
}

// Check 4: node_modules exists
console.log('\n📂 Checking node_modules...')
const nodeModulesPath = path.join(__dirname, 'node_modules')
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists')
  
  // Check if @googlemaps/react-wrapper is actually installed
  const gmapsModulePath = path.join(nodeModulesPath, '@googlemaps', 'react-wrapper')
  if (fs.existsSync(gmapsModulePath)) {
    console.log('✅ @googlemaps/react-wrapper module found')
  } else {
    console.log('⚠️  @googlemaps/react-wrapper not installed')
    console.log('   Run: npm install')
    allChecksPass = false
  }
} else {
  console.log('❌ node_modules not found')
  console.log('   Run: npm install')
  allChecksPass = false
}

// Check 5: Documentation exists
console.log('\n📖 Checking documentation...')
const docs = [
  'GOOGLE_MAPS_SETUP.md',
  'GOOGLE_MAPS_QUICKSTART.md',
  'ENV_TEMPLATE.md'
]

docs.forEach(doc => {
  const docPath = path.join(__dirname, doc)
  if (fs.existsSync(docPath)) {
    console.log(`✅ ${doc} found`)
  } else {
    console.log(`⚠️  ${doc} not found`)
  }
})

// Final summary
console.log('\n' + '='.repeat(50))
if (allChecksPass) {
  console.log('\n✅ All critical checks passed!')
  console.log('\n🚀 Next steps:')
  console.log('   1. Make sure you have a valid Google Maps API key')
  console.log('   2. Add it to your .env file')
  console.log('   3. Restart your dev server: npm run dev')
  console.log('   4. Navigate to a property details page')
  console.log('   5. See the map in the Location section!')
  console.log('\n📚 Need help? Check GOOGLE_MAPS_QUICKSTART.md')
} else {
  console.log('\n⚠️  Some checks failed. Please review the messages above.')
  console.log('\n📚 For detailed setup instructions, see:')
  console.log('   - GOOGLE_MAPS_QUICKSTART.md (quick setup)')
  console.log('   - GOOGLE_MAPS_SETUP.md (detailed guide)')
}

console.log('\n')









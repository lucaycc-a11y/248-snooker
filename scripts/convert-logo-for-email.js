#!/usr/bin/env node
/**
 * Converts Space8 SVG logo to high-resolution PNG for email templates
 *
 * Email clients (especially Outlook) don't support SVG images reliably.
 * This script converts Space8_full_icon_white_black_bkg.svg to PNG at @3x resolution
 * for maximum quality on Retina displays.
 *
 * Target: 320px display width × 3 = 960px actual PNG width
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('❌ Error: sharp package not found.');
  console.error('   Install it with: npm install sharp --save-dev');
  console.error('   Then run this script again.');
  process.exit(1);
}

const SVG_PATH = path.join(__dirname, '../public/logos/Space8_full_icon_white_black_bkg.svg');
const PNG_PATH = path.join(__dirname, '../public/logos/space8-logo-email.png');
const PNG_WIDTH = 960; // 320px display × 3 for @3x resolution

async function convertLogo() {
  console.log('🎨 Converting Space8 logo SVG to PNG for email templates...');
  console.log(`   Source: ${path.relative(process.cwd(), SVG_PATH)}`);
  console.log(`   Output: ${path.relative(process.cwd(), PNG_PATH)}`);
  console.log(`   Size: ${PNG_WIDTH}px width (@3x resolution for 320px display)`);

  try {
    // Check if source exists
    if (!fs.existsSync(SVG_PATH)) {
      throw new Error(`Source SVG not found: ${SVG_PATH}`);
    }

    // Convert SVG to PNG at @3x resolution
    await sharp(SVG_PATH)
      .resize({ width: PNG_WIDTH })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(PNG_PATH);

    const stats = fs.statSync(PNG_PATH);
    console.log(`✅ Success! PNG created (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Upload the PNG to your hosting (e.g., Vercel/Cloudflare)');
    console.log('2. Verify it\'s accessible at: https://space8.com.hk/logos/space8-logo-email.png');
    console.log('3. Test emails in Gmail, Outlook, and Apple Mail to confirm rendering');
    console.log('');
    console.log('💡 The email templates already reference this URL, so once uploaded, they\'ll work immediately.');
  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

convertLogo();

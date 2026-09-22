/**
 * Manual Test Script for Stripe Two-Stage Payment Flow
 *
 * Usage:
 * 1. Open http://localhost:3000/zh-HK/book in Chrome
 * 2. Open DevTools Console
 * 3. Paste this entire script and press Enter
 * 4. Follow the prompts to test Card and WeChat Pay flows
 */

console.log('🧪 Stripe Two-Stage Test Script Loaded\n')

const testUtils = {
  // Check if an element exists and is visible
  checkElement(selector, shouldExist = true) {
    const el = document.querySelector(selector)
    const exists = el !== null && el.offsetParent !== null
    const status = exists === shouldExist ? '✅' : '❌'
    console.log(`${status} ${selector}: ${exists ? 'VISIBLE' : 'NOT FOUND'}`)
    return exists === shouldExist
  },

  // Wait for element to appear
  async waitFor(selector, timeout = 5000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector)
      if (el && el.offsetParent !== null) {
        return el
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Timeout waiting for ${selector}`)
  },

  // Test Card Payment UI
  async testCardUI() {
    console.log('\n📋 Testing Card Payment UI...\n')

    // Wait for PaymentElement to appear
    try {
      await this.waitFor('#payment-element', 10000)
      console.log('✅ Waiting for PaymentElement... FOUND')
    } catch (e) {
      console.log('❌ PaymentElement did not appear within 10s')
      return false
    }

    // Verify Card UI elements
    const cardChecks = [
      this.checkElement('#payment-element', true),
      this.checkElement('button[type="submit"]', true),
      this.checkElement('[data-testid="wechat-qr-code"]', false),
      this.checkElement('.countdown', false)
    ]

    const allPassed = cardChecks.every(x => x)

    if (allPassed) {
      console.log('\n✅ CARD UI TEST PASSED - PaymentElement shown, QR hidden')
    } else {
      console.log('\n❌ CARD UI TEST FAILED - Mutual exclusion violated')
    }

    return allPassed
  },

  // Test WeChat Pay QR UI
  async testWeChatUI() {
    console.log('\n📋 Testing WeChat Pay QR UI...\n')

    // Wait for QR code to appear
    try {
      await this.waitFor('[data-testid="wechat-qr-code"]', 10000)
      console.log('✅ Waiting for QR code... FOUND')
    } catch (e) {
      // Try alternative selectors
      const qrSvg = document.querySelector('svg[viewBox*="0 0"]')
      if (qrSvg && qrSvg.closest('.qr-container, .wechat-qr, [class*="qr"]')) {
        console.log('✅ QR code found (alternative selector)')
      } else {
        console.log('❌ QR code did not appear within 10s')
        return false
      }
    }

    // Verify WeChat QR elements
    const wechatChecks = [
      this.checkElement('[data-testid="wechat-qr-code"]', true) || document.querySelector('svg[viewBox*="0 0"]') !== null,
      this.checkElement('#payment-element', false),
      this.checkElement('input[name="cardNumber"]', false)
    ]

    const allPassed = wechatChecks.every(x => x)

    if (allPassed) {
      console.log('\n✅ WECHAT QR TEST PASSED - QR shown, PaymentElement hidden')
    } else {
      console.log('\n❌ WECHAT QR TEST FAILED - Mutual exclusion violated')
    }

    return allPassed
  },

  // Check current stage
  detectStage() {
    const hasMethodList = document.querySelector('button:has-text("信用卡"), button:has-text("微信支付")')
    const hasPaymentElement = document.querySelector('#payment-element')
    const hasQR = document.querySelector('[data-testid="wechat-qr-code"]')

    if (hasMethodList) {
      return 'Stage 1: Method Selection'
    } else if (hasPaymentElement) {
      return 'Stage 2: Card Payment'
    } else if (hasQR) {
      return 'Stage 2: WeChat QR'
    } else {
      return 'Unknown stage'
    }
  },

  // Take screenshot (manual instruction)
  takeScreenshot(name) {
    console.log(`\n📸 Please take screenshot now: ${name}`)
    console.log('   Chrome: Cmd+Shift+4 (Mac) or Snipping Tool (Windows)')
    console.log('   Save as: ' + name)
  }
}

// Auto-detect current stage
console.log('Current Stage:', testUtils.detectStage())

// Instructions
console.log('\n📖 Manual Test Instructions:\n')
console.log('1️⃣  TEST CARD PAYMENT:')
console.log('   - Click "信用卡" button in payment method list')
console.log('   - Run: await testUtils.testCardUI()')
console.log('   - Run: testUtils.takeScreenshot("test-card-ui.png")\n')

console.log('2️⃣  TEST WECHAT PAY:')
console.log('   - Refresh page and select a time slot')
console.log('   - Click "微信支付" button')
console.log('   - Run: await testUtils.testWeChatUI()')
console.log('   - Run: testUtils.takeScreenshot("test-wechat-qr-ui.png")\n')

console.log('3️⃣  QUICK TEST (if already on Stage 2):')
console.log('   - For Card: await testUtils.testCardUI()')
console.log('   - For WeChat: await testUtils.testWeChatUI()\n')

// Export to window for easy access
window.stripeTest = testUtils
console.log('✅ Test utilities available as: window.stripeTest\n')

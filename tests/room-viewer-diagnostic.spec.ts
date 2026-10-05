import { test, expect } from '@playwright/test'

test.describe('Room Viewer Diagnostic', () => {
  test('diagnose compare bar sync issues', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    
    // Wait for section
    await page.waitForSelector('section.venue-room-viewer', { timeout: 10000 })
    
    // Click 舒適自在 pill
    const comfortPill = page.locator('button[role="tab"]').filter({ hasText: '舒適自在' })
    await comfortPill.click()
    await page.waitForTimeout(500)
    
    console.log('\n=== DIAGNOSTIC REPORT ===\n')
    
    // Step 1: Find --p variable and where it's defined
    const sectionEl = page.locator('section.venue-room-viewer')
    const pValue = await sectionEl.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--p')
    })
    console.log('1. CSS Variable --p on section:', pValue)
    
    // Get stage element
    const stage = page.locator('.stage').first()
    const stageP = await stage.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--p')
    })
    console.log('   Stage sees --p:', stageP)
    
    // Get divider handle
    const dividerHandle = page.locator('.divider-handle').first()
    const handleP = await dividerHandle.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--p')
    })
    console.log('   Divider handle sees --p:', handleP)
    
    // Get Eternity layer (clipped)
    const eternityLayer = page.locator('.compare-layer-eternity').first()
    const layerP = await eternityLayer.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('--p')
    })
    console.log('   Eternity layer sees --p:', layerP)
    
    // Get slider input
    const slider = page.locator('input[type="range"]').first()
    const sliderValue = await slider.evaluate((el: HTMLInputElement) => el.value)
    console.log('   Slider input value:', sliderValue)
    
    // Step 2: Positions and transforms
    console.log('\n2. Element positions and styles:')
    
    const stageBox = await stage.boundingBox()
    console.log(`   Stage box: x=${stageBox?.x}, y=${stageBox?.y}, width=${stageBox?.width}, height=${stageBox?.height}`)
    
    const handleBox = await dividerHandle.boundingBox()
    const handleStyles = await dividerHandle.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        left: style.left,
        transform: style.transform,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
      }
    })
    console.log(`   Handle box: x=${handleBox?.x}, y=${handleBox?.y}, width=${handleBox?.width}, height=${handleBox?.height}`)
    console.log('   Handle styles:', handleStyles)
    
    const eternityStyles = await eternityLayer.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return {
        clipPath: style.clipPath,
        webkitClipPath: style.webkitClipPath,
        zIndex: style.zIndex,
      }
    })
    console.log('   Eternity layer styles:', eternityStyles)
    
    // Calculate expected positions
    if (stageBox && handleBox) {
      const p = parseFloat(pValue.trim() || '50')
      const expectedClipX = stageBox.x + (p / 100) * stageBox.width
      const handleCenterX = handleBox.x + handleBox.width / 2
      const dividerX = stageBox.x + (p / 100) * stageBox.width
      
      console.log(`\n   Computed positions (p=${p}):`)
      console.log(`   Expected clip edge X: ${expectedClipX.toFixed(1)}`)
      console.log(`   Handle center X: ${handleCenterX.toFixed(1)}`)
      console.log(`   Expected divider X: ${dividerX.toFixed(1)}`)
      console.log(`   Difference (handle vs divider): ${Math.abs(handleCenterX - dividerX).toFixed(1)}px`)
    }
    
    // Step 3: Check for pointer event blockers
    console.log('\n3. Pointer event setup:')
    
    const stageEvents = await stage.evaluate((el) => {
      const hasPointerDown = el.getAttribute('onpointerdown') !== null || 
                            (el as any).onpointerdown !== undefined
      return {
        pointerEvents: window.getComputedStyle(el).pointerEvents,
        touchAction: window.getComputedStyle(el).touchAction,
        hasPointerDown,
      }
    })
    console.log('   Stage:', stageEvents)
    
    const handleEvents = await dividerHandle.evaluate((el) => {
      return {
        pointerEvents: window.getComputedStyle(el).pointerEvents,
        touchAction: window.getComputedStyle(el).touchAction,
      }
    })
    console.log('   Handle:', handleEvents)
    
    // Step 4: Slider implementation
    console.log('\n4. Slider implementation:')
    
    const sliderInfo = await slider.evaluate((el: HTMLInputElement) => {
      const thumb = el.parentElement?.querySelector('.slider-thumb') as HTMLElement
      return {
        type: el.type,
        min: el.min,
        max: el.max,
        step: el.step,
        value: el.value,
        thumbLeft: thumb ? window.getComputedStyle(thumb).left : 'N/A',
      }
    })
    console.log('   Slider:', sliderInfo)
    
    const trackBox = await page.locator('.slider-track').first().boundingBox()
    const thumbBox = await page.locator('.slider-thumb').first().boundingBox()
    
    if (trackBox && thumbBox) {
      const expectedThumbX = trackBox.x + (parseFloat(sliderValue) / 100) * trackBox.width
      const actualThumbCenterX = thumbBox.x + thumbBox.width / 2
      console.log(`   Track: x=${trackBox.x}, width=${trackBox.width}`)
      console.log(`   Thumb center: ${actualThumbCenterX.toFixed(1)} (expected: ${expectedThumbX.toFixed(1)})`)
      console.log(`   Difference: ${Math.abs(actualThumbCenterX - expectedThumbX).toFixed(1)}px`)
    }
    
    // Step 5: Room labels
    console.log('\n5. Room labels:')
    
    const leftLabel = page.locator('.room-label-infinity')
    const rightLabel = page.locator('.room-label-eternity')
    
    const leftLabelText = await leftLabel.locator('.room-label-english').textContent()
    const rightLabelText = await rightLabel.locator('.room-label-english').textContent()
    
    console.log(`   Left label: ${leftLabelText}`)
    console.log(`   Right label: ${rightLabelText}`)
    
    const leftBox = await leftLabel.boundingBox()
    const rightBox = await rightLabel.boundingBox()
    
    if (leftBox && rightBox && stageBox) {
      console.log(`   Left label X: ${leftBox.x.toFixed(1)} (stage left: ${stageBox.x.toFixed(1)})`)
      console.log(`   Right label X: ${rightBox.x.toFixed(1)} (stage right: ${(stageBox.x + stageBox.width).toFixed(1)})`)
    }
    
    // Check which image is on which side
    console.log('\n6. Image verification:')
    const infinityLayer = page.locator('.compare-layer-infinity img')
    const eternityLayerImg = page.locator('.compare-layer-eternity img')
    
    const infinitySrc = await infinityLayer.getAttribute('src')
    const eternitySrc = await eternityLayerImg.getAttribute('src')
    
    console.log(`   Bottom layer (Infinity): ${infinitySrc?.includes('infinity') ? '✓ CORRECT' : '✗ WRONG'} - ${infinitySrc?.split('/').pop()}`)
    console.log(`   Top layer (Eternity): ${eternitySrc?.includes('eternity') ? '✓ CORRECT' : '✗ WRONG'} - ${eternitySrc?.split('/').pop()}`)
    
    console.log('\n=== END DIAGNOSTIC ===\n')
    
    // Take screenshot
    await page.screenshot({ path: `test-results/diagnostic-${browserName}.png`, fullPage: false })
  })
})

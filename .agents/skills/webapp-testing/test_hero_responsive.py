#!/usr/bin/env python3
"""
Hero section responsive testing - captures screenshots at all target viewport sizes.
Tests: 320px (iPhone SE), 375/390/393/430px (iPhone range), 768px (iPad portrait),
1024px (iPad landscape), 1440px, 1920px, 2560px (desktop/ultrawide).
"""

from playwright.sync_api import sync_playwright
import os

# Target viewport sizes from the spec
VIEWPORTS = [
    (320, 568, "320px-iphone-se"),
    (375, 667, "375px-iphone-mini"),
    (390, 844, "390px-iphone-standard"),
    (393, 852, "393px-iphone-pro"),
    (430, 932, "430px-iphone-pro-max"),
    (768, 1024, "768px-ipad-portrait"),
    (1024, 768, "1024px-ipad-landscape"),
    (1440, 900, "1440px-desktop"),
    (1920, 1080, "1920px-large-desktop"),
    (2560, 1440, "2560px-ultrawide"),
]

def test_hero_responsive():
    output_dir = "hero-responsive-test"
    os.makedirs(output_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for width, height, label in VIEWPORTS:
            print(f"Testing {label} ({width}×{height})...")

            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # Wait for hero section to be visible
            page.wait_for_selector('[data-nav-theme="dark"]', timeout=5000)

            # Capture full hero section
            screenshot_path = f"{output_dir}/{label}.png"
            page.screenshot(path=screenshot_path, full_page=False)
            print(f"  ✓ Saved to {screenshot_path}")

            page.close()

        browser.close()

    print(f"\n✓ All {len(VIEWPORTS)} screenshots captured in {output_dir}/")

if __name__ == "__main__":
    test_hero_responsive()

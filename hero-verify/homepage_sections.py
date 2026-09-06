from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:3210/en"
VIEWPORTS = {
    "mobile": {"width": 375, "height": 812},
    "tablet": {"width": 768, "height": 900},
    "desktop": {"width": 1440, "height": 900},
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, viewport in VIEWPORTS.items():
        page = browser.new_page(viewport=viewport, device_scale_factor=1)
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"hero-verify/{name}-full.png", full_page=False)
        page.screenshot(path=f"hero-verify/{name}-page.png", full_page=True)
        section_names = page.locator("main > section").evaluate_all(
            "els => els.map(el => ({id: el.id, label: el.getAttribute('aria-label'), text: (el.innerText || '').slice(0, 80)}))"
        )
        hero = page.locator("main > section").first
        hero_state = hero.evaluate("el => ({height: el.getBoundingClientRect().height, opacity: getComputedStyle(el).opacity, display: getComputedStyle(el).display, text: el.innerText.slice(0, 120)})")
        pilot_count = page.locator('[data-cms-key^="spacePilot"]').count()
        old_s4_count = page.locator('[data-cms-key^="section4.table-transition"]').count()
        print(name, {"hero": hero_state, "spacePilotNodes": pilot_count, "oldSection4Nodes": old_s4_count, "sections": section_names[:10]})
        page.close()
    browser.close()

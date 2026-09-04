"""Hero viewport verification — screenshots at the required matrix of viewports."""
from playwright.sync_api import sync_playwright
from pathlib import Path
from datetime import datetime
import os

URL = "http://localhost:3099/zh-HK"
OUT = Path("hero-verify")
OUT.mkdir(exist_ok=True)

VIEWPORTS = [
    ("desktop-1920x1080", 1920, 1080),
    ("laptop-1366x768", 1366, 768),
    ("ipad-landscape", 1194, 834),
    ("ipad-portrait", 834, 1194),
    ("mobile-390x844", 390, 844),
]

def main():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, w, h in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
            page = ctx.new_page()
            page.goto(URL, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            path = OUT / f"{ts}-{name}.png"
            page.screenshot(path=str(path), full_page=False)
            print(f"  ✓ {name}: {path}")
            ctx.close()
        browser.close()
    print(f"All screenshots saved to {OUT}/")

if __name__ == "__main__":
    main()

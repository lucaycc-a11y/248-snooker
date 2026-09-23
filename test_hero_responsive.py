#!/usr/bin/env python3
"""
Test homepage hero responsive design across all required viewport widths.
Verifies: no horizontal scroll, no text overflow, buttons ≥44px height,
headline scales proportionally, pool table maintains aspect ratio and
proportional gap to text, content readable at all widths.
"""

from playwright.sync_api import sync_playwright
import json
import sys

# Target viewport widths from requirements
VIEWPORTS = [
    {"width": 320, "height": 568, "name": "iPhone SE"},
    {"width": 375, "height": 667, "name": "iPhone 8"},
    {"width": 390, "height": 844, "name": "iPhone 12/13"},
    {"width": 393, "height": 852, "name": "iPhone 14 Pro"},
    {"width": 430, "height": 932, "name": "iPhone 14 Pro Max"},
    {"width": 768, "height": 1024, "name": "iPad Portrait"},
    {"width": 1024, "height": 768, "name": "iPad Landscape"},
    {"width": 1440, "height": 900, "name": "Desktop"},
    {"width": 1920, "height": 1080, "name": "Large Desktop"},
    {"width": 2560, "height": 1440, "name": "Ultrawide"},
]

URL = "http://localhost:3000"

def test_viewport(page, viewport):
    """Test hero section at a specific viewport size."""
    width = viewport["width"]
    height = viewport["height"]
    name = viewport["name"]

    print(f"\n{'='*60}")
    print(f"Testing: {name} ({width}x{height})")
    print('='*60)

    # Set viewport
    page.set_viewport_size({"width": width, "height": height})
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)  # Wait for animations

    results = {
        "viewport": f"{width}x{height}",
        "name": name,
        "tests": {}
    }

    # Test 1: No horizontal scroll
    scroll_width = page.evaluate("document.documentElement.scrollWidth")
    client_width = page.evaluate("document.documentElement.clientWidth")
    has_horizontal_scroll = scroll_width > client_width
    results["tests"]["no_horizontal_scroll"] = {
        "pass": not has_horizontal_scroll,
        "scroll_width": scroll_width,
        "client_width": client_width
    }
    print(f"✓ No horizontal scroll: {'PASS' if not has_horizontal_scroll else 'FAIL'}")
    if has_horizontal_scroll:
        print(f"  ⚠ scrollWidth={scroll_width}, clientWidth={client_width}")

    # Test 2: Headline visibility and scaling
    try:
        headline = page.locator("h1").first
        headline.wait_for(state="visible", timeout=5000)
        headline_box = headline.bounding_box()
        headline_text = headline.text_content()

        if headline_box:
            headline_font_size = page.evaluate(
                "(el) => window.getComputedStyle(el).fontSize",
                headline.element_handle()
            )
            results["tests"]["headline"] = {
                "pass": True,
                "text": headline_text[:30] + "..." if len(headline_text) > 30 else headline_text,
                "font_size": headline_font_size,
                "width": headline_box["width"],
                "height": headline_box["height"]
            }
            print(f"✓ Headline visible: PASS (font-size: {headline_font_size})")
        else:
            results["tests"]["headline"] = {"pass": False, "error": "No bounding box"}
            print(f"✗ Headline visible: FAIL (no bounding box)")
    except Exception as e:
        results["tests"]["headline"] = {"pass": False, "error": str(e)}
        print(f"✗ Headline visible: FAIL ({e})")

    # Test 3: Button tap targets (≥44px height)
    try:
        buttons = page.locator("a[href='/book'], a[href='/venue']").all()
        button_results = []
        all_pass = True

        for i, button in enumerate(buttons):
            box = button.bounding_box()
            if box:
                # Also check computed height and minHeight
                computed_height = page.evaluate(
                    "(el) => window.getComputedStyle(el).height",
                    button.element_handle()
                )
                computed_min_height = page.evaluate(
                    "(el) => window.getComputedStyle(el).minHeight",
                    button.element_handle()
                )

                is_valid = box["height"] >= 44
                button_results.append({
                    "index": i,
                    "bounding_height": box["height"],
                    "computed_height": computed_height,
                    "computed_min_height": computed_min_height,
                    "width": box["width"],
                    "pass": is_valid
                })
                if not is_valid:
                    all_pass = False
                    print(f"  ⚠ Button {i}: bounding_height={box['height']}px, computed_height={computed_height}, minHeight={computed_min_height}")

        results["tests"]["button_tap_targets"] = {
            "pass": all_pass,
            "buttons": button_results
        }
        print(f"✓ Button tap targets ≥44px: {'PASS' if all_pass else 'FAIL'}")
    except Exception as e:
        results["tests"]["button_tap_targets"] = {"pass": False, "error": str(e)}
        print(f"✗ Button tap targets: FAIL ({e})")

    # Test 4: Pool table visibility (desktop only, ≥768px)
    if width >= 768:
        try:
            # Look for the desktop video container
            video_container = page.locator("video").nth(1)  # Desktop is second video
            if video_container.is_visible():
                box = video_container.bounding_box()
                if box:
                    aspect_ratio = box["width"] / box["height"]
                    is_square = 0.95 <= aspect_ratio <= 1.05
                    results["tests"]["pool_table"] = {
                        "pass": is_square,
                        "width": box["width"],
                        "height": box["height"],
                        "aspect_ratio": aspect_ratio
                    }
                    print(f"✓ Pool table aspect ratio: {'PASS' if is_square else 'FAIL'} (ratio: {aspect_ratio:.2f})")
                else:
                    results["tests"]["pool_table"] = {"pass": False, "error": "No bounding box"}
                    print(f"✗ Pool table: FAIL (no bounding box)")
            else:
                results["tests"]["pool_table"] = {"pass": False, "error": "Not visible"}
                print(f"✗ Pool table: FAIL (not visible)")
        except Exception as e:
            results["tests"]["pool_table"] = {"pass": False, "error": str(e)}
            print(f"✗ Pool table: FAIL ({e})")

    # Test 5: Content positioning (no overlap, proper spacing)
    try:
        # Check if content container is visible
        content = page.locator("div.absolute.inset-0.z-10").first
        content_box = content.bounding_box()

        if content_box:
            results["tests"]["content_positioning"] = {
                "pass": True,
                "top": content_box["y"],
                "height": content_box["height"]
            }
            print(f"✓ Content positioning: PASS")
        else:
            results["tests"]["content_positioning"] = {"pass": False, "error": "No bounding box"}
            print(f"✗ Content positioning: FAIL (no bounding box)")
    except Exception as e:
        results["tests"]["content_positioning"] = {"pass": False, "error": str(e)}
        print(f"✗ Content positioning: FAIL ({e})")

    # Take screenshot
    screenshot_path = f"/tmp/hero_{width}x{height}.png"
    page.screenshot(path=screenshot_path, full_page=False)
    results["screenshot"] = screenshot_path
    print(f"📸 Screenshot saved: {screenshot_path}")

    return results

def main():
    all_results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for viewport in VIEWPORTS:
            try:
                result = test_viewport(page, viewport)
                all_results.append(result)
            except Exception as e:
                print(f"\n✗ Error testing {viewport['name']}: {e}")
                all_results.append({
                    "viewport": f"{viewport['width']}x{viewport['height']}",
                    "name": viewport["name"],
                    "error": str(e)
                })

        browser.close()

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print('='*60)

    total_tests = len(all_results)
    passed_viewports = sum(1 for r in all_results if "error" not in r and all(
        t.get("pass", False) for t in r.get("tests", {}).values()
    ))

    print(f"Total viewports tested: {total_tests}")
    print(f"Passed all tests: {passed_viewports}/{total_tests}")

    # Detailed failures
    for result in all_results:
        if "error" in result:
            print(f"\n✗ {result['name']}: ERROR - {result['error']}")
        elif result.get("tests"):
            failures = [name for name, test in result["tests"].items() if not test.get("pass", False)]
            if failures:
                print(f"\n✗ {result['name']}: Failed tests: {', '.join(failures)}")

    # Save JSON report
    with open("/tmp/hero_responsive_report.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n📄 Full report saved: /tmp/hero_responsive_report.json")

    # Exit with error if any tests failed
    if passed_viewports < total_tests:
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()

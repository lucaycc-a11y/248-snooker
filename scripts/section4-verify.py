"""
Section 4 — Post-fix verification scroll recording.
Tests CSS sticky approach (replaced GSAP pin).
Scrolls through 5 positions, captures progress/opacity/screenshots.
"""
from playwright.sync_api import sync_playwright
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.goto("http://localhost:3000/zh-HK", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6000)
        page.evaluate("document.documentElement.style.scrollBehavior = 'auto'")
        page.wait_for_timeout(100)

        def scroll_to(y):
            page.evaluate("""(y) => {
                window.scrollTo(0, y);
                window.dispatchEvent(new Event('scroll'));
            }""", y)
            page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            page.wait_for_timeout(400)

        # Find Section 4 — CSS sticky approach, no pin-spacer
        stage_top = page.evaluate("""() => {
            const el = document.querySelector('[data-cms-key="section4.table-transition"]');
            if (!el) return null;
            return el.getBoundingClientRect().top + window.scrollY;
        }""")
        if stage_top is None:
            print("ERROR: Section 4 not found")
            browser.close()
            return

        print(f"Stage top (scroll position): {stage_top}")

        # Get stage height
        stage_height = page.evaluate("""() => {
            const el = document.querySelector('[data-cms-key="section4.table-transition"]');
            return el ? el.getBoundingClientRect().height : 0;
        }""")
        print(f"Stage height: {stage_height}px")

        vh = 800

        # 5 scroll positions through the stage
        positions = [
            ("start", stage_top, "Table 1 visible, no animation"),
            ("p10", stage_top + 0.10 * stage_height, "Mask1 fading in, scale ~18x"),
            ("p20", stage_top + 0.20 * stage_height, "Mask1 scale ~1x (zoomed in)"),
            ("p40", stage_top + 0.40 * stage_height, "Gradient text center"),
            ("p70", stage_top + 0.70 * stage_height, "Mask2 scaling out"),
            ("p95", stage_top + 0.95 * stage_height, "Table 2 fading in"),
        ]

        screenshots = []
        for label, y, desc in positions:
            scroll_to(y)
            page.wait_for_timeout(200)

            data = page.evaluate("""() => {
                const stage = document.querySelector('[data-cms-key="section4.table-transition"]');
                if (!stage) return { error: 'stage not found' };

                const pin = stage.querySelector('.s4-pin');
                const pinCS = pin ? getComputedStyle(pin) : null;

                // Check if sticky is working
                const stickyTop = pinCS ? pinCS.position + ' / top=' + pinCS.top : 'N/A';

                // Get all animation layers
                const table1 = stage.querySelector('[style*="Space_Infinity"][class*="bg-cover"]');
                const table2 = stage.querySelector('[style*="Space_Enternity"][class*="bg-cover"]');
                const mask1 = stage.querySelector('[data-cms-key="section4.space-infinity"]');
                const mask2 = stage.querySelector('[data-cms-key="section4.space-eternity-mask"]');
                const infinity = stage.querySelector('[data-cms-key="section4.space-infinity-gradient"]');
                const orText = stage.querySelector('[data-cms-key="section4.or-text"]');
                const eternity = stage.querySelector('[data-cms-key="section4.space-eternity"]');

                function getInfo(el) {
                    if (!el) return null;
                    const cs = getComputedStyle(el);
                    return {
                        opacity: parseFloat(cs.opacity),
                        inlineOpacity: el.style.opacity || '(none)',
                        transform: cs.transform,
                        visibility: cs.visibility,
                        display: cs.display,
                    };
                }

                return {
                    scrollY: Math.round(window.scrollY),
                    stickyPosition: stickyTop,
                    pinInViewport: pin ? (pin.getBoundingClientRect().top >= -1 && pin.getBoundingClientRect().top <= 1) : false,
                    layers: {
                        table1: getInfo(table1),
                        table2: getInfo(table2),
                        mask1: getInfo(mask1),
                        mask2: getInfo(mask2),
                        infinity: getInfo(infinity),
                        orText: getInfo(orText),
                        eternity: getInfo(eternity),
                    },
                };
            }""")

            print(f"\n--- {label} (scrollY={data.get('scrollY', '?')}) ---")
            print(f"  Sticky: {data.get('stickyPosition', 'N/A')}")
            print(f"  Pin in viewport: {data.get('pinInViewport', 'N/A')}")
            print(f"  Description: {desc}")

            for name, layer in data.get('layers', {}).items():
                if layer:
                    print(f"  {name}: opacity={layer['opacity']:.3f} inline={layer['inlineOpacity']} transform={layer['transform'][:50] if layer['transform'] else 'none'}")

            path = f"/tmp/s4-verify-{label}.png"
            page.screenshot(path=path)
            screenshots.append(path)

        # ScrollTrigger check
        st_info = page.evaluate("""() => {
            try {
                const st = typeof ScrollTrigger !== 'undefined' ? ScrollTrigger.getAll() : [];
                return st.map(t => ({
                    trigger: t.trigger ? t.trigger.tagName + '#' + (t.trigger.id || '') : null,
                    start: t.start,
                    end: t.end,
                    progress: t.progress,
                    pin: !!t.pin,
                    pinSpacers: t.pinSpacers ? t.pinSpacers.length : 0,
                }));
            } catch(e) {
                return [{ error: String(e) }];
            }
        }""")
        print(f"\n=== ScrollTrigger instances: {len(st_info)} ===")
        for t in st_info:
            print(json.dumps(t))

        # Verify no pin-spacer (CSS sticky, no GSAP pin)
        pin_spacer_count = page.evaluate("""() => document.querySelectorAll('.pin-spacer').length""")
        print(f"\nPin-spacer count: {pin_spacer_count} (should be 0 for CSS sticky)")

        print(f"\nScreenshots: {screenshots}")
        browser.close()

run()

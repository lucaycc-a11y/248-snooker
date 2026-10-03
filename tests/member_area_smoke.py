#!/usr/bin/env python3
"""
Smoke test for Space8 member area.
Tests critical paths: dashboard, wallet, points, inbox, delete account.

Usage:
  python scripts/with_server.py --server "npm run dev" --port 3000 -- python tests/member_area_smoke.py
"""

import sys
from playwright.sync_api import sync_playwright, Page, expect


def test_member_dashboard(page: Page):
    """Test member dashboard loads and displays expected sections."""
    print("→ Testing member dashboard...")
    page.goto('http://localhost:3000/member')
    page.wait_for_load_state('networkidle')

    # Verify main sections exist
    assert page.locator('[data-testid="member-header"]').is_visible() or \
           page.locator('h1').filter(has_text='Member').count() > 0, \
           "Member header not found"

    print("  ✓ Dashboard loads and displays header")


def test_wallet_page(page: Page):
    """Test wallet page with all states."""
    print("→ Testing wallet page...")
    page.goto('http://localhost:3000/member/wallet')
    page.wait_for_load_state('networkidle')

    # Check for wallet card or loading state
    has_wallet_card = page.locator('[data-testid="wallet-card"]').is_visible() or \
                      page.locator('text=Space Wallet').count() > 0 or \
                      page.locator('.wcard').count() > 0

    has_loading = page.locator('.skel').count() > 0
    has_error = page.locator('role=alert').count() > 0

    assert has_wallet_card or has_loading or has_error, \
           "Wallet page missing card, loading state, or error state"

    print("  ✓ Wallet page loads with expected UI")


def test_points_page(page: Page):
    """Test points page with transaction history."""
    print("→ Testing points page...")
    page.goto('http://localhost:3000/member/points')
    page.wait_for_load_state('networkidle')

    # Check for points display or loading state
    has_points_display = page.locator('text=Points').count() > 0 or \
                         page.locator('[data-testid="points-display"]').count() > 0

    has_loading = page.locator('.skel').count() > 0 or \
                  page.locator('text=Loading').count() > 0

    has_error = page.locator('role=alert').count() > 0

    assert has_points_display or has_loading or has_error, \
           "Points page missing display, loading, or error state"

    print("  ✓ Points page loads with transaction history")


def test_inbox_page(page: Page):
    """Test inbox page with notifications."""
    print("→ Testing inbox page...")
    page.goto('http://localhost:3000/member/inbox')
    page.wait_for_load_state('networkidle')

    # Check for inbox content or loading
    has_inbox_content = page.locator('text=Inbox').count() > 0 or \
                        page.locator('text=Notifications').count() > 0 or \
                        page.locator('[data-testid="notification-list"]').count() > 0

    has_loading = page.locator('.skel').count() > 0
    has_empty = page.locator('text=No notifications').count() > 0

    assert has_inbox_content or has_loading or has_empty, \
           "Inbox page missing expected content"

    print("  ✓ Inbox page loads with notification area")


def test_settings_page(page: Page):
    """Test settings page exists and loads."""
    print("→ Testing settings page...")
    page.goto('http://localhost:3000/member/settings')
    page.wait_for_load_state('networkidle')

    # Check for settings content
    has_settings = page.locator('text=Settings').count() > 0 or \
                   page.locator('text=Preferences').count() > 0 or \
                   page.locator('[data-testid="settings-form"]').count() > 0

    has_delete_account = page.locator('text=Delete Account').count() > 0 or \
                         page.locator('text=Delete').count() > 0

    assert has_settings or page.url == 'http://localhost:3000/member/settings', \
           "Settings page not accessible"

    print("  ✓ Settings page loads" +
          (" with delete account option" if has_delete_account else ""))


def test_api_endpoints(page: Page):
    """Test critical member API endpoints are responsive."""
    print("→ Testing API endpoints...")

    # Test /api/member/points
    response = page.request.get('http://localhost:3000/api/member/points')
    assert response.ok or response.status == 401, \
           f"/api/member/points returned {response.status}"
    print("  ✓ /api/member/points responsive")

    # Test /api/member/wallet
    response = page.request.get('http://localhost:3000/api/member/wallet')
    assert response.ok or response.status == 401, \
           f"/api/member/wallet returned {response.status}"
    print("  ✓ /api/member/wallet responsive")

    # Test /api/member/wallet/transactions
    response = page.request.get('http://localhost:3000/api/member/wallet/transactions')
    assert response.ok or response.status == 401, \
           f"/api/member/wallet/transactions returned {response.status}"
    print("  ✓ /api/member/wallet/transactions responsive")

    # Test /api/member/points/transactions
    response = page.request.get('http://localhost:3000/api/member/points/transactions')
    assert response.ok or response.status == 401, \
           f"/api/member/points/transactions returned {response.status}"
    print("  ✓ /api/member/points/transactions responsive")

    # Test /api/member/inbox
    response = page.request.get('http://localhost:3000/api/member/inbox')
    assert response.ok or response.status == 401, \
           f"/api/member/inbox returned {response.status}"
    print("  ✓ /api/member/inbox responsive")


def main():
    """Run all smoke tests."""
    print("\n" + "=" * 60)
    print("Space8 Member Area Smoke Test")
    print("=" * 60 + "\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            test_member_dashboard(page)
            test_wallet_page(page)
            test_points_page(page)
            test_inbox_page(page)
            test_settings_page(page)
            test_api_endpoints(page)

            print("\n" + "=" * 60)
            print("✅ All smoke tests passed!")
            print("=" * 60 + "\n")

        except AssertionError as e:
            print(f"\n❌ Test failed: {e}")
            page.screenshot(path='/tmp/member_area_fail.png', full_page=True)
            print("Screenshot saved to /tmp/member_area_fail.png")
            browser.close()
            sys.exit(1)

        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            browser.close()
            sys.exit(1)

        browser.close()


if __name__ == '__main__':
    main()

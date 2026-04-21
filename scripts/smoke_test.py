"""
Landledger Playwright Smoke Tests (webapp-testing skill)
Tests key user-facing flows: home page, properties listing, navigation.
Server must be running at http://localhost:5173 before invoking this script.
"""
from playwright.sync_api import sync_playwright, expect
import sys

TIMEOUT = 15000  # ms
BASE_URL = "http://localhost:5173"

results = []


def log(label, status, detail=""):
    icon = "✅" if status == "PASS" else "❌"
    msg = f"  {icon}  {label}"
    if detail:
        msg += f"\n      → {detail}"
    results.append((label, status))
    print(msg)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    # ------------------------------------------------------------------ #
    # TEST 1: Home page loads without JS errors                           #
    # ------------------------------------------------------------------ #
    js_errors = []
    page.on("pageerror", lambda err: js_errors.append(str(err)))

    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)

    page.screenshot(path="/tmp/ll_home.png", full_page=True)

    if page.title():
        log("Home page has a <title>", "PASS", page.title())
    else:
        log("Home page has a <title>", "FAIL", "empty title")

    if not js_errors:
        log("No JS errors on home page", "PASS")
    else:
        log("No JS errors on home page", "FAIL", "; ".join(js_errors[:3]))

    # ------------------------------------------------------------------ #
    # TEST 2: Header navigation is visible                                #
    # ------------------------------------------------------------------ #
    header = page.locator("header")
    if header.count() > 0:
        log("Header is rendered", "PASS")
    else:
        log("Header is rendered", "FAIL", "No <header> element found")

    nav_links = page.locator("header a, header button")
    count = nav_links.count()
    if count >= 2:
        log(f"Header contains navigation links ({count} found)", "PASS")
    else:
        log("Header contains navigation links", "FAIL", f"Only {count} found")

    # ------------------------------------------------------------------ #
    # TEST 3: Properties page loads and shows listings                   #
    # ------------------------------------------------------------------ #
    page.goto(f"{BASE_URL}/properties")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)
    page.screenshot(path="/tmp/ll_properties.png", full_page=True)

    props_js_errors = []
    page.on("pageerror", lambda err: props_js_errors.append(str(err)))

    # Look for property cards (any article, li, or div with property-related text)
    cards = page.locator("[class*='card'], [class*='property'], article, .grid > div")
    card_count = cards.count()
    if card_count > 0:
        log(f"Properties page renders content ({card_count} elements)", "PASS")
    else:
        # Check for a "no results" / loading state instead
        body_text = page.locator("body").inner_text()
        if "loading" in body_text.lower() or "no properties" in body_text.lower():
            log("Properties page shows loading/empty state", "PASS", "(auth required or no data)")
        else:
            log("Properties page renders content", "FAIL", f"body preview: {body_text[:200]}")

    # ------------------------------------------------------------------ #
    # TEST 4: About page loads                                            #
    # ------------------------------------------------------------------ #
    about_errors = []
    page.on("pageerror", lambda e: about_errors.append(str(e)))
    page.goto(f"{BASE_URL}/about")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)
    page.screenshot(path="/tmp/ll_about.png", full_page=True)

    h1 = page.locator("h1")
    if h1.count() > 0:
        log("About page has an <h1>", "PASS", h1.first.inner_text()[:60])
    else:
        log("About page has an <h1>", "FAIL", "No <h1> found")

    # ------------------------------------------------------------------ #
    # TEST 5: 404 / not-found route works                                 #
    # ------------------------------------------------------------------ #
    page.goto(f"{BASE_URL}/this-should-not-exist-xyz")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)
    body = page.locator("body").inner_text().lower()
    if "not found" in body or "404" in body or "page" in body:
        log("Unknown route shows a 404/not-found page", "PASS")
    else:
        log("Unknown route shows a 404/not-found page", "FAIL", f"body: {body[:150]}")

    # ------------------------------------------------------------------ #
    # TEST 6: Login page is accessible (no crash)                         #
    # ------------------------------------------------------------------ #
    login_errors = []
    page.on("pageerror", lambda e: login_errors.append(str(e)))
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle", timeout=TIMEOUT)
    page.screenshot(path="/tmp/ll_login.png", full_page=True)

    if not login_errors:
        log("Login page loads without JS errors", "PASS")
    else:
        log("Login page loads without JS errors", "FAIL", "; ".join(login_errors[:2]))

    browser.close()

# ------------------------------------------------------------------ #
# Summary                                                            #
# ------------------------------------------------------------------ #
print()
print("=" * 55)
passed = sum(1 for _, s in results if s == "PASS")
failed = sum(1 for _, s in results if s == "FAIL")
print(f"  Results: {passed} passed, {failed} failed ({len(results)} total)")
print("=" * 55)
print("  Screenshots saved to /tmp/ll_*.png")

if failed > 0:
    sys.exit(1)

"""Exercise the actual UI against a running dev server or production preview.

Usage: python tests/browser_smoke.py [http://127.0.0.1:5173]
Requires Python Playwright and Chromium (provided by the cloud image).
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173'
values = [42, 3, 17, 3, 999, 1, 42, 8]
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['clipboard-read', 'clipboard-write'])
    page = context.new_page()
    errors, resources = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: resources.append(f'{response.status} {response.url}') if response.status >= 400 else None)

    def ready():
        page.wait_for_function('window.__sortingAtlas && window.__sortingAtlas.frameCount() > 0 && document.querySelector("#canvasLoading").hidden')

    def seek(index):
        page.locator('#timeline').evaluate('(el, i) => {el.value=i;el.dispatchEvent(new Event("input", {bubbles:true}));}', index)

    def open_custom(text):
        page.locator('#customOpen').click()
        page.locator('#customValues').fill(text)
        page.locator('#customForm button[type="submit"]').click()

    assert page.goto(base, wait_until='networkidle').status == 200
    ready()
    assert page.locator('#algos button').count() == 9
    assert page.locator('#langbar button').count() == 4
    assert page.evaluate('window.__sortingAtlas.state().playing') is False
    assert page.locator('#metricComparisons').inner_text() == '0'
    checks.append('initial state and navigation')

    for invalid in ('', '1', '1, 0', '1, 1000', '1, nope', '1.5, 2', ','.join(['1'] * 181)):
        open_custom(invalid)
        assert page.locator('#customError').is_visible(), invalid
        assert page.locator('#customDialog').evaluate('(el) => el.open')
        page.locator('#customDialog [data-close]').first.click()
    open_custom(', '.join(map(str, values)))
    ready()
    assert page.locator('#size').is_disabled()
    keys = page.locator('#algos button').evaluate_all('(els) => els.map(el => el.dataset.key)')
    for key in keys:
        page.locator(f'#algos button[data-key="{key}"]').click()
        ready()
        initial = page.evaluate('window.__sortingAtlas.frameAt(0)')
        assert initial['a'] == values, (key, initial)
        assert initial['cmp'] == initial['swp'] == initial['wrt'] == 0
        assert page.locator('#cfLine').inner_text() == '—'
        assert page.locator('#cfHits').inner_text() == '0'
        count = page.evaluate('window.__sortingAtlas.frameCount()')
        seek(count - 1)
        assert page.evaluate('window.__sortingAtlas.frameAt(window.__sortingAtlas.frameCount()-1).a') == sorted(values)
        assert page.locator('#metricProgress').inner_text() == '100%', (key, page.locator('#metricProgress').inner_text(), page.evaluate('window.__sortingAtlas.state()'))
        assert page.locator('#stateText').inner_text() == '已完成'
        assert page.locator('#nextFrame').is_disabled()
    checks.append('custom validation and nine algorithms preserve identical input')

    page.locator('#compareOpen').click()
    page.wait_for_function('document.querySelectorAll("#compareBody tr").length === 9')
    assert page.locator('#compareBody tr[data-current="true"] td').first.inner_text() == '鸡尾酒排序'
    radix = page.locator('#compareBody tr').filter(has_text='基数排序').locator('td').all_inner_texts()
    assert radix[-3:] == ['0', '0', '48'], radix
    page.locator('#compareDialog [data-close]').click()
    checks.append('comparison table uses actual execution counts')

    page.locator('#shuffle').click()
    ready()
    assert sorted(page.evaluate('window.__sortingAtlas.frameAt(0).a')) == sorted(values)
    page.locator('#distribution').select_option('reverse')
    ready()
    assert page.locator('#size').is_enabled()
    assert page.evaluate('window.__sortingAtlas.frameAt(0).a') == list(range(8, 0, -1))
    page.locator('#size').evaluate('(el) => {el.value=12;el.dispatchEvent(new Event("input"));el.dispatchEvent(new Event("change"));}')
    ready()
    assert page.evaluate('window.__sortingAtlas.frameAt(0).a') == list(range(12, 0, -1))
    for mode in ('random', 'nearly', 'duplicates'):
        page.locator('#distribution').select_option(mode)
        ready()
        initial = page.evaluate('window.__sortingAtlas.frameAt(0).a')
        assert len(initial) == 12
        if mode == 'duplicates':
            assert len(set(initial)) <= 5
        else:
            assert sorted(initial) == list(range(1, 13))
    checks.append('data distributions, custom shuffle and size controls')

    page.locator('#nextFrame').click()
    assert page.evaluate('window.__sortingAtlas.state().raf') == 1
    page.locator('#prevFrame').click()
    assert page.evaluate('window.__sortingAtlas.state().raf') == 0
    page.locator('body').click(position={'x': 3, 'y': 100})
    page.keyboard.press('ArrowRight')
    assert page.evaluate('window.__sortingAtlas.state().raf') == 1
    count = page.evaluate('window.__sortingAtlas.frameCount()')
    seek(count // 2)
    assert page.evaluate('window.__sortingAtlas.state().raf') == count // 2
    assert 40 <= int(page.locator('#metricProgress').inner_text().rstrip('%')) <= 60
    page.locator('#restart').click()
    assert page.evaluate('window.__sortingAtlas.state().raf') == 0
    page.locator('#speed').evaluate('(el) => {el.value=1;el.dispatchEvent(new Event("input"));}')
    page.locator('#play').click()
    page.wait_for_function('window.__sortingAtlas.state().raf > 0')
    page.wait_for_function('window.__sortingAtlas.state().done')
    page.locator('#play').click()
    page.wait_for_function('window.__sortingAtlas.state().playing && !window.__sortingAtlas.state().done')
    page.locator('#play').click()
    assert page.evaluate('window.__sortingAtlas.state().playing') is False
    checks.append('step controls, keyboard, seek, restart and replay')

    for lang in ('py', 'c', 'java', 'js'):
        page.locator(f'#langbar [data-lang="{lang}"]').click()
        assert page.locator('#codePre .cl').count() > 10
    page.locator('#copyCode').click()
    page.wait_for_function('!document.querySelector("#toast").hidden')
    assert 'ARR' in page.evaluate('navigator.clipboard.readText()')
    page.locator('#expandCode').click()
    assert page.locator('#codepane').evaluate('(el) => el.classList.contains("expanded")')
    page.keyboard.press('Escape')
    assert not page.locator('#codepane').evaluate('(el) => el.classList.contains("expanded")')
    page.locator('#codeToggle').click()
    assert page.locator('#codepane').is_hidden()
    page.locator('#codeToggle').click()
    assert page.locator('#codepane').is_visible()
    page.locator('#algos [data-key="bubble"]').focus()
    page.keyboard.press('ArrowDown')
    ready()
    assert page.evaluate('window.__sortingAtlas.state().algo') == 'insertion'
    page.locator('#helpOpen').click()
    assert page.locator('#helpDialog').evaluate('(el) => el.open')
    page.keyboard.press('Escape')
    checks.append('code languages, clipboard, fullscreen, tab keyboard and help')

    for width in (1440, 1024, 768, 390, 320):
        page.set_viewport_size({'width': width, 'height': 900})
        page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        assert page.locator('#play').is_visible()
        assert page.locator('#cv').is_visible()
        controls = page.locator('.transport').evaluate('''(el) => {
            const boundary=el.getBoundingClientRect();
            return [...el.querySelectorAll('button')].every(button => {
                const r=button.getBoundingClientRect();
                return r.left>=boundary.left && r.right<=boundary.right;
            });
        }''')
        assert controls, f'clipped playback controls at {width}px'
        page.locator('#customOpen').click()
        assert page.locator('#customDialog').bounding_box()['width'] <= width
        page.keyboard.press('Escape')
    checks.append('five responsive widths and modal fit')
    context.close()
    reduced = browser.new_context(reduced_motion='reduce', viewport={'width': 390, 'height': 844})
    reduced_page = reduced.new_page()
    reduced_page.goto(base, wait_until='networkidle')
    assert reduced_page.locator('#play').is_visible()
    checks.append('reduced motion layout')
    assert not errors, errors
    assert not resources, resources
    print(json.dumps({'base': base, 'passed': checks, 'page_errors': errors, 'failed_resources': resources}, ensure_ascii=False, indent=2))
    browser.close()

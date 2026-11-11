"""Push the Demli Okey store listing (docs/store/listing-i18n.json) to App Store Connect.

Run from PowerShell (the Bash sandbox has no DNS):  python app/scripts/asc-listing.py
Idempotent: creates missing localizations, PATCHes existing ones, then reads every value back.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt

APP_ID = '6828189291'
KEY = r'C:\Users\mfaru\API_KEYS\Apple App Manager\AuthKey_8A9NPVKUG3.p8'
PRIVACY = 'https://lightsoldiergames.com/okey101/gizlilik'
SUPPORT = 'https://lightsoldiergames.com/destek'
MARKETING = 'https://lightsoldiergames.com'
COPYRIGHT = '2026 Light Soldier Games'
HERE = os.path.dirname(os.path.abspath(__file__))
LISTING = json.load(open(os.path.join(HERE, '..', '..', 'docs', 'store', 'listing-i18n.json'), encoding='utf-8'))
LOCALES = [k for k in LISTING if not k.startswith('_')]

_tok = [None, 0]


def token():
    if time.time() > _tok[1] - 60:
        now = int(time.time())
        _tok[0] = jwt.encode({'iss': '824671a4-c87f-4324-b2dd-952f240aac00', 'iat': now, 'exp': now + 1100,
                              'aud': 'appstoreconnect-v1'}, open(KEY).read(), algorithm='ES256',
                             headers={'kid': '8A9NPVKUG3'})
        _tok[1] = now + 1100
    return _tok[0]


def call(method, path, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode('utf-8', 'replace')
        raise RuntimeError(f'{method} {path} -> {e.code}: {msg[:600]}')


def main():
    app = call('GET', f'/v1/apps/{APP_ID}')['data']
    print('app primaryLocale:', app['attributes']['primaryLocale'])
    info = call('GET', f'/v1/apps/{APP_ID}/appInfos')['data'][0]
    version = [v for v in call('GET', f'/v1/apps/{APP_ID}/appStoreVersions')['data']
               if v['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'][0]

    # 1) App-level localizations (name, subtitle, privacy URL).
    have = {l['attributes']['locale']: l for l in call('GET', f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")['data']}
    for loc in LOCALES:
        t = LISTING[loc]
        attrs = {'name': t['name'], 'subtitle': t['subtitle'], 'privacyPolicyUrl': PRIVACY}
        if loc in have:
            call('PATCH', f"/v1/appInfoLocalizations/{have[loc]['id']}",
                 {'data': {'type': 'appInfoLocalizations', 'id': have[loc]['id'], 'attributes': attrs}})
        else:
            call('POST', '/v1/appInfoLocalizations',
                 {'data': {'type': 'appInfoLocalizations', 'attributes': {'locale': loc, **attrs},
                           'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': info['id']}}}}})
        print('appInfo', loc, 'ok')

    # 2) Primary language English (U.S.).
    if app['attributes']['primaryLocale'] != 'en-US':
        call('PATCH', f'/v1/apps/{APP_ID}', {'data': {'type': 'apps', 'id': APP_ID, 'attributes': {'primaryLocale': 'en-US'}}})
        print('primaryLocale -> en-US')

    # 3) Categories: Games > Board, Card.
    try:
        call('PATCH', f"/v1/appInfos/{info['id']}", {'data': {'type': 'appInfos', 'id': info['id'], 'relationships': {
            'primaryCategory': {'data': {'type': 'appCategories', 'id': 'GAMES'}},
            'primarySubcategoryOne': {'data': {'type': 'appCategories', 'id': 'GAMES_BOARD'}},
            'primarySubcategoryTwo': {'data': {'type': 'appCategories', 'id': 'GAMES_CARD'}}}}})
        print('categories ok')
    except RuntimeError as e:
        print('categories FAILED', e)

    # 4) Version localizations (auto-created with the appInfo ones: PATCH, POST only if missing).
    vhave = {l['attributes']['locale']: l for l in
             call('GET', f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")['data']}
    for loc in LOCALES:
        t = LISTING[loc]
        attrs = {'description': t['description'], 'keywords': t['keywords'], 'promotionalText': t['promo'],
                 'supportUrl': SUPPORT, 'marketingUrl': MARKETING}
        if loc in vhave:
            call('PATCH', f"/v1/appStoreVersionLocalizations/{vhave[loc]['id']}",
                 {'data': {'type': 'appStoreVersionLocalizations', 'id': vhave[loc]['id'], 'attributes': attrs}})
        else:
            call('POST', '/v1/appStoreVersionLocalizations',
                 {'data': {'type': 'appStoreVersionLocalizations', 'attributes': {'locale': loc, **attrs},
                           'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version['id']}}}}})
        print('version', loc, 'ok')

    # 5) Copyright and the newest valid build.
    call('PATCH', f"/v1/appStoreVersions/{version['id']}",
         {'data': {'type': 'appStoreVersions', 'id': version['id'], 'attributes': {'copyright': COPYRIGHT}}})
    build = call('GET', f'/v1/builds?filter[app]={APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=1')['data'][0]
    call('PATCH', f"/v1/appStoreVersions/{version['id']}/relationships/build",
         {'data': {'type': 'builds', 'id': build['id']}})
    print('build attached', build['attributes']['version'])

    # 6) Read back.
    bad = 0
    for l in call('GET', f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")['data']:
        a = l['attributes']
        t = LISTING.get(a['locale'])
        if not t or a['name'] != t['name'] or a['subtitle'] != t['subtitle']:
            bad += 1
            print('MISMATCH appInfo', a['locale'], a['name'])
    for l in call('GET', f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")['data']:
        a = l['attributes']
        t = LISTING.get(a['locale'])
        if not t or a['description'] != t['description'] or a['keywords'] != t['keywords']:
            bad += 1
            print('MISMATCH version', a['locale'])
    print('primaryLocale now:', call('GET', f'/v1/apps/{APP_ID}')['data']['attributes']['primaryLocale'])
    print('readback mismatches:', bad)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

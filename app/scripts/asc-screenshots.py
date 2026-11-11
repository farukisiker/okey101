"""Upload the iOS screenshots in app/store/appstore to the en-US (primary) App Store localization.

Other languages fall back to the primary language's screenshots, so one set covers all
while the app UI is Turkish only. Replaces whatever is already in each set.
Run from PowerShell:  python app/scripts/asc-screenshots.py
"""
import hashlib
import importlib.util
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('asc', os.path.join(HERE, 'asc-listing.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
call = asc.call

SHOTS = os.path.join(HERE, '..', 'store', 'appstore')
SETS = {'APP_IPHONE_67': 'iphone-', 'APP_IPAD_PRO_3GEN_129': 'ipad-'}
LOCALE = 'en-US'


def upload(set_id, path):
    data = open(path, 'rb').read()
    name = os.path.basename(path)
    shot = call('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots',
                'attributes': {'fileName': name, 'fileSize': len(data)},
                'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': set_id}}}}})['data']
    for op in shot['attributes']['uploadOperations']:
        chunk = data[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], data=chunk, method=op['method'],
                                     headers={h['name']: h['value'] for h in op['requestHeaders']})
        urllib.request.urlopen(req).read()
    call('PATCH', f"/v1/appScreenshots/{shot['id']}", {'data': {'type': 'appScreenshots', 'id': shot['id'],
         'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    return shot['id']


def main():
    version = [v for v in call('GET', f'/v1/apps/{asc.APP_ID}/appStoreVersions')['data']
               if v['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'][0]
    loc = [l for l in call('GET', f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")['data']
           if l['attributes']['locale'] == LOCALE][0]
    sets = {s['attributes']['screenshotDisplayType']: s for s in
            call('GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")['data']}
    ids = []
    for kind, prefix in SETS.items():
        if kind in sets:
            set_id = sets[kind]['id']
            for old in call('GET', f'/v1/appScreenshotSets/{set_id}/appScreenshots')['data']:
                call('DELETE', f"/v1/appScreenshots/{old['id']}")
        else:
            set_id = call('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets',
                          'attributes': {'screenshotDisplayType': kind},
                          'relationships': {'appStoreVersionLocalization': {'data': {
                              'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}})['data']['id']
        for f in sorted(os.listdir(SHOTS)):
            if f.startswith(prefix):
                ids.append(upload(set_id, os.path.join(SHOTS, f)))
                print(kind, f, 'uploaded')

    # Apple processes the images; wait until every one is COMPLETE (or report the error).
    for _ in range(30):
        states = [call('GET', f'/v1/appScreenshots/{i}')['data']['attributes']['assetDeliveryState'] for i in ids]
        if all(s['state'] in ('COMPLETE', 'FAILED') for s in states):
            break
        time.sleep(5)
    for i, s in zip(ids, states):
        print(i, s['state'], s.get('errors') or '')


if __name__ == '__main__':
    main()

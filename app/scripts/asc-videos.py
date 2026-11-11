"""Upload the iPhone App Preview (en-US) and the ATT prompt recording as an App Review attachment.

Run from PowerShell:  python app/scripts/asc-videos.py
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
call, APP = asc.call, asc.APP_ID
DIR = os.path.join(HERE, '..', 'store', 'appstore')
PREVIEW = os.path.join(DIR, 'app-preview-iphone.mp4')
ATT = os.path.join(DIR, 'review-att-prompt.mp4')
ATT_NOTE = ("\nAttached: screen recording from an iPhone (fresh TestFlight install) showing the App Tracking "
            "Transparency prompt appearing at launch, before any ad is requested.")


def put_parts(ops, data):
    for op in ops:
        req = urllib.request.Request(op['url'], data=data[op['offset']:op['offset'] + op['length']], method=op['method'],
                                     headers={h['name']: h['value'] for h in op['requestHeaders']})
        urllib.request.urlopen(req).read()


def upload(kind, rel_name, rel_type, rel_id, path, extra=None):
    data = open(path, 'rb').read()
    attrs = {'fileName': os.path.basename(path), 'fileSize': len(data), **(extra or {})}
    obj = call('POST', f'/v1/{kind}', {'data': {'type': kind, 'attributes': attrs,
               'relationships': {rel_name: {'data': {'type': rel_type, 'id': rel_id}}}}})['data']
    put_parts(obj['attributes']['uploadOperations'], data)
    call('PATCH', f"/v1/{kind}/{obj['id']}", {'data': {'type': kind, 'id': obj['id'],
         'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    return obj['id']


def main():
    version = [v for v in call('GET', f'/v1/apps/{APP}/appStoreVersions')['data']
               if v['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'][0]
    loc = [l for l in call('GET', f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations?limit=50")['data']
           if l['attributes']['locale'] == 'en-US'][0]

    # App Preview, iPhone 6.9" set. Poster frame at 3 s (a table in play).
    sets = {s['attributes']['previewType']: s for s in
            call('GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appPreviewSets")['data']}
    if 'IPHONE_67' in sets:
        set_id = sets['IPHONE_67']['id']
        for old in call('GET', f'/v1/appPreviewSets/{set_id}/appPreviews')['data']:
            call('DELETE', f"/v1/appPreviews/{old['id']}")
    else:
        set_id = call('POST', '/v1/appPreviewSets', {'data': {'type': 'appPreviewSets',
                      'attributes': {'previewType': 'IPHONE_67'},
                      'relationships': {'appStoreVersionLocalization': {'data': {
                          'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}})['data']['id']
    pid = upload('appPreviews', 'appPreviewSet', 'appPreviewSets', set_id, PREVIEW,
                 {'previewFrameTimeCode': '00:00:03:00', 'mimeType': 'video/mp4'})
    print('preview uploaded', pid)

    # ATT recording as App Review attachment, and a line in the review notes.
    detail = call('GET', f"/v1/appStoreVersions/{version['id']}/appStoreReviewDetail")['data']
    for old in call('GET', f"/v1/appStoreReviewDetails/{detail['id']}/appStoreReviewAttachments")['data']:
        call('DELETE', f"/v1/appStoreReviewAttachments/{old['id']}")
    aid = upload('appStoreReviewAttachments', 'appStoreReviewDetail', 'appStoreReviewDetails', detail['id'], ATT)
    print('review attachment uploaded', aid)
    notes = detail['attributes']['notes'] or ''
    if ATT_NOTE.strip() not in notes:
        call('PATCH', f"/v1/appStoreReviewDetails/{detail['id']}", {'data': {'type': 'appStoreReviewDetails',
             'id': detail['id'], 'attributes': {'notes': notes + ATT_NOTE}}})
        print('notes updated')

    for _ in range(40):
        p = call('GET', f'/v1/appPreviews/{pid}')['data']['attributes']
        a = call('GET', f'/v1/appStoreReviewAttachments/{aid}')['data']['attributes']
        ps, as_ = p['assetDeliveryState']['state'], a['assetDeliveryState']['state']
        if ps in ('COMPLETE', 'FAILED') and as_ in ('COMPLETE', 'FAILED'):
            break
        time.sleep(15)
    print('preview:', p['assetDeliveryState'], '| video state:', p.get('videoDeliveryState'))
    print('attachment:', a['assetDeliveryState'])


if __name__ == '__main__':
    main()

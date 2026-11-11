"""One-time App Store Connect setup for Demli Okey 1.0, besides the listing texts.

Age rating, content rights, manual release, free price, all territories, and the
"Reklamsız Oyna" in-app purchase (store languages + review screenshot).
Run from PowerShell:  python app/scripts/asc-setup.py
"""
import hashlib
import importlib.util
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('asc', os.path.join(HERE, 'asc-listing.py'))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)
call, APP = asc.call, asc.APP_ID
IAP = '6832353565'
IAP_SHOT = os.path.join(HERE, '..', 'store', 'appstore', 'iphone-1-lobi.png')

# Store-language name (<=30) and description (<=45) of the remove-ads purchase.
IAP_TEXT = {
    'en-US': ('Remove Ads', 'Removes the ads between hands for good.'),
    'en-GB': ('Remove Ads', 'Removes the ads between hands for good.'),
    'tr': ('Reklamsız Oyna', 'El aralarındaki reklamları kalıcı kaldırır.'),
    'es-ES': ('Sin anuncios', 'Quita para siempre los anuncios entre manos.'),
    'es-MX': ('Sin anuncios', 'Quita para siempre los anuncios entre manos.'),
    'pt-BR': ('Sem anúncios', 'Remove para sempre os anúncios entre mãos.'),
    'fr-FR': ('Sans publicité', 'Supprime les pubs entre les manches.'),
    'de-DE': ('Werbefrei', 'Entfernt die Werbung zwischen den Runden.'),
    'it': ('Senza pubblicità', 'Rimuove per sempre gli annunci tra le mani.'),
    'ru': ('Без рекламы', 'Навсегда убирает рекламу между раздачами.'),
    'ja': ('広告なし', '対局の合間の広告を完全になくします。'),
    'ko': ('광고 제거', '판 사이의 광고를 영구히 없앱니다.'),
    'zh-Hans': ('移除广告', '永久移除每局之间的广告。'),
    'hi': ('विज्ञापन हटाएँ', 'हाथों के बीच के विज्ञापन हमेशा के लिए हटाता है।'),
    'id': ('Tanpa Iklan', 'Hapus iklan di antara babak selamanya.'),
}

# A tile game without chips, coins or real money: everything off except ads.
AGE = {
    'advertising': True, 'gambling': False, 'lootBox': False, 'messagingAndChat': False,
    'parentalControls': False, 'ageAssurance': False, 'unrestrictedWebAccess': False,
    'userGeneratedContent': False, 'healthOrWellnessTopics': False, 'socialMedia': False,
    'alcoholTobaccoOrDrugUseOrReferences': 'NONE', 'contests': 'NONE', 'gamblingSimulated': 'NONE',
    'gunsOrOtherWeapons': 'NONE', 'medicalOrTreatmentInformation': 'NONE', 'profanityOrCrudeHumor': 'NONE',
    'sexualContentGraphicAndNudity': 'NONE', 'sexualContentOrNudity': 'NONE', 'horrorOrFearThemes': 'NONE',
    'matureOrSuggestiveThemes': 'NONE', 'violenceCartoonOrFantasy': 'NONE',
    'violenceRealisticProlongedGraphicOrSadistic': 'NONE', 'violenceRealistic': 'NONE',
}


def step(name, fn):
    try:
        fn()
        print(name, 'ok')
    except Exception as e:
        print(name, 'FAILED', str(e)[:500])


def age():
    info = call('GET', f'/v1/apps/{APP}/appInfos')['data'][0]
    decl = call('GET', f"/v1/appInfos/{info['id']}/ageRatingDeclaration")['data']
    call('PATCH', f"/v1/ageRatingDeclarations/{decl['id']}",
         {'data': {'type': 'ageRatingDeclarations', 'id': decl['id'], 'attributes': AGE}})


def rights():
    call('PATCH', f'/v1/apps/{APP}', {'data': {'type': 'apps', 'id': APP,
         'attributes': {'contentRightsDeclaration': 'DOES_NOT_USE_THIRD_PARTY_CONTENT'}}})


def manual_release():
    v = [x for x in call('GET', f'/v1/apps/{APP}/appStoreVersions')['data']
         if x['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'][0]
    call('PATCH', f"/v1/appStoreVersions/{v['id']}",
         {'data': {'type': 'appStoreVersions', 'id': v['id'], 'attributes': {'releaseType': 'MANUAL'}}})


def free_price():
    points = call('GET', f'/v1/apps/{APP}/appPricePoints?filter[territory]=USA&limit=200')['data']
    free = [p for p in points if float(p['attributes']['customerPrice']) == 0][0]
    call('POST', '/v1/appPriceSchedules', {
        'data': {'type': 'appPriceSchedules', 'relationships': {
            'app': {'data': {'type': 'apps', 'id': APP}},
            'baseTerritory': {'data': {'type': 'territories', 'id': 'USA'}},
            'manualPrices': {'data': [{'type': 'appPrices', 'id': '${free}'}]}}},
        'included': [{'type': 'appPrices', 'id': '${free}', 'attributes': {'startDate': None},
                      'relationships': {'appPricePoint': {'data': {'type': 'appPricePoints', 'id': free['id']}}}}]})


def all_territories():
    ter = call('GET', '/v1/territories?limit=200')['data']
    call('POST', '/v2/appAvailabilities', {
        'data': {'type': 'appAvailabilities', 'attributes': {'availableInNewTerritories': True},
                 'relationships': {'app': {'data': {'type': 'apps', 'id': APP}},
                                   'territoryAvailabilities': {'data': [
                                       {'type': 'territoryAvailabilities', 'id': '${' + t['id'] + '}'} for t in ter]}}},
        'included': [{'type': 'territoryAvailabilities', 'id': '${' + t['id'] + '}', 'attributes': {'available': True},
                      'relationships': {'territory': {'data': {'type': 'territories', 'id': t['id']}}}} for t in ter]})
    print('  territories:', len(ter))


def iap_texts():
    have = {l['attributes']['locale']: l for l in
            call('GET', f'/v2/inAppPurchases/{IAP}/inAppPurchaseLocalizations?limit=50')['data']}
    for loc, (name, desc) in IAP_TEXT.items():
        attrs = {'name': name, 'description': desc}
        if loc in have:
            call('PATCH', f"/v1/inAppPurchaseLocalizations/{have[loc]['id']}",
                 {'data': {'type': 'inAppPurchaseLocalizations', 'id': have[loc]['id'], 'attributes': attrs}})
        else:
            call('POST', '/v1/inAppPurchaseLocalizations', {'data': {'type': 'inAppPurchaseLocalizations',
                 'attributes': {'locale': loc, **attrs},
                 'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': IAP}}}}})


def iap_screenshot():
    if call('GET', f'/v2/inAppPurchases/{IAP}/appStoreReviewScreenshot').get('data'):
        print('  already has one')
        return
    data = open(IAP_SHOT, 'rb').read()
    shot = call('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {'data': {
        'type': 'inAppPurchaseAppStoreReviewScreenshots',
        'attributes': {'fileName': 'reklamsiz-oyna.png', 'fileSize': len(data)},
        'relationships': {'inAppPurchaseV2': {'data': {'type': 'inAppPurchases', 'id': IAP}}}}})['data']
    for op in shot['attributes']['uploadOperations']:
        req = urllib.request.Request(op['url'], data=data[op['offset']:op['offset'] + op['length']], method=op['method'],
                                     headers={h['name']: h['value'] for h in op['requestHeaders']})
        urllib.request.urlopen(req).read()
    call('PATCH', f"/v1/inAppPurchaseAppStoreReviewScreenshots/{shot['id']}", {'data': {
        'type': 'inAppPurchaseAppStoreReviewScreenshots', 'id': shot['id'],
        'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})


def readback():
    info = call('GET', f'/v1/apps/{APP}/appInfos')['data'][0]
    a = call('GET', f"/v1/appInfos/{info['id']}/ageRatingDeclaration")['data']['attributes']
    print('  age unset fields:', [k for k in AGE if a.get(k) is None])
    print('  rights:', call('GET', f'/v1/apps/{APP}')['data']['attributes'].get('contentRightsDeclaration'))
    v = [x for x in call('GET', f'/v1/apps/{APP}/appStoreVersions')['data']][0]['attributes']
    print('  release:', v['releaseType'])
    print('  iap:', call('GET', f'/v2/inAppPurchases/{IAP}')['data']['attributes']['state'],
          'locales:', len(call('GET', f'/v2/inAppPurchases/{IAP}/inAppPurchaseLocalizations?limit=50')['data']))
    print('  app info state:', info['attributes'].get('state'), '| age:', info['attributes'].get('appStoreAgeRating'))


for name, fn in [('age rating', age), ('content rights', rights), ('manual release', manual_release),
                 ('free price', free_price), ('territories', all_territories), ('iap texts', iap_texts),
                 ('iap screenshot', iap_screenshot), ('readback', readback)]:
    step(name, fn)

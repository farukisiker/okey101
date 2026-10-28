#!/usr/bin/env python3
"""App Store Connect API helper for the iOS CI build.

Reads the key from env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to the .p8).

  asc.py team --bundle-id ID       register the bundle id if needed, print the team id
  asc.py signing --bundle-id ID    temporary distribution cert (.p12) + App Store profile
  asc.py revoke                    delete the temporary cert and profile again
  asc.py testflight --bundle-id ID --version 0.1.0 --build 12 --emails a@x.com,b@y.com

The API key cannot use Xcode cloud signing, so signing material is created per
run through the API and revoked afterwards.
"""
import argparse
import base64
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request

import jwt  # pyjwt[crypto]
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = "https://api.appstoreconnect.apple.com/v1"


def token() -> str:
    with open(os.environ["ASC_KEY_PATH"], "rb") as f:
        key = f.read()
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )


class ApiError(Exception):
    def __init__(self, status, body):
        super().__init__(f"HTTP {status}: {body}")
        self.status = status
        self.body = body


def call(method, path, body=None):
    url = path if path.startswith("http") else API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise ApiError(e.code, e.read().decode(errors="replace")) from None


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def find_app(bundle_id):
    apps = call("GET", f"/apps?filter[bundleId]={bundle_id}")["data"]
    apps = [a for a in apps if a["attributes"]["bundleId"] == bundle_id]
    if not apps:
        log(
            f"::error::App Store Connect'te '{bundle_id}' için uygulama kaydı yok. "
            "App Store Connect > Uygulamalar > + > Yeni Uygulama ile bu bundle ID'yi seçerek oluştur "
            "(bundle ID bu çalıştırmada kaydedildi), sonra workflow'u tekrar çalıştır."
        )
        sys.exit(2)
    return apps[0]


def find_bundle(bundle_id):
    found = call("GET", f"/bundleIds?filter[identifier]={bundle_id}")["data"]
    found = [b for b in found if b["attributes"]["identifier"] == bundle_id]
    return found[0] if found else None


def cmd_team(args):
    bundle = find_bundle(args.bundle_id)
    if not bundle:
        log(f"Bundle ID {args.bundle_id} kaydediliyor")
        bundle = call("POST", "/bundleIds", {"data": {"type": "bundleIds", "attributes": {
            "identifier": args.bundle_id, "name": args.name, "platform": "IOS"}}})["data"]
    find_app(args.bundle_id)
    team = os.environ.get("APPLE_TEAM_ID", "").strip()
    if len(team) != 10:
        # The team id is the OU of any certificate issued to the team.
        for c in call("GET", "/certificates?limit=50")["data"]:
            cert = x509.load_der_x509_certificate(base64.b64decode(c["attributes"]["certificateContent"]))
            ou = cert.subject.get_attributes_for_oid(NameOID.ORGANIZATIONAL_UNIT_NAME)
            if ou:
                team = ou[0].value
                break
    if len(team) != 10:
        team = bundle["attributes"].get("seedId", "")
    if len(team) != 10:
        sys.exit("Team ID bulunamadı; APPLE_TEAM_ID secret'ını ekle")
    print(team)


def cmd_signing(args):
    tmp = os.environ["RUNNER_TEMP"]
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    csr = x509.CertificateSigningRequestBuilder().subject_name(
        x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Okey101 CI")])
    ).sign(key, hashes.SHA256())
    cert = call("POST", "/certificates", {"data": {"type": "certificates", "attributes": {
        "certificateType": "DISTRIBUTION",
        "csrContent": csr.public_bytes(serialization.Encoding.PEM).decode()}}})["data"]
    with open(f"{tmp}/cert_id", "w") as f:
        f.write(cert["id"])
    log(f"Dağıtım sertifikası oluşturuldu: {cert['id']}")

    der = base64.b64decode(cert["attributes"]["certificateContent"])
    password = secrets.token_hex(16)
    enc = (serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000)
           .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC).hmac_hash(hashes.SHA1())
           .build(password.encode()))
    with open(f"{tmp}/dist.p12", "wb") as f:
        f.write(pkcs12.serialize_key_and_certificates(b"dist", key, x509.load_der_x509_certificate(der), None, enc))
    with open(f"{tmp}/p12_pw", "w") as f:
        f.write(password)

    bundle = find_bundle(args.bundle_id)
    name = f"Okey101 CI {int(time.time())}"
    prof = call("POST", "/profiles", {"data": {
        "type": "profiles", "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
            "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]}}}})["data"]
    with open(f"{tmp}/profile_id", "w") as f:
        f.write(prof["id"])
    content = base64.b64decode(prof["attributes"]["profileContent"])
    for d in ("~/Library/MobileDevice/Provisioning Profiles", "~/Library/Developer/Xcode/UserData/Provisioning Profiles"):
        d = os.path.expanduser(d)
        os.makedirs(d, exist_ok=True)
        with open(f"{d}/{prof['attributes']['uuid']}.mobileprovision", "wb") as f:
            f.write(content)
    log(f"Profil oluşturuldu: {name}")
    print(name)


def cmd_revoke(_args):
    tmp = os.environ["RUNNER_TEMP"]
    for kind, file in (("profiles", "profile_id"), ("certificates", "cert_id")):
        path = f"{tmp}/{file}"
        if os.path.exists(path):
            rid = open(path).read().strip()
            try:
                call("DELETE", f"/{kind}/{rid}")
                log(f"Silindi: {kind} {rid}")
            except ApiError as e:
                log(f"::warning::{kind} {rid} silinemedi: {e}")


def wait_for_build(app_id, version, build_number, timeout_s=60 * 60):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        builds = call(
            "GET",
            f"/builds?filter[app]={app_id}&filter[version]={build_number}"
            f"&filter[preReleaseVersion.version]={version}&limit=1",
        )["data"]
        state = builds[0]["attributes"]["processingState"] if builds else "NOT_FOUND"
        log(f"Build {version} ({build_number}): {state}")
        if state == "VALID":
            return builds[0]
        if state in ("FAILED", "INVALID"):
            sys.exit(f"Build işlenemedi: {state}")
        time.sleep(30)
    sys.exit("Build işlenmesi zaman aşımına uğradı")


def get_group(app_id, name, internal):
    groups = call("GET", f"/apps/{app_id}/betaGroups?limit=200")["data"]
    for g in groups:
        if g["attributes"]["name"] == name and g["attributes"]["isInternalGroup"] == internal:
            return g
    attrs = {"name": name, "isInternalGroup": internal}
    if internal:
        attrs["hasAccessToAllBuilds"] = True
    else:
        attrs["publicLinkEnabled"] = False
    log(f"Beta grubu oluşturuluyor: {name}")
    return call("POST", "/betaGroups", {"data": {
        "type": "betaGroups", "attributes": attrs,
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]


def add_tester(group_id, email):
    try:
        call("POST", "/betaTesters", {"data": {
            "type": "betaTesters", "attributes": {"email": email},
            "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group_id}]}}}})
        return True
    except ApiError as e:
        if e.status == 409 and "already" in e.body.lower():
            # Exists already: link the existing tester to the group.
            existing = call("GET", f"/betaTesters?filter[email]={email}")["data"]
            if existing:
                try:
                    call("POST", f"/betaGroups/{group_id}/relationships/betaTesters",
                         {"data": [{"type": "betaTesters", "id": existing[0]["id"]}]})
                    return True
                except ApiError as e2:
                    log(f"  {email}: {e2}")
                    return False
        log(f"  {email}: {e}")
        return False


def cmd_testflight(args):
    app = find_app(args.bundle_id)
    build = wait_for_build(app["id"], args.version, args.build)
    emails = [e.strip() for e in args.emails.split(",") if e.strip()]

    try:
        users = call("GET", "/users?limit=200")["data"]
        team = {u["attributes"]["username"].lower() for u in users}
    except ApiError as e:
        log(f"Kullanıcı listesi okunamadı ({e.status}); hepsi dahili denenecek")
        team = {e.lower() for e in emails}

    # Internal testers (App Store Connect team members): no review, get every build.
    pending = [e for e in emails if e.lower() not in team]
    members = [e for e in emails if e.lower() in team]
    if members:
        internal = get_group(app["id"], "Dahili Test", True)
        for email in members:
            if add_tester(internal["id"], email):
                log(f"Dahili teste eklendi: {email}")
            else:
                pending.append(email)
    if not pending:
        return

    # Not team members: external group, which needs Beta App Review for the first build.
    log(f"Dahili eklenemeyenler harici gruba ekleniyor: {', '.join(pending)}")
    external = get_group(app["id"], "Harici Test", False)
    call("POST", f"/betaGroups/{external['id']}/relationships/builds",
         {"data": [{"type": "builds", "id": build["id"]}]})
    for email in pending:
        if add_tester(external["id"], email):
            log(f"Harici teste eklendi: {email}")
    what = "Okey 101: 4 kişilik çok oyunculu Okey 101, boş koltuklarda bot."
    locs = call("GET", f"/builds/{build['id']}/betaBuildLocalizations")["data"]
    try:
        if locs:
            call("PATCH", f"/betaBuildLocalizations/{locs[0]['id']}", {"data": {
                "type": "betaBuildLocalizations", "id": locs[0]["id"], "attributes": {"whatToTest": what}}})
        else:
            call("POST", "/betaBuildLocalizations", {"data": {
                "type": "betaBuildLocalizations", "attributes": {"locale": "tr", "whatToTest": what},
                "relationships": {"build": {"data": {"type": "builds", "id": build["id"]}}}}})
    except ApiError as e:
        log(f"::warning::'Neyi test etmeli' metni yazılamadı: {e}")
    try:
        call("POST", "/betaAppReviewSubmissions", {"data": {
            "type": "betaAppReviewSubmissions",
            "relationships": {"build": {"data": {"type": "builds", "id": build["id"]}}}}})
        log("Build, harici test için Beta App Review'a gönderildi")
    except ApiError as e:
        log(
            "::warning::Beta App Review'a gönderilemedi. App Store Connect > TestFlight > Test Bilgileri "
            f"(iletişim bilgisi, açıklama) bir kez doldurulmalı. Ayrıntı: {e}"
        )


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("team")
    t.add_argument("--bundle-id", required=True)
    t.add_argument("--name", default="Okey 101")
    sg = sub.add_parser("signing")
    sg.add_argument("--bundle-id", required=True)
    sub.add_parser("revoke")
    f = sub.add_parser("testflight")
    f.add_argument("--bundle-id", required=True)
    f.add_argument("--version", required=True)
    f.add_argument("--build", required=True)
    f.add_argument("--emails", required=True)
    args = p.parse_args()
    {"team": cmd_team, "signing": cmd_signing, "revoke": cmd_revoke, "testflight": cmd_testflight}[args.cmd](args)


if __name__ == "__main__":
    main()

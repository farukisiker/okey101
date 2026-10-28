#!/usr/bin/env python3
"""App Store Connect API helper for the iOS CI build.

Reads the key from env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to the .p8).

  asc.py team --bundle-id ID              register the bundle id if needed, print the team id
  asc.py testflight --bundle-id ID --version 0.1.0 --build 12 --emails a@x.com,b@y.com
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt  # pyjwt[crypto]

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


def cmd_team(args):
    found = call("GET", f"/bundleIds?filter[identifier]={args.bundle_id}&filter[platform]=IOS")["data"]
    found = [b for b in found if b["attributes"]["identifier"] == args.bundle_id]
    if found:
        bundle = found[0]
    else:
        log(f"Bundle ID {args.bundle_id} kaydediliyor")
        bundle = call(
            "POST",
            "/bundleIds",
            {"data": {"type": "bundleIds", "attributes": {
                "identifier": args.bundle_id, "name": args.name, "platform": "IOS"}}},
        )["data"]
    find_app(args.bundle_id)
    print(bundle["attributes"]["seedId"])


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

    # Internal testers (App Store Connect team members): no review, get every build.
    internal = get_group(app["id"], "Dahili Test", True)
    pending = []
    for email in emails:
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
    f = sub.add_parser("testflight")
    f.add_argument("--bundle-id", required=True)
    f.add_argument("--version", required=True)
    f.add_argument("--build", required=True)
    f.add_argument("--emails", required=True)
    args = p.parse_args()
    {"team": cmd_team, "testflight": cmd_testflight}[args.cmd](args)


if __name__ == "__main__":
    main()

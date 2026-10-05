import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
base="https://safa.dedyn.io/pact"
results={}
for path in ["/health", "/telegram/", "/notification-sw.js", "/v1/notifications/preferences", "/v1/moderation/mine", "/v1/moderation/queue", "/v1/telegram/run-settings"]:
    req=Request(base+path,headers={"User-Agent":"PACT-authorized-test-check"})
    try:
        r=urlopen(req,timeout=20)
    except HTTPError as e:
        r=e
    results[path]={"status":r.status,"cacheControl":r.headers.get("cache-control")}
    r.close()
for path in ["/health","/telegram/","/notification-sw.js"]:
    assert results[path]["status"]==200, results
for path in ["/v1/notifications/preferences","/v1/moderation/mine","/v1/moderation/queue","/v1/telegram/run-settings"]:
    assert results[path]["status"]==403, results
    assert results[path]["cacheControl"]=="no-store", results
Path("/home/mnim/repos/mine/random_idea/docs/implementation/reports/evidence/social-channel-public-20261004.json").write_text(json.dumps({"date":"2026-10-04","release":"social-channel-20261004-2","checks":results,"noAuthenticatedMutation":True},indent=2)+"\n")
print(json.dumps(results))

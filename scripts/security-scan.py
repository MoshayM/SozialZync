"""
OWASP Top-10 aligned security scan for SozialZync
Covers: A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection,
        A05 Security Misconfiguration, A07 Auth Failures, A09 Info Disclosure
"""
import requests
import sys

FRONTEND = "https://sozialzynk.vercel.app"
BACKEND  = "https://api-production-cf143.up.railway.app"

session = requests.Session()
session.headers["User-Agent"] = "SozialZync-SecScan/1.0"

results = {"pass": 0, "fail": 0, "warn": 0}

def chk(label, passed, msg="", severity="fail"):
    tag = "[PASS]" if passed else ("[FAIL]" if severity == "fail" else "[WARN]")
    results["pass" if passed else severity] += 1
    line = f"  {tag} {label}"
    if msg:
        line += f" -- {msg}"
    print(line)

SEP = "=" * 55

print("\n" + SEP)
print("  SozialZync OWASP Security Scan")
print(f"  Frontend : {FRONTEND}")
print(f"  Backend  : {BACKEND}")
print(SEP + "\n")

# ── A02/A05 Security headers (frontend) ─────────────────────────
print("-- A02/A05  Security Headers (Frontend) ---------------")
try:
    r = session.get(FRONTEND, timeout=15)
    h = r.headers

    chk("HTTPS enforced",                       r.url.startswith("https://"))
    chk("Strict-Transport-Security present",    "strict-transport-security" in h)
    chk("X-Frame-Options or CSP frame-ancestors",
        "x-frame-options" in h or "frame-ancestors" in h.get("content-security-policy","").lower())
    chk("X-Content-Type-Options: nosniff",      h.get("x-content-type-options","").lower() == "nosniff")
    chk("Content-Security-Policy present",      "content-security-policy" in h)
    chk("Referrer-Policy present",              "referrer-policy" in h)
    chk("Permissions-Policy present",           "permissions-policy" in h, severity="warn")
    csp = h.get("content-security-policy", "")
    chk("CSP: no unsafe-inline scripts",        "unsafe-inline" not in csp,
        "'unsafe-inline' weakens XSS protection" if "unsafe-inline" in csp else "", severity="warn")
    chk("CSP: no unsafe-eval",                  "unsafe-eval" not in csp,
        "'unsafe-eval' allows code execution" if "unsafe-eval" in csp else "", severity="warn")
    chk("Server header no version leak",
        not any(x in h.get("server","").lower() for x in ["apache/","nginx/","express/"]))
    chk("X-Powered-By not exposed",            "x-powered-by" not in h)
except Exception as e:
    print(f"  [FAIL] Could not reach frontend: {e}")
    results["fail"] += 1

# ── A02/A05 Security headers (backend) ──────────────────────────
print("\n-- A02/A05  Security Headers (Backend /health) --------")
try:
    r = session.get(f"{BACKEND}/health", timeout=15)
    h = r.headers
    chk("Backend HTTPS",                        r.url.startswith("https://"))
    chk("X-Content-Type-Options: nosniff",      h.get("x-content-type-options","").lower() == "nosniff")
    chk("No X-Powered-By header",              "x-powered-by" not in h)
    chk("Health returns 200",                   r.status_code == 200)
    body = r.json() if "json" in r.headers.get("content-type","") else {}
    chk("Health body is minimal",
        set(body.keys()) <= {"status","uptime","uptimeSec","timestamp","environment"},
        f"Exposed keys: {list(body.keys())}" if set(body.keys()) > {"status","uptime","uptimeSec","timestamp","environment"} else "")
except Exception as e:
    print(f"  [FAIL] Backend unreachable: {e}")
    results["fail"] += 1

# ── A07 Auth: unauthenticated access to protected routes ─────────
print("\n-- A07  Broken Auth -- Unauthenticated Probes ----------")
protected = [
    ("/api/v1/auth/me",                  401),
    ("/api/v1/channels",                 401),
    ("/api/v1/projects",                 401),
    ("/api/v1/wallet/balance",           401),
    ("/api/v1/admin/users",              401),
    ("/api/v1/wallet/admin/withdrawals", 401),
]
for path, expected in protected:
    try:
        r = session.get(f"{BACKEND}{path}", timeout=10)
        chk(f"GET {path} => {expected}",
            r.status_code == expected,
            f"Got {r.status_code}" if r.status_code != expected else "")
    except Exception as e:
        print(f"  [WARN] {path} -- {e}")

# ── A01 IDOR probes ──────────────────────────────────────────────
print("\n-- A01  Broken Access Control -- IDOR Probes -----------")
idor_paths = [
    "/api/v1/projects/nonexistent-id-000",
    "/api/v1/channels/nonexistent-id-000",
    "/api/v1/users/nonexistent-id-000",
]
for path in idor_paths:
    try:
        r = session.get(f"{BACKEND}{path}", timeout=10)
        chk(f"GET {path}",
            r.status_code in (401, 403, 404),
            f"Got {r.status_code} -- possible data leak" if r.status_code == 200 else "")
    except Exception as e:
        print(f"  [WARN] {path} -- {e}")

# ── A03 Injection probes ─────────────────────────────────────────
print("\n-- A03  Injection Probes --------------------------------")
injection_payloads = [
    ("SQL injection in query",   f"{BACKEND}/api/v1/projects?search=%27+OR+1%3D1--",       [400,401,403,422]),
    ("XSS in query param",       f"{BACKEND}/api/v1/projects?search=%3Cscript%3Ealert%281%29%3C%2Fscript%3E", [400,401,403,422]),
    ("Path traversal",           f"{BACKEND}/api/v1/../../etc/passwd",                      [400,401,403,404]),
    ("Null byte injection",      f"{BACKEND}/api/v1/projects/%00",                          [400,401,403,404]),
]
for label, url, safe_codes in injection_payloads:
    try:
        r = session.get(url, timeout=10)
        chk(label, r.status_code in safe_codes,
            f"Got {r.status_code} -- review response" if r.status_code not in safe_codes else "")
    except Exception as e:
        print(f"  [WARN] {label} -- {e}")

# ── A05 CORS misconfiguration ────────────────────────────────────
print("\n-- A05  CORS Misconfiguration ---------------------------")
try:
    r = session.options(
        f"{BACKEND}/api/v1/auth/login",
        headers={"Origin": "https://evil.com",
                 "Access-Control-Request-Method": "POST"},
        timeout=10)
    acao = r.headers.get("access-control-allow-origin", "")
    chk("CORS does not echo arbitrary origin",
        acao not in ("https://evil.com", "*"),
        f"ACAO header: {acao!r}" if acao in ("https://evil.com", "*") else f"ACAO: {acao!r}")
    chk("Credentials not allowed with wildcard origin",
        not (acao == "*" and "access-control-allow-credentials" in r.headers))
except Exception as e:
    print(f"  [WARN] CORS probe failed: {e}")

# ── A07 Rate limiting on auth ────────────────────────────────────
print("\n-- A07  Rate Limiting on Auth Endpoint -----------------")
try:
    blocked = False
    for i in range(10):
        r = session.post(
            f"{BACKEND}/api/v1/auth/login",
            json={"email": "probe@test.com", "password": "wrongpassword"},
            timeout=10)
        if r.status_code == 429:
            blocked = True
            chk(f"Rate limit triggered after {i+1} attempts", True)
            break
    if not blocked:
        chk("Rate limit after 10 bad login attempts", False,
            "No 429 after 10 attempts -- add throttling (helmet/express-rate-limit)", severity="warn")
except Exception as e:
    print(f"  [WARN] Rate limit probe failed: {e}")

# ── A09 Information disclosure ───────────────────────────────────
print("\n-- A09  Information Disclosure --------------------------")
for path in ["/api/v1/does-not-exist", "/api/v1/projects/!!invalid!!", "/api/docs"]:
    try:
        r = session.get(f"{BACKEND}{path}", timeout=10)
        body = r.text[:600]
        stack_leaked = any(x in body for x in ["at Object.", "at Module.", "node_modules", "dist/", "Error:"])
        chk(f"No stack trace at {path} ({r.status_code})",
            not stack_leaked,
            "Internal path / stack trace leaked in response" if stack_leaked else "")
    except Exception as e:
        print(f"  [WARN] {path} -- {e}")

try:
    r = session.get(f"{BACKEND}/api/docs", timeout=10)
    chk("Swagger UI disabled in production",
        r.status_code in (404, 401, 403),
        f"Swagger UI is publicly accessible (status {r.status_code})" if r.status_code == 200 else "")
except Exception as e:
    print(f"  [WARN] Swagger check: {e}")

# ── Verb tampering ───────────────────────────────────────────────
print("\n-- A05  Verb Tampering / Unexpected Methods ------------")
for method in ["TRACE", "CONNECT", "TRACK"]:
    try:
        r = session.request(method, f"{BACKEND}/api/v1/auth/login", timeout=10)
        chk(f"{method} method rejected",
            r.status_code in (405, 401, 403, 501),
            f"Got {r.status_code}" if r.status_code not in (405, 401, 403, 501) else "")
    except Exception as e:
        chk(f"{method} method rejected (connection error = ok)", True)

# ── Summary ──────────────────────────────────────────────────────
total = results["pass"] + results["fail"] + results["warn"]
print("\n" + SEP)
print(f"  SCAN COMPLETE  --  {total} checks")
print(f"  [PASS]  {results['pass']}")
print(f"  [WARN]  {results['warn']}")
print(f"  [FAIL]  {results['fail']}")
print(SEP + "\n")

sys.exit(0 if results["fail"] == 0 else 1)

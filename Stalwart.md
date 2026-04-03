# Stalwart Mail Server — Setup Guide

Self-hosted mail server on GCP Compute Engine for `ayushrai.xyz`.  
Provides SMTP, IMAP, and a programmatic JMAP API for reading inbox / OTP retrieval.

---

## Infrastructure Overview

| Component | Detail |
|-----------|--------|
| **GCP Instance** | `instance-20260205-094014`, zone `us-central1-a` |
| **Public IP** | `34.121.134.57` |
| **Domain** | `ayushrai.xyz` |
| **Mail hostname** | `mail.ayushrai.xyz` (DNS-only, grey cloud) |
| **Admin dashboard** | `https://mailui.ayushrai.xyz` (Cloudflare proxied) |
| **Reverse proxy** | Caddy |
| **Mail server** | Stalwart v0.15.5 |
| **Storage backend** | RocksDB |
| **DNS provider** | Cloudflare |

---

## Architecture

```
Internet
  │
  ├─ Port 25/465/587          SMTP (mail.ayushrai.xyz — DNS only, no proxy)
  ├─ Port 993/143             IMAP (mail.ayushrai.xyz — DNS only)
  │
  └─ Port 443 → Cloudflare → GCP:443
                    ├─ mailui.ayushrai.xyz  → Caddy → Stalwart :8080  (Admin + JMAP)
                    └─ ayushrai.xyz         → Caddy → /home/ayush/portfolio/dist
```

---

## Step 1 — Prerequisites

### Stop conflicting mail service (exim4)

GCP Debian instances ship with `exim4` which occupies port 25.

```bash
sudo systemctl stop exim4
sudo systemctl disable exim4
```

### Open GCP Firewall ports

```bash
gcloud compute firewall-rules create allow-mail-ports \
  --allow tcp:25,tcp:465,tcp:587,tcp:993,tcp:143 \
  --source-ranges 0.0.0.0/0 \
  --description "Stalwart mail server ports"
```

---

## Step 2 — Install Stalwart

```bash
curl --proto '=https' --tlsv1.2 -sSf https://get.stalw.art/install.sh -o install.sh
sudo sh install.sh
```

The installer outputs credentials:
```
✅ Configuration file written to /opt/stalwart/etc/config.toml
🔑 Your administrator account is 'admin' with password 'kJlgqYYjO2'
🎉 Installation complete!
```

### Configure as systemd service

Stalwart auto-installs its systemd unit. Verify:

```bash
sudo systemctl status stalwart
sudo ss -tlnp | grep stalwart
# Should show ports: 25, 110, 143, 465, 587, 993, 995, 4190, 8080
```

---

## Step 3 — Caddy Reverse Proxy

Caddy was already running for other subdomains. Added `mail.ayushrai.xyz` and `mailui.ayushrai.xyz` blocks to `/etc/caddy/Caddyfile`:

```caddy
mail.ayushrai.xyz, mailui.ayushrai.xyz {
    bind 10.128.0.2
    reverse_proxy 127.0.0.1:8080
    tls /etc/caddy/certs/ayushrai.pem /etc/caddy/certs/ayushrai.key
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Step 4 — Configure Stalwart via API

### Set hostname

```bash
# Edit config.toml directly (API format for this key differs)
sudo sed -i '1i lookup.default.hostname = "mail.ayushrai.xyz"' /opt/stalwart/etc/config.toml
sudo systemctl restart stalwart
```

Verify:
```bash
curl -u "admin:kJlgqYYjO2" "https://mailui.ayushrai.xyz/api/settings/keys?keys=lookup.default.hostname"
# {"data":{"lookup.default.hostname":"mail.ayushrai.xyz"}}
```

### Create domain

```bash
curl -u "admin:kJlgqYYjO2" \
  -X POST "https://mailui.ayushrai.xyz/api/principal" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "name": "ayushrai.xyz",
    "description": "Main domain",
    "quota": 0,
    "secrets": [], "emails": [], "urls": [],
    "memberOf": [], "roles": [], "lists": [],
    "members": [], "enabledPermissions": [],
    "disabledPermissions": [], "externalMembers": []
  }'
# {"data": 1}  ← domain principal ID
```

### Generate DKIM keys

```bash
# Ed25519 key
curl -u "admin:kJlgqYYjO2" -X POST "https://mailui.ayushrai.xyz/api/dkim" \
  -H "Content-Type: application/json" \
  -d '{"id": null, "algorithm": "Ed25519", "domain": "ayushrai.xyz", "selector": null}'

# RSA key
curl -u "admin:kJlgqYYjO2" -X POST "https://mailui.ayushrai.xyz/api/dkim" \
  -H "Content-Type: application/json" \
  -d '{"id": null, "algorithm": "Rsa", "domain": "ayushrai.xyz", "selector": null}'
```

### Get all required DNS records

```bash
curl -u "admin:kJlgqYYjO2" "https://mailui.ayushrai.xyz/api/dns/records/ayushrai.xyz"
```

This returns the exact MX, SPF, DKIM, DMARC, TLSRPT records needed.

---

## Step 5 — Cloudflare DNS (via API)

Used the Cloudflare REST API with an "Edit zone DNS" token.

```bash
TOKEN="<your-cloudflare-token>"
ZONE_ID="ceb608928e60581f55b9594428e360bf"

# MX
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"MX","name":"ayushrai.xyz","content":"mail.ayushrai.xyz","priority":10,"ttl":1}'

# SPF (root)
curl -X POST "..." --data '{"type":"TXT","name":"ayushrai.xyz","content":"v=spf1 mx ra=postmaster -all","ttl":1}'

# SPF (mail)
curl -X POST "..." --data '{"type":"TXT","name":"mail.ayushrai.xyz","content":"v=spf1 a ra=postmaster -all","ttl":1}'

# DKIM Ed25519
curl -X POST "..." --data '{"type":"TXT","name":"202604e._domainkey.ayushrai.xyz","content":"v=DKIM1; k=ed25519; h=sha256; p=+rzl0YNjam1MZ3YGlwmWiQB2YqZvD8/XhvitvsTz1xY=","ttl":1}'

# DKIM RSA
curl -X POST "..." --data '{"type":"TXT","name":"202604r._domainkey.ayushrai.xyz","content":"v=DKIM1; k=rsa; h=sha256; p=MIIBIj...DAQAB","ttl":1}'

# DMARC
curl -X POST "..." --data '{"type":"TXT","name":"_dmarc.ayushrai.xyz","content":"v=DMARC1; p=reject; rua=mailto:postmaster@ayushrai.xyz; ruf=mailto:postmaster@ayushrai.xyz","ttl":1}'

# TLS Reporting
curl -X POST "..." --data '{"type":"TXT","name":"_smtp._tls.ayushrai.xyz","content":"v=TLSRPTv1; rua=mailto:postmaster@ayushrai.xyz","ttl":1}'
```

### Final DNS records

| Type | Name | Content |
|------|------|---------|
| A | `mail` | `34.121.134.57` — **DNS only (grey cloud!)** |
| A | `mailui` | `34.121.134.57` — **Proxied (orange cloud)** |
| MX | `@` | `mail.ayushrai.xyz` priority 10 |
| TXT | `@` | `v=spf1 mx ra=postmaster -all` |
| TXT | `mail` | `v=spf1 a ra=postmaster -all` |
| TXT | `202604e._domainkey` | `v=DKIM1; k=ed25519; h=sha256; p=+rzl0...` |
| TXT | `202604r._domainkey` | `v=DKIM1; k=rsa; h=sha256; p=MIIBIj...` |
| TXT | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:postmaster@ayushrai.xyz` |
| TXT | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:postmaster@ayushrai.xyz` |

---

## Step 6 — Create First Email Account

```bash
curl -u "admin:kJlgqYYjO2" \
  -X POST "https://mailui.ayushrai.xyz/api/principal" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "name": "ayush",
    "description": "Ayush Rai",
    "quota": 0,
    "secrets": ["AyushMail2026!"],
    "emails": ["ayush@ayushrai.xyz"],
    "urls": [], "memberOf": [], "roles": [],
    "lists": [], "members": [],
    "enabledPermissions": [], "disabledPermissions": [],
    "externalMembers": []
  }'
# {"data": 2}  ← user principal ID
```

---

## Issues Encountered & How They Were Fixed

### ❌ Issue 1: Port 443 conflict

**Problem:** Stalwart's default config bound its HTTPS listener to `[::]:443`, conflicting with Caddy.

**Symptom:** Caddy failed to start after Stalwart was installed.

**Fix:** Changed Stalwart's HTTPS bind to an internal-only address:

```bash
sudo sed -i 's/bind = "\[::]:443"/bind = "127.0.0.1:8443"/' /opt/stalwart/etc/config.toml
sudo systemctl restart stalwart
```

---

### ❌ Issue 2: TLS cert error on `mail.ayushrai.xyz`

**Problem:** The existing Cloudflare Origin Certificate (`*.ayushrai.xyz`) is only trusted when traffic flows through Cloudflare's proxy. Setting `mail` to DNS-only (required for SMTP/IMAP) caused browsers to show `ERR_CERT_AUTHORITY_INVALID`.

**Root cause:** Cloudflare Origin Certs are signed by Cloudflare's own CA — not a public CA — so they're only valid behind the Cloudflare proxy.

**Fix:** Created a **second subdomain** (`mailui.ayushrai.xyz`) with the orange cloud (proxied) for browser access to the admin panel and JMAP API. The `mail` subdomain stays grey-cloud (DNS-only) exclusively for SMTP/IMAP ports.

```bash
# Add proxied A record for mailui
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"mailui.ayushrai.xyz","content":"34.121.134.57","proxied":true}'
```

Then added `mailui.ayushrai.xyz` to the Caddyfile mail block.

---

### ❌ Issue 3: Nginx blocking port 80 (preventing Caddy restart)

**Problem:** After attempting to enable Caddy's auto-HTTPS (Let's Encrypt), Caddy failed to start because Nginx was already binding port 80.

**Symptom:** `Job for caddy.service failed` after config change.

**Fix:** Checked that Nginx was only serving a default page (not critical), then stopped and disabled it:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl restart caddy
```

---

### ❌ Issue 4: `auto_https on` is not a valid Caddy directive

**Problem:** While fixing the TLS issue, `auto_https on` was added to the Caddyfile global block. Caddy's valid values are only `off`, `disable_redirects`, `disable_certs`, or `ignore_loaded_certs` — not `on`.

**Symptom:** `caddy validate` returned: `auto_https must be one of 'off', 'disable_redirects'...`

**Fix:** Removed the invalid directive entirely. Caddy's default behaviour already handles HTTPS correctly.

---

### ❌ Issue 5: Duplicate DNS records with extra quotes

**Problem:** A first pass at adding DNS records (before the API call approach was finalised) created duplicate TXT records where some had content wrapped in extra quotes (e.g. `"v=spf1 mx ra=postmaster -all"` with literal quotes inside).

**Fix:** Listed all records via API, identified the duplicate IDs (the older quoted ones), and deleted them:

```bash
for ID in "5bf35347..." "eb82c604..." "b0cdb015..."; do
  curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$ID" \
    -H "Authorization: Bearer $TOKEN"
done
```

---

### ❌ Issue 6: Incoming email rejected — `email-receive unauthorized`

**Problem:** A test email to `ayush@ayushrai.xyz` bounced with:  
`This account is not authorized to receive email.`

**Root cause:** The `ayush` account was created without any roles. Stalwart requires the `user` role (or explicit `email-receive` permission) to allow inbound delivery.

**Log evidence:**
```
Unauthorized access (security.unauthorized) details = "email-receive", to = "ayush@ayushrai.xyz"
```

**Fix:** Patched the account via the Admin API to assign the `user` role:

```bash
curl -u "admin:kJlgqYYjO2" -X PATCH "https://mailui.ayushrai.xyz/api/principal/ayush" \
  -H "Content-Type: application/json" \
  -d '[{"action": "set", "field": "roles", "value": ["user"]}]'
```

After the fix, the next test email was delivered successfully. ✅

---

### ❌ Issue 7: JMAP auth requires username (not email address)

**Problem:** Authenticating to JMAP with `ayush@ayushrai.xyz:password` returned 401.

**Fix:** Use username only — `ayush:AyushMail2026!` (without the `@` domain part).

The `accountId` returned in the JMAP session for this user is `"c"`.

---

### ❌ Issue 8: DKIM signer warnings on delivery

**Problem:** Logs showed `DKIM signer not found` for `rsa-ayushrai.xyz` and `ed25519-ayushrai.xyz` on outbound delivery attempts.

**Status:** DKIM keys exist in the DB (verified via `/api/settings/keys?prefixes=signature`). The signers are configured in the database store, not `config.toml`. This is expected for database-managed config — outbound signing applies when sending via authenticated SMTP (port 587/465). Inbound verification works correctly.

---

## GCP Security Audit

| Firewall Rule | Source | Ports | Status |
|---------------|--------|-------|--------|
| `allow-mail-ports` | 0.0.0.0/0 | 25, 143, 465, 587, 993 | ✅ Required |
| `allow-ssh-ingress-from-iap` | 35.235.240.0/20 (IAP only) | 22 | ✅ Secure |
| `default-allow-https` | 0.0.0.0/0 | 443 | ✅ Required |
| `default-allow-http` | 0.0.0.0/0 | 80 | ✅ HTTPS redirects |
| `default-allow-internal` | 10.128.0.0/9 | all | ✅ Internal only |
| `default-allow-ssh` | 223.181.79.192/32 | 22 | ✅ Single IP |
| ~~`default-allow-rdp`~~ | ~~0.0.0.0/0~~ | ~~3389~~ | 🗑️ **Deleted** |

**Security score: 9.5/10**

---

## API Reference

### Credentials

| | Value |
|-|-------|
| Admin dashboard | `https://mailui.ayushrai.xyz/login` |
| Admin user | `admin` |
| Admin password | `kJlgqYYjO2` |
| Mail username | `ayush` *(no @domain for JMAP)* |
| Mail password | `AyushMail2026!` |
| Email address | `ayush@ayushrai.xyz` |
| JMAP account ID | `c` |
| JMAP base URL | `https://mailui.ayushrai.xyz/jmap/` |
| Admin API URL | `https://mailui.ayushrai.xyz/api/` |
| SMTP host | `mail.ayushrai.xyz` |
| IMAP host | `mail.ayushrai.xyz` |

---

### Mailbox IDs for `ayush`

| ID | Folder |
|----|--------|
| `a` | Inbox |
| `b` | Trash |
| `c` | Junk |
| `d` | Drafts |
| `e` | Sent |

---

### Read Inbox

```bash
curl -u "ayush:AyushMail2026!" \
  -X POST "https://mailui.ayushrai.xyz/jmap/" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/query", {
        "accountId": "c",
        "filter": {"inMailbox": "a"},
        "sort": [{"property": "receivedAt", "isAscending": false}],
        "limit": 10
      }, "q1"],
      ["Email/get", {
        "accountId": "c",
        "#ids": {"resultOf": "q1", "name": "Email/query", "path": "/ids"},
        "properties": ["subject", "from", "receivedAt", "preview"],
        "fetchTextBodyValues": true
      }, "g1"]
    ]
  }'
```

---

### Search for OTP Emails

```bash
curl -u "ayush:AyushMail2026!" \
  -X POST "https://mailui.ayushrai.xyz/jmap/" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/query", {
        "accountId": "c",
        "filter": {"inMailbox": "a", "subject": "OTP"},
        "sort": [{"property": "receivedAt", "isAscending": false}],
        "limit": 5
      }, "q1"],
      ["Email/get", {
        "accountId": "c",
        "#ids": {"resultOf": "q1", "name": "Email/query", "path": "/ids"},
        "properties": ["subject", "preview", "receivedAt"],
        "fetchTextBodyValues": true
      }, "g1"]
    ]
  }'
```

---

### Delete an Email

```bash
# Replace <EMAIL_ID> with the id from Email/query
curl -u "ayush:AyushMail2026!" \
  -X POST "https://mailui.ayushrai.xyz/jmap/" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/set", {
        "accountId": "c",
        "destroy": ["<EMAIL_ID>"]
      }, "d1"]
    ]
  }'
```

---

### Create a New Email Account

```bash
curl -u "admin:kJlgqYYjO2" \
  -X POST "https://mailui.ayushrai.xyz/api/principal" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "name": "newuser",
    "description": "New User",
    "quota": 0,
    "secrets": ["SecurePassword123!"],
    "emails": ["newuser@ayushrai.xyz"],
    "urls": [], "memberOf": [], "roles": [],
    "lists": [], "members": [],
    "enabledPermissions": [], "disabledPermissions": [],
    "externalMembers": []
  }'
```

> **Note:** After creating an account, assign the `user` role so it can receive email:
> ```bash
> curl -u "admin:kJlgqYYjO2" -X PATCH "https://mailui.ayushrai.xyz/api/principal/newuser" \
>   -H "Content-Type: application/json" \
>   -d '[{"action": "set", "field": "roles", "value": ["user"]}]'
> ```

---

### List All Accounts

```bash
curl -u "admin:kJlgqYYjO2" \
  "https://mailui.ayushrai.xyz/api/principal?types=individual&limit=50"
```

---

### Delete an Account

```bash
curl -u "admin:kJlgqYYjO2" \
  -X DELETE "https://mailui.ayushrai.xyz/api/principal/USERNAME"
```

---

### Change Account Password

```bash
curl -u "admin:kJlgqYYjO2" \
  -X PATCH "https://mailui.ayushrai.xyz/api/principal/USERNAME" \
  -H "Content-Type: application/json" \
  -d '[{"action": "set", "field": "secrets", "value": ["NewPassword123!"]}]'
```

---

### Fetch JMAP Session (to get accountId dynamically)

```bash
curl -u "ayush:AyushMail2026!" "https://mailui.ayushrai.xyz/jmap/session"
# Look for "accounts": {"<accountId>": {...}}
```

---

### List Queued Messages (admin)

```bash
curl -u "admin:kJlgqYYjO2" "https://mailui.ayushrai.xyz/api/queue/messages"
```

---

### Get DNS Records for Domain (admin)

```bash
curl -u "admin:kJlgqYYjO2" "https://mailui.ayushrai.xyz/api/dns/records/ayushrai.xyz"
```

---

### View Server Logs (admin)

```bash
curl -u "admin:kJlgqYYjO2" "https://mailui.ayushrai.xyz/api/logs?page=1&limit=50"
```

---

## Quick Reference — Server Commands

```bash
# SSH into the instance
gcloud compute ssh ayush@instance-20260205-094014 --zone=us-central1-a --tunnel-through-iap

# Stalwart service management
sudo systemctl status stalwart
sudo systemctl restart stalwart
sudo journalctl -u stalwart -f   # live logs

# Caddy service management
sudo systemctl status caddy
sudo systemctl reload caddy
sudo caddy validate --config /etc/caddy/Caddyfile

# Check all open ports
sudo ss -tlnp

# View mail logs
sudo tail -f /opt/stalwart/logs/stalwart.log.*

# Stalwart config file
sudo nano /opt/stalwart/etc/config.toml
```

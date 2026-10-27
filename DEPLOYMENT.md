# Deploying SikaTrack (backend and pipeline)

How to run the backend API and the data pipeline on one free Oracle Cloud server, talking to
each other, with HTTPS. The mobile app comes after; this gets the server side live first.

```text
Phone ──HTTPS──► Caddy (80/443) ──► API ──► Postgres warehouse ◄── Airflow pipeline
                                     │            ▲                     │
                                     └──► RustFS (raw SMS) ─────────────┘
```

Only Caddy is reachable from the internet. Postgres, RustFS, Airflow and Metabase listen on the
server itself (`127.0.0.1`), and you reach their admin pages through an SSH tunnel.

## What it costs

| Part | Cost |
|---|---|
| Server: Oracle Cloud Always Free, ARM, 4 CPUs, 24 GB memory, up to 200 GB disk | Free |
| Domain: a DuckDNS name such as `sikatrack.duckdns.org` | Free |
| HTTPS certificate: Let's Encrypt, through Caddy | Free |
| Sign-in SMS: Arkesel, topped up with mobile money | A few pesewas per code |

Every image in the stack has an ARM (`arm64`) build, so all of it runs on Oracle's ARM server.

## Before you start

- **Arkesel:** an API key, SMS credit, and the sender ID (`SikaTrack`) showing **Approved**.
  Without the approval, sign-in codes are refused.
- **Oracle Cloud account:** sign up for Always Free at cloud.oracle.com. The card is for identity
  only. Pick the **home region** carefully, as it can't change later: one near Ghana with Always
  Free ARM capacity, such as UK South (London) or Germany Central (Frankfurt).
- **DuckDNS account:** at duckdns.org (sign in with GitHub or Google), claim a name.
- **An SSH key on your laptop:** `ssh-keygen -t ed25519` in PowerShell if you have none
  (`C:\Users\<you>\.ssh\id_ed25519.pub` is the public half you give Oracle).

## 1. Create the server

In the Oracle console: **Compute → Instances → Create instance**.

- **Image:** Canonical Ubuntu 24.04 (the build for **aarch64**).
- **Shape:** **Ampere → VM.Standard.A1.Flex**, 4 OCPUs, 24 GB memory.
- **Networking:** the default new VCN with a public subnet; **assign a public IPv4 address**.
- **SSH key:** paste your `id_ed25519.pub`.
- **Boot volume:** 100 GB or more (up to 200 GB is free).

"Out of capacity" is common for A1: try again later, or another availability domain.

**Open ports 80 and 443 in Oracle's firewall.** In the instance's subnet:
**Security List → Add Ingress Rules**, source `0.0.0.0/0`, TCP, destination ports `80` and
`443`. (Port 22 is open already.)

## 2. Point the domain at the server

On duckdns.org, set your name's **current ip** to the instance's public IP and click update.
Check from your laptop: `nslookup sikatrack.duckdns.org` should answer that IP.

## 3. Prepare the server

```bash
ssh ubuntu@<public-ip>

# Updates, and Oracle's Ubuntu image blocks 80/443 in its own firewall too: open them
sudo apt update && sudo apt -y upgrade
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# SSH by key only
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Docker, started on every boot
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
exit   # log in again so the docker group applies
```

## 4. Get the code

The repository is on GitHub. If it's private, create a **personal access token** (GitHub →
Settings → Developer settings → Fine-grained tokens, read-only access to this repository) and use
it as the password when cloning.

```bash
ssh ubuntu@<public-ip>
git clone https://github.com/Jerry-Khobby/SikaTrack.git
cd SikaTrack
```

Keep the folder names as they are: Docker names the shared network after the
`data-engineering` folder (`data-engineering_sikatrack`), and the backend joins it by that name.

## 5. Production settings

Generate every secret fresh on the server; never reuse your laptop's.

```bash
new() { openssl rand -base64 48 | tr -d '/+=' | cut -c1-40; }   # a random 40-character value
```

Run `new` once per secret below and paste the result.

### `data-engineering/.env`

```bash
cd ~/SikaTrack/data-engineering && cp .env.example .env && nano .env
```

| Setting | Value |
|---|---|
| `HOST_BIND_ADDRESS` | `127.0.0.1` (keep: the database, lake and admin pages stay off the internet) |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | New values (`new`) |
| `WAREHOUSE_PASSWORD` | New |
| `AIRFLOW_ADMIN_PASSWORD`, `AIRFLOW_DB_PASSWORD`, `AIRFLOW_JWT_SECRET`, `AIRFLOW_API_SECRET_KEY` | New, each |
| `AIRFLOW_FERNET_KEY` | `docker run --rm python:3.11-slim sh -c "pip -q install cryptography && python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"` |
| `INTERNAL_API_TOKEN` | New; **the same value goes in the backend's `.env`** |
| `BACKEND_INTERNAL_URL` | `http://api:8000` (keep) |
| `OWNER_NAMES`, `OWNER_NUMBERS`, `LEGACY_OWNER_USER_ID` | Empty: on a fresh server, your own transfers come from your verified wallets in the app |
| `EMAIL_USER`, `EMAIL_PASS`, `ALERT_EMAIL_TO` | So failed runs email you. With Gmail, `EMAIL_PASS` is an **app password** (Google Account → Security → App passwords) |
| `METABASE_DB_PASSWORD`, `METABASE_READER_PASSWORD` | New, each |

### `backend/.env`

```bash
cd ~/SikaTrack/backend && cp .env.example .env && nano .env
```

| Setting | Value |
|---|---|
| `ENVIRONMENT` | `production` (turns off `/docs`; refuses printed sign-in codes) |
| `API_DOMAIN` | Your DuckDNS name, e.g. `sikatrack.duckdns.org` |
| `DATABASE_PASSWORD` | New (the API's own database login; created for you on first start) |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | **The same values** as in `data-engineering/.env` |
| `JWT_SECRET`, `OTP_PEPPER` | New, each (at least 32 characters) |
| `INTERNAL_API_TOKEN` | **The same value** as in `data-engineering/.env` |
| `AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD` | `AIRFLOW_ADMIN_USER` and `AIRFLOW_ADMIN_PASSWORD` from `data-engineering/.env` |
| `OTP_PROVIDER` | `arkesel` |
| `ARKESEL_API_KEY`, `ARKESEL_SENDER` | Your key, and the sender ID exactly as approved (`SikaTrack`) |
| `PUSH_PROVIDER` | `disabled` until the app registers for push |

The server's addresses (`DATABASE_HOST`, `S3_ENDPOINT`, `AIRFLOW_URL`) are set by
`docker-compose.yml` inside Docker; leave the `.env` ones as they are.

## 6. Start it

The data stack first (the backend joins its network), then the backend:

```bash
cd ~/SikaTrack/data-engineering && docker compose up -d --build
docker compose ps        # wait until warehouse, rustfs and airflow-* are healthy (a few minutes)

cd ~/SikaTrack/backend && docker compose up -d --build
docker compose ps        # api healthy, proxy up; api-db-init and api-migrate exited (0)
```

Every service has `restart: unless-stopped`, so after a reboot Docker brings it all back.

**Switch the pipeline on.** Airflow creates new DAGs paused, so runs the backend asks for would
wait forever. Reach Airflow through a tunnel from your laptop:

```powershell
ssh -L 8080:127.0.0.1:8080 ubuntu@<public-ip>
```

Open http://localhost:8080, sign in with `AIRFLOW_ADMIN_USER` / `AIRFLOW_ADMIN_PASSWORD`, and
switch **on** `sikatrack_pipeline` and `sikatrack_monitoring`.

## 7. Check it works

From your laptop:

```powershell
curl https://sikatrack.duckdns.org/health     # {"status":"ok",...}
curl https://sikatrack.duckdns.org/v1/config  # the app's config
```

The first request may take a few seconds while Caddy gets the certificate.

**End to end, with the app** (a development build, as in [mobile/README.md](mobile/README.md)):

1. Start the app pointed at the server: `EXPO_PUBLIC_API_URL=https://sikatrack.duckdns.org`.
2. Sign in: the code now arrives by SMS from **SikaTrack**.
3. Add your wallet and let the first sync upload your MoMo SMS.
4. About two minutes later the backend triggers the pipeline: watch the run in Airflow (tunnel).
5. When it succeeds, payments turn from **Processing** to confirmed, and balances fill in.

On the server, `docker compose logs -f api` (in `backend/`) shows each step; failures in the
pipeline also email you.

## 8. Backups

The raw SMS in RustFS are the source of truth (the warehouse can be rebuilt from them); the
warehouse holds what the pipeline made of them plus everything users set in the app.

A nightly dump of the warehouse, kept for 14 days:

```bash
mkdir -p ~/backups
crontab -e
```

```cron
30 2 * * * docker exec sikatrack-warehouse sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > ~/backups/warehouse-$(date +\%F).dump && find ~/backups -name 'warehouse-*.dump' -mtime +14 -delete
```

Copy `~/backups` **off the server** regularly: a backup on the same disk doesn't survive losing
the server. `rclone` can sync it to Google Drive or Oracle's free Object Storage.

## 9. Updating

```bash
cd ~/SikaTrack && git pull
cd data-engineering && docker compose up -d --build
cd ../backend && docker compose up -d --build   # database migrations run on their own
```

## When something's wrong

| Symptom | Likely cause |
|---|---|
| `curl https://…` times out | Ports 80/443 closed: the Security List (step 1) **and** the server's iptables (step 3) |
| Certificate errors | DuckDNS doesn't point at the server yet, or port 80 is closed (Let's Encrypt checks through it) |
| API won't start: "OTP_PROVIDER=console prints sign-in codes" | `ENVIRONMENT=production` with `OTP_PROVIDER=console`: set `arkesel` |
| "We couldn't send your code" in the app | Arkesel refused: credit, the sender ID's approval, or the key. `docker compose logs api` shows Arkesel's reason |
| Uploads stay **Processing** | `sikatrack_pipeline` is paused in Airflow, or `AIRFLOW_PASSWORD` doesn't match `AIRFLOW_ADMIN_PASSWORD` |
| Runs succeed but the batches never load | `INTERNAL_API_TOKEN` differs between the two `.env` files |
| Containers keep restarting | `docker compose logs <service>`; usually a missing or mistyped `.env` value |

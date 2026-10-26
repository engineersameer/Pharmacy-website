# CarePoint Pharmacy API

Django 6.1 + Django REST Framework + PostgreSQL 16 backend for the CarePoint website (`../carepoint-react`).

## Run it on your laptop

```bash
./scripts/db.sh start                       # private Postgres on port 5434 (does not touch Docker)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createcachetable
.venv/bin/python manage.py runserver 8001   # http://localhost:8001
```

The React site forwards `/api/...` to port 8001 (see `carepoint-react/.env.local`).
Stop the database with `./scripts/db.sh stop`.

**First-time setup** on a new machine: Python 3.12 and Postgres 16 from Homebrew, then
`python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt`, then create `.pgdata`
and `.env` (see `.env.example`).

## Admins

There is no sign-up page. Admins are added from the command line:

```bash
.venv/bin/python manage.py add_admin ayesha@carepoint.pk --first-name Ayesha
.venv/bin/python manage.py list_admins
.venv/bin/python manage.py remove_admin ayesha@carepoint.pk   # logs them out everywhere
```

Login: the admin enters their email, gets a 6-digit code (printed in the `runserver`
terminal on your laptop, emailed in production), and stays logged in for 14 days of use.

## Dummy orders for testing

```bash
.venv/bin/python manage.py seed_demo_orders
```

Adds 10 realistic orders (uploads, refills, every status, warnings) with fake prescription
photos. Only works with `DEBUG=true`, so it can never run on the real server. Refresh the
staff dashboard afterwards to see them.

## Tests

```bash
.venv/bin/python manage.py test tests
```

## Who can use which URL

The full list is at the top of `config/urls.py`. Every endpoint needs a logged-in admin
**by default**; only `GET /api/store`, `POST /api/refills`, `POST /api/prescriptions` and the
login endpoints are opened to the public, each explicitly.

## Security rules for production

- `.env` on the server: `DEBUG=false`, a new `SECRET_KEY`, `NUM_PROXIES=1` (see `.env.example`).
- Nginx: `client_max_body_size 32M;`, send `X-Forwarded-For $remote_addr` and `X-Forwarded-Proto $scheme`,
  and never point `root` or `alias` at `MEDIA_ROOT`. Prescription files are only served through
  `/api/admin/prescriptions/<id>/file`.
- Django listens on `127.0.0.1` (or a unix socket) only, never on a public port.
- Run `manage.py check --deploy` on the server; it should report no issues.

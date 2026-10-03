# AI Academy360

AI-powered student support, academy management, and complaint resolution platform.

## Project structure

- `frontend/` – Vite + React + TypeScript app
- `backend/` – Express + TypeScript API server
- `database/` – SQL schema foundation

## Database and authentication setup

The backend uses MySQL 8, bcrypt password hashes, and short-lived JWT bearer tokens. The frontend keeps its token in memory only; refreshing the page signs the user out. Use HTTPS when deploying outside localhost.

AI Support requires a valid `AI_API_KEY` and provider-supported `AI_MODEL` in `backend/.env`. Requests are made only by the backend. If either value is missing or the provider fails, the API returns an unavailable/error response and does not create a ticket or fabricate analysis.

1. Configure `backend/.env` with a MySQL user that can create/use `ai_academy360`, a strong `JWT_SECRET` of at least 32 characters, and `JWT_EXPIRES_IN`. Do not commit `.env` or send its secrets through chat. Generate a local JWT secret in PowerShell with:

	```powershell
	[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
	```

2. From the project root, apply the schema. MySQL will prompt for the database password:

	```powershell
	mysql --host=localhost --user=root --password --execute="source database/schema.sql"
	```

3. Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, and a private `SEED_ADMIN_PASSWORD` of 12-72 bytes in `backend/.env`. Seed the first management account:

	```powershell
	Set-Location backend
	npm run seed:admin
	```

4. Start the backend and frontend in separate terminals:

	```powershell
	Set-Location backend
	npm run dev
	```

	```powershell
	Set-Location frontend
	npm run dev -- --port 5174
	```

The backend health checks are `/api/health` and `/api/health/db`. Admin and student records are protected by separate roles. Student IDs are generated transactionally by the backend; student profile queries derive the account from the JWT identity.

## Admin management schema and verification

The existing `courses`, `classes`, `resources`, `learning_tasks`, `attendance`, `course_progress`, `payments`, `certificates`, `internships`, and `announcements` tables are reused by the admin controls. After applying the base and student-dashboard schemas, add the admin-only metadata columns with this additive migration:

```powershell
Set-Location backend
npm run migrate:admin-management
```

The migration adds optional course instructor, class meeting link, payment method and due date, internship details, and announcement scheduling/expiry fields. It does not drop tables, rewrite prior payment amounts, or delete records. New admin-recorded payments use INR; legacy rows keep their existing currency.

Admin CRUD data-flow verification (uses temporary records and removes only those records) is available via:

```powershell
npm run verify:admin-management
```

## Development commands

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

### Backend

```bash
cd backend
npm install
npm run dev
npm run build
```

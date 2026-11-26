# Agentic-Recovery Runbook

## Startup

### Prerequisites
- Python 3.12+ (`.venv` at `D:\Agentic-Recovery\.venv`)
- PostgreSQL database (production) or SQLite (local testing)
- Android SDK at `D:\Android\Sdk`
- AVD `AgenticMobile0001` at `D:\Agentic-Android\AVD`

### Local Development (SQLite)
```powershell
# Activate virtual environment
D:\Agentic-Recovery\.venv\Scripts\Activate.ps1

# Copy environment template
Copy-Item .env.example .env

# Edit .env with local values (DATABASE_URL can use SQLite for testing)
# DATABASE_URL=sqlite:///D:\Agentic-Recovery\data\app.db

# Run database migrations
D:\Agentic-Recovery\.venv\Scripts\python.exe -m alembic upgrade head

# Start the FastAPI server
D:\Agentic-Recovery\.venv\Scripts\uvicorn recovery.server:create_app --factory --reload --host 127.0.0.1 --port 8000
```

### Production (PostgreSQL)
```powershell
# Set DATABASE_URL to PostgreSQL in .env
# DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/db

# Run migrations
D:\Agentic-Recovery\.venv\Scripts\python.exe -m alembic upgrade head

# Start server
D:\Agentic-Recovery\.venv\Scripts\uvicorn recovery.server:create_app --factory --host 0.0.0.0 --port 8000
```

## Shutdown
```powershell
# Ctrl+C to stop the server
# No persistent processes to clean up for local SQLite
# For PostgreSQL, no shutdown procedure required
```

## Rollback

### Database Rollback
```powershell
# Rollback one migration
D:\Agentic-Recovery\.venv\Scripts\python.exe -m alembic downgrade -1

# Rollback to specific revision
D:\Agentic-Recovery\.venv\Scripts\python.exe -m alembic downgrade <revision_id>
```

### Code Rollback
```powershell
git checkout <previous_commit>
```

## Verification

### Run Tests
```powershell
D:\Agentic-Recovery\.venv\Scripts\python.exe -m pytest tests/test_recovery.py -v
```

### Health Check
```powershell
# Server should respond on http://127.0.0.1:8000/docs
curl http://127.0.0.1:8000/api/tenants
```

## Android AVD Management

### Start AVD
```powershell
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:ANDROID_AVD_HOME = "D:\Agentic-Android\AVD"
D:\Android\Sdk\emulator\emulator -avd AgenticMobile0001
```

### List AVDs
```powershell
D:\Android\Sdk\cmdline-tools\latest\bin\avdmanager.bat list avd
```

### Check Devices
```powershell
D:\Android\Sdk\platform-tools\adb devices
```

## File Locations
See `FILE-LOCATIONS.md` for complete manifest of all project files and paths.

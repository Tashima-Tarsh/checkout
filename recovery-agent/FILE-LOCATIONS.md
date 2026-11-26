# Agentic-Recovery File Locations Manifest

All paths are absolute on the D: drive, integrated under D:\checkout\checkout\recovery-agent\

## Project Root
- D:\checkout\checkout\ — checkout repository root (main workspace)
- D:\checkout\checkout\recovery-agent\ — recovery agent integration directory

## Recovery Agent Source Code
- D:\checkout\checkout\recovery-agent\recovery\__init__.py — package init
- D:\checkout\checkout\recovery-agent\recovery\models.py — SQLAlchemy ORM models
- D:\checkout\checkout\recovery-agent\recovery\storage.py — database engine and session helpers
- D:\checkout\checkout\recovery-agent\recovery\api.py — FastAPI routes and endpoints
- D:\checkout\checkout\recovery-agent\recovery\server.py — FastAPI app factory and lifespan

## Configuration
- D:\checkout\checkout\recovery-agent\config\policy.json — business policy configuration
- D:\checkout\checkout\recovery-agent\config\upstreams.json — upstream repository references
- D:\checkout\checkout\recovery-agent\.env.example — environment variable template (no secrets)

## Database Migrations
- D:\checkout\checkout\recovery-agent\migrations\alembic.ini — Alembic configuration
- D:\checkout\checkout\recovery-agent\migrations\env.py — Alembic environment
- D:\checkout\checkout\recovery-agent\migrations\versions\0001_initial.py — initial migration

## Tests
- D:\checkout\checkout\recovery-agent\tests\test_recovery.py — unit and integration tests (19 tests, all passing)

## Skills
- D:\checkout\checkout\recovery-agent\skills\SKILL.md — recovery skill definition

## Adapters
- D:\checkout\checkout\recovery-agent\adapters\README.md — adapter boundary documentation

## n8n Workflows
- D:\checkout\checkout\recovery-agent\n8n\agentic-mobile-observation.json — importable n8n workflow

## Documentation
- D:\checkout\checkout\recovery-agent\README.md — project readme
- D:\checkout\checkout\recovery-agent\RUNBOOK.md — startup, shutdown, rollback procedures
- D:\checkout\checkout\recovery-agent\FILE-LOCATIONS.md — this file

## Android SDK (shared with checkout project)
- D:\Android\Sdk\ — Android SDK root
- D:\Android\Sdk\cmdline-tools\latest\ — SDK command-line tools
- D:\Android\Sdk\platform-tools\ — adb, fastboot
- D:\Android\Sdk\emulator\ — Android emulator
- D:\Android\Sdk\platforms\android-34\ — Android 14 platform
- D:\Android\Sdk\system-images\android-34\google_apis\x86_64\ — system image

## Android Virtual Device
- AgenticMobile0001 — Pixel 7, Android 14, Google APIs, x86_64
- AVD directory: D:\Agentic-Android\AVD\ (configured via ANDROID_AVD_HOME)
- Android logs: D:\Agentic-Android\Logs\

## Python Virtual Environment
- D:\Agentic-Recovery\.venv\ — Python virtual environment (used for running tests)

## GitHub
- Repository: https://github.com/Tashima-Tarsh/checkout
- Feature branch: feature/recovery-agent-integration
- Authenticated user: Tashima-Tarsh

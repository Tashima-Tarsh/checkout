# Adapter Boundaries

This directory documents the interfaces between Agentic-Recovery and upstream systems.

## Adapter Pattern

All upstream integrations use pinned adapter boundaries — no blind source merges. Each adapter:
- Is version-pinned to a specific commit SHA
- Exposes a documented contract
- Is isolated in the `upstream/` directory (excluded from integration repo)
- Is reviewed for license compatibility before use

## Upstream Repositories

| Upstream | Purpose | URL | Status |
|---|---|---|---|
| paperclip | Company and employee management | https://github.com/paperclipai/paperclip | Not cloned |
| openclaw | Primary runtime and skills | https://github.com/openclaw/openclaw | Not cloned (preferred) |
| mobilerun | Authorized mobile interface research | https://github.com/droidrun/mobilerun | Not cloned (observation testing only) |
| agency-agents | Role templates | https://github.com/msitarzewski/agency-agents | Not cloned |
| hermes-agent | Alternative runtime (fallback) | https://github.com/NousResearch/hermes-agent | Not cloned (disabled) |
| Open-AutoGLM | Alternative mobile interface | https://github.com/zai-org/Open-AutoGLM | Not cloned (disabled) |

## Integration Guidelines

1. **Review licenses** before cloning any upstream
2. **Review dependencies** and security guidance
3. **Review actual documented APIs** at pinned revisions
4. **Do not execute unreviewed setup scripts**
5. **Do not grant blanket shell/device permissions**
6. **Keep alternative runtimes disabled** unless measured advantages justify them

## Mock Adapter

All automated tests use a mock adapter for Android device communication. No real device access is required for testing.

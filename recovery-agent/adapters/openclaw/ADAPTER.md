# OpenClaw Adapter — Recovery Employee Runtime

## Pinned Upstream
- Repository: https://github.com/openclaw/openclaw.git
- Pinned SHA: 65a8bc8eac70ec33e82710b1e91afb97861447bc
- Branch: main
- Purpose: Primary runtime and skills for recovery employees

## Adapter Boundary

Maps OpenClaw agent/runtime concepts to Agentic-Recovery's employee agent model.

### Contract: Agent Runtime ↔ Recovery Agent
| OpenClaw concept | Recovery mapping | Field |
|---|---|---|
| Agent | Mobile Agent | `ap_mobile_agents.id`, `ap_mobile_agents.device_id` |
| Agent state | Processing state | `ap_mobile_agents.processing_state` |
| Agent cursor | Observation cursor | `ap_mobile_agents.observation_cursor` |
| Worker pool | Shared inference pool | Local process pool (not OpenClaw) |

### Skill: Recovery Employee Skill
- `create_checkout` — create checkout for assigned employee
- `report_observation` — submit authenticated observation
- `lookup_ledger` — query employee ledger
- `escalate` — flag transaction for review

### Constraints (least privilege)
- Agent cannot change amounts
- Agent cannot assign its own receiver
- Agent cannot generate reference numbers
- Agent cannot trigger transfers
- Agent cannot declare settlement (financially_verified requires separate evidence)

## License Status
REVIEW_REQUIRED — verify before production activation.

## Integration Status
ACTIVE (synthetic mode) — Runtime implemented locally in FastAPI.
No OpenClaw source code executed. No external API calls.
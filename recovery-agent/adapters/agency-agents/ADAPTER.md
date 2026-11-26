# Agency Agents Adapter — Role Definitions

## Pinned Upstream
- Repository: https://github.com/msitarzewski/agency-agents.git
- Pinned SHA: 8ae6164602c95ca78828b148b9052460ee426885
- Branch: main
- Purpose: Role templates for recovery agents

## Role Definitions (implemented locally)

### Role: owner
- Permissions: tenant.read, tenant.write, employee.read, employee.write,
  device.read, device.write, checkout.read, observation.read, ledger.read,
  ledger.write, n8n.trigger, dashboard.read, dashboard.write
- Can: create companies, employees, devices, agents; view all ledgers;
  escalate any transaction; configure n8n workflows
- Cannot: initiate payments, access customer data, modify amounts

### Role: collection_manager
- Permissions: employee.read, device.read, checkout.read, checkout.write,
  observation.read, ledger.read, escalate
- Can: create checkouts for assigned employees; view employee ledgers;
  escalate transactions for review
- Cannot: modify device assignments, change amounts, declare settlement

### Role: recovery_employee
- Permissions: checkout.read (own), observation.write (own device),
  ledger.read (own employee)
- Can: create checkout using assigned device UPI ID; report observations;
  view own ledger entries
- Cannot: modify device assignments, view other employees' data,
  declare settlement

### Role: auditor
- Permissions: audit.read, observation.read, ledger.read (all tenants)
- Can: view audit trail, all observations, all ledger entries
- Cannot: modify any data, initiate payments, configure workflows

## Role Assignment
Each `ap_employees` row has an implicit role based on creation context.
Role enforcement happens at the API middleware level via tenant-scoped
authorization.

## License Status
REVIEW_REQUIRED — verify before production activation.

## Integration Status
ACTIVE (synthetic mode) — Role definitions implemented locally in API middleware.
No Agency Agents source code executed.
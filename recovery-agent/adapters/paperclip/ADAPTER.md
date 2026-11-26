# Paperclip Adapter — Company & Employee Management

## Pinned Upstream
- Repository: https://github.com/paperclipai/paperclip.git
- Pinned SHA: dadbc495b3cbdc171fddc40d09aafcc3e9206305
- Branch: master
- Purpose: Company and employee management

## Adapter Boundary

This adapter does NOT clone Paperclip source into the checkout repo. It defines
a contract boundary that maps Paperclip company/employee concepts to
Agentic-Recovery's tenant/employee model.

### Contract: Company ↔ Tenant
| Paperclip concept | Recovery mapping | Field |
|---|---|---|
| Company | Tenant | `ap_tenants.id`, `ap_tenants.name` |
| Company owner | Tenant owner | `ap_tenants.created` by owner |

### Contract: Employee ↔ Recovery Employee
| Paperclip concept | Recovery mapping | Field |
|---|---|---|
| Employee | Employee | `ap_employees.id`, `ap_employees.name`, `ap_employees.email` |
| Employee assignment | Assigned device | `ap_employees.assigned_device_id` |
| Employee status | Active flag | `ap_employees.is_active` |

### Adapter Methods (implemented locally, no upstream code)

- `register_company(company_id, name)` → creates `ap_tenants` row
- `register_employee(employee_id, company_id, name, email)` → creates `ap_employees` row
- `assign_device_to_employee(employee_id, device_id)` → updates `ap_employees.assigned_device_id`
- `list_employees(company_id)` → queries `ap_employees` filtered by tenant
- `get_employee_device(employee_id)` → joins `ap_employees` → `ap_android_devices`

## License Status
REVIEW_REQUIRED — Apache-2.0 or similar; verify before production activation.

## Integration Status
ACTIVE (synthetic mode) — Company/employee data stored locally in PostgreSQL/SQLite.
No upstream code executed. No external API calls to Paperclip.
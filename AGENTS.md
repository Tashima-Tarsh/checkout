# Engineering rules

Develop an original P2P/P2M debit evidence protocol using testable hypotheses and Autoresearch-style keep/reject experiments. Treat the payer device as hostile. No screenshot, UTR, browser resume, or synthetic local signing may set financially_verified=true. MCC is optional P2M metadata, not debit evidence.

## Enterprise Hierarchy (Product Model)

Super Admin (Owner) → Merchant → Agent Mobile → UPI Accounts

- **Super Admin**: Holds `PDEP_ADMIN_TOKEN` + `PDEP_ADMIN_IP_ALLOWLIST`. Assigns merchants, audits all activity.
- **Merchant** (`ap_merchants`): Registered business/firm. Owns UPI accounts, sees only own orders/audit.
- **Agent Mobile** (`ap_devices`, `ap_agent_sessions`): Registered Android device bound to one merchant and one agent_id. Registers merchant UPI + mobile. ₹70,000 daily collection cap per device.
- **UPI Account** (`ap_accounts`): Encrypted VPA/bank/holder/mobile bound to a merchant. Designed for up to 15 per agent mobile.

Research references:
- https://github.com/karpathy/autoresearch
- https://github.com/multica-ai/andrej-karpathy-skills
- https://github.com/orchestra-research/AI-research-SKILLs
- https://github.com/android/skills
- https://github.com/vibhasdutta/loop-engineer

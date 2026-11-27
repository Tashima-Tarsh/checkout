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

## Frontend — Prism Enterprise Design System

The checkout/SaaS frontend is vanilla HTML/CSS/JS (no React migration — existing FastAPI + static-file stack retained). All frontend assets live in `checkout/static/`.

### Design system
- `checkout/static/prism.css` — Prism Enterprise tokens: pearl/champagne/emerald/opal palette, liquid-glass materials (`prism-glass`, `pearl-glass`, `crystal-glass`, `emerald-glass`, `champagne-metal`, `opal-glass`), stat tiles, badges, tables, alerts, empty states, responsive breakpoints (320–2560px), reduced-motion support.
- `checkout/static/prism.js` — Shared JS utilities: API client (`api()`), INR formatting (`inr()`), badge rendering (`badgeHtml()`), toast, page router (`showPage()`/`navLinkActive()`).

### Portals (standalone HTML pages)
- `checkout/static/owner-dashboard.html` — Super Admin control center: dashboard stat tiles, merchant/agent/transaction/receipt tables, Theme Studio, Checkout Studio, Receipt Studio, API keys, IP whitelist, audit logs.
- `checkout/static/merchant-portal.html` — Merchant Portal: dashboard, create checkout, transactions, UPI accounts (max 15/device), receipts, branding, API keys.
- `checkout/static/agent-portal.html` — Agent Portal: dashboard, active checkouts, refunds, history, device management, UPI app switcher (11 pre-installed apps), worker fleet (15 workers).
- `checkout/static/checkout.html` — Customer Checkout (Prism Rupee): 2-action flow (device verification + copy UPI ID), unique order ID, 120s time-bound window, auto-verification polling, fail-closed (financially_verified stays 0 until server match).
- `checkout/static/receipt.html` — Transaction Receipt (Prism Signature): ivory-paper design, UTR/RRN, SHA-256 audit trail, PDF download, copy UTR.

### Security posture (preserved)
- Payer device treated as hostile. No screenshot, UTR, browser resume, or synthetic local signing may set `financially_verified=true`.
- Financially verified remains 0 until server-confirmed debit match.
- MCC is optional P2M metadata, not debit evidence.
- All auth via `PDEP_ADMIN_TOKEN` / device bearer tokens; tenant isolation enforced on backend.

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context
### Terminology:
- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html
### Constraints:
- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region).
When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- For any AWS task or question — building, configuring, migrating, debugging, or operating a service, writing SDK code, authoring CDK/CloudFormation, or answering how a service works — first call `aws___search_documentation` with topic `agent_skills` and load the matching skill with `aws___retrieve_skill`. Do this even when you believe you know the answer: skills carry current service behavior that your training may not. Prefer the skill's guidance over general knowledge.
Skip it only for work that does not involve AWS.
### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**
- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**
- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**
- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion
<!-- END AWS Agent Toolkit rules -->

# DISHA 8.2 — AWS implementation brief for Codex

Build the Agentic UPI Payment Verification Platform for DishaNitish Technologies. Use AWS in ap-south-1, Cloudflare DNS, GitHub as the primary repository, and per-product AWS backup. The platform starts with zero merchants. Size the first deployment for one merchant and retain a path to scale.

**Generate and test code, configurations, and runbooks only. Do not create AWS resources, apply IaC, deploy, or change live DNS.** Review the existing repository before implementing. Preserve the existing checkout and its payer-side debit-evidence rules. Merchant webhook delivery reports platform status and does not supply payer debit proof. Keep financial verification disabled until genuine debit evidence is established.

## Infrastructure and identity

1. Put Terraform or CDK in `infra/` with separate Dev, UAT, and Prod configurations. Dev and UAT are workforce-only. Merchant signup, dashboard, checkout, and merchant subdomains exist only in Prod.
2. Use a VPC per environment with public and private subnets across AZs. Keep backend instances and databases off public IPs. Place the public ALB in Prod public subnets and restrict app port 8080 to the ALB security group. Restrict database port 5432 to the app security group. Use HTTPS on 443 and redirect HTTP on 80. Document private access for Dev/UAT. Include VPC endpoints for S3 and Secrets Manager and document the distinction between RDS API endpoints and private PostgreSQL connections. Configure WAF at the chosen ALB or CloudFront ingress and document Shield Standard coverage.
3. Define AWS IAM Identity Center for workforce access, least-privilege environment roles, workload roles, Secrets Manager per environment, a customer-managed KMS key per merchant, and a Prod Cognito user pool for merchant signup and login. Isolate access to merchant records, keys, and dashboard data by tenant and role.
4. Compare EC2 t3.micro/t3.small with Docker Compose against minimal ECS Fargate (0.5 vCPU, 1 GB) and document the chosen baseline. Use Lambda for webhook delivery workers and trial expiration jobs. Configure bounded scaling. Document the availability characteristics of the chosen deployment, including what is required for zero-downtime releases.
5. Use Multi-AZ RDS PostgreSQL in Prod and Single-AZ in Dev/UAT, with seven-day automated backup retention. Include ElastiCache Redis and private encrypted S3. Consider DynamoDB for session and observation data only where justified.

## Production merchant experience

- Implement a signup frontend and backend for business name, GST number, bank account, expected monthly volume, and contact email. Protect bank details and avoid logging them.
- Offer monthly and annual subscription options with tiers indexed to estimated monthly volume from ₹10 lakh to ₹1,000 crore. Keep tier boundaries and prices configurable and flag missing commercial values.
- Start a one-day trial at signup. Enforce gating server-side after expiry. A merchant without an active paid subscription has read-only access. Make trial expiry and subscription updates idempotent.
- Implement the proposed 3% MDR model and 50/50 merchant and platform split. Include a savings calculator comparing traditional aggregator MDR plus setup and AMC with the DISHA split plus subscription. Make assumptions visible. Verify applicable rules before enabling actual fee collection and keep modeled fees separate from live charging.
- Provide merchant dashboard views for orders, verification status, daily collection limits, API keys, and outbound webhooks. Enforce the ₹70,000 daily cap per agent mobile with atomic accounting, duplicate protection, and concurrent request handling. Document the timezone, reservation lifecycle, and treatment of expired and reversed payments.
- Provision dedicated Prod subdomains by merchant slug. Validate host-to-tenant routing and reserve platform hostnames.

## Cloudflare DNS and exposure

Use a user-owned domain such as `disha82.com`. Use Cloudflare DNS and Universal SSL with authenticated origin TLS. Document A/CNAME and certificate validation records pointing to AWS ALB or CloudFront. Use the following mapping.

| Environment | Hostname | Audience and purpose |
|---|---|---|
| Prod | api.<domain> | Public checkout and verification API |
| Prod | signup.<domain> | Merchant signup and tier selection |
| Prod | dashboard.<domain> | Authenticated merchant dashboard |
| Prod | <merchant-slug>.<domain> | Dedicated merchant website |
| Prod | admin.<domain> | Restricted super admin console |
| Prod | health.<domain> | Minimal public health status |
| Dev | api-dev.<domain>, signup-dev.<domain> | Workforce only |
| UAT | api-uat.<domain>, signup-uat.<domain> | Workforce only |

Enforce internal access at the network and identity layers. Keep Dev and UAT URLs out of merchant-facing pages and communications.

## Backup, delivery, and operations

- Write the Railway-to-AWS migration runbook, including data inventory, encrypted transfer, restore rehearsal, validation, cutover, and rollback. Preserve production checkout data.
- Mirror each product repository into encrypted AWS CodeCommit and provide private encrypted S3 backup instructions. Document weekly encrypted RDS snapshot exports to S3, retention, and recovery. Explain the restore path for native database snapshots and exported data.
- Define GitHub Actions with AWS OIDC and environment-specific roles. Promote Dev → UAT → Prod with manual Prod approval, pytest, and an Android APK build before promotion. Include IaC validation and Terraform plan or CDK diff on PRs. Document review controls, secrets handling, and deployment permissions.
- Write GitHub Projects Free setup instructions for a backlog, two-week sprints, burndown tracking, and PR-to-issue linkage.
- Define Prod CloudWatch Synthetics canaries, CloudWatch alarms for 5xx >1%, latency >2s, and CPU >80%, X-Ray tracing, and SNS email/mobile notification setup. Route Dev/UAT alerts to developers only. Define the availability metric and health checks used for merchant SLA reporting.
- Configure AWS Budgets notifications at 50%, 80%, and 100% of the monthly target. Include Cost Explorer and credit burn tracking, with an alert at less than 20% credit remaining where supported. Parameterize admin and developer alert endpoints. Schedule eligible Dev/UAT resources to stop at night and on weekends. Use bounded capacity and spending controls and document which costs persist and where a hard account-wide spending cap cannot be guaranteed.

## Cost workbook

Deliver a spreadsheet with monthly Dev, UAT, and Prod estimates in Mumbai for one merchant, combined spend, USD-to-INR assumptions, and free credit burn. Include Multi-AZ Prod RDS, Redis, private endpoints, WAF, logs, backups, workload units, and which costs persist when Dev/UAT are stopped. Validate against current official AWS pricing and the specific account's credit eligibility. The figures below are the initial planning reference for a smaller EC2/Single-AZ example.

| Component | Example configuration | Original estimate (₹/month) |
|---|---|---:|
| EC2 | One t3.micro/t3.small with Docker Compose | 1,200–2,500 |
| RDS | Single-AZ t3.micro, 20 GB | 1,500–2,500 |
| ALB | One listener | 1,500–2,000 |
| CloudFront | In front of ALB, ACM certificate | 500–1,000 |
| WAF | One web ACL, basic rules | 1,000–1,500 |
| S3 | 5 GB | 100–200 |
| Secrets Manager | 5–10 secrets | 100–200 |
| CloudWatch | Basic logs and alarms | 500–1,000 |
| Cloudflare DNS | Free plan | 0 |
| Original headline estimate | EC2 example before validating line-item sums | 6,400–10,400 |
| Original credit scenario | Subject to account terms and actual eligibility | 0–3,000 |

## Deliverables and handoff

Produce IaC under `infra/`, GitHub Actions YAML, the Cloudflare DNS mapping, merchant signup and savings calculator, trial and subscription gating, Railway migration and AWS backup runbooks, the cost workbook, a Mermaid zero-trust architecture diagram, and sprint-board instructions. Report files, test outcomes, and unresolved configuration values.

The manual deployment checklist must cover AWS account and credit setup, billing alerts, IAM Identity Center login, Cloudflare zone and registrar nameservers, any scoped credential needed for repository mirroring, Terraform/CDK bootstrap and apply, DNS and certificate validation, GitHub OIDC trust, Prod promotion approval, and AWS Budgets/SNS recipient confirmation.

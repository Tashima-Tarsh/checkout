# DISHA 8.2 — AWS Infrastructure Architecture (ap-southeast-2)

This document describes the AWS infrastructure for the DISHA Super Admin control plane.

**Project Region:** `ap-southeast-2` (Asia Pacific / Sydney)
**Environments:** `development`, `uat`, `production`
**Cloud Provider:** AWS only (no Azure, Railway, Google Cloud)
**Canonical Domain:** `disha8-2.thenitishkr.in`

---

## 1. Architecture Principles

- **AWS-only**: All infrastructure deployed in AWS `ap-southeast-2`
- **Multi-account**: Separate AWS accounts for dev, uat, prod via AWS Organizations
- **Zero-trust**: IAM Identity Center (SSO), least-privilege IAM roles, no long-lived credentials
- **Private by default**: No public IPs on backend services; ALB only in public subnets
- **Cost-conscious**: Dev/UAT auto-stop on nights/weekends; Prod uses Savings Plans
- **Infrastructure as Code**: Terraform for all new resources

---

## 2. Multi-Account Strategy

| Account | Purpose | Region |
|---------|---------|--------|
| Management | AWS Organizations, IAM Identity Center, billing | ap-southeast-2 |
| Security | CloudTrail, Config, Security Hub, GuardDuty | ap-southeast-2 |
| Log Archive | Immutable S3 audit logs (7-year retention) | ap-southeast-2 |
| Shared Services | Route 53, ACM certificates, VPC endpoints, NAT gateways | ap-southeast-2 |
| Development | DISHA API, Agentic Pay, PostgreSQL, ECS | ap-southeast-2 |
| UAT | Same as dev, isolated | ap-southeast-2 |
| Production | Live merchant traffic, isolated from dev/uat | ap-southeast-2 |

---

## 3. Network Architecture (Per Environment VPC)

```
VPC: 10.x.0.0/16 (x = 1 dev, 2 uat, 3 prod)
├── Public Subnets (ALB, NAT Gateways)   - 10.x.1.0/24, 10.x.2.0/24, 10.x.3.0/24
├── Private App Subnets (ECS Fargate)    - 10.x.10.0/24, 10.x.11.0/24, 10.x.12.0/24
└── Private DB Subnets (RDS, Redis)      - 10.x.20.0/24, 10.x.21.0/24, 10.x.22.0/24
```

Security Groups:
- ALB: 443/80 from 0.0.0.0/0
- App: 8080 from ALB security group only
- RDS: 5432 from App security group only
- No public IP on backend services

---

## 4. Compute (ECS on Fargate)

| Environment | Instance Class | Storage | Multi-AZ | Backup |
|-------------|---------------|---------|----------|--------|
| dev | db.t3.micro | 20 GB | No | 7 days |
| uat | db.t3.medium | 40 GB | Yes | 7 days |
| prod | db.t3.large | 100 GB | Yes | 35 days |

Encryption: AWS KMS CMK per environment
Network: Private subnets only, VPC Endpoint

---

## 6. Cache (Amazon ElastiCache Redis)

| Environment | Node Type | Nodes | Multi-AZ |
|-------------|-----------|-------|----------|
| dev | cache.t3.micro | 1 | No |
| uat | cache.t3.small | 1 | Yes |
| prod | cache.t3.medium | 2 | Yes |

---

## 7. Load Balancing & DNS

- **ALB**: Application Load Balancer in public subnets, HTTPS only via ACM certificate
- **CloudFront**: CDN for static assets, origin from ALB
- **Route 53**: Hosted zone for `disha8-2.thenitishkr.in` and subdomains
- **ACM**: Public SSL/TLS certificates, auto-renewed

---

## 8. Secrets & Encryption

| Secret Store | Usage |
|--------------|-------|
| AWS Secrets Manager | API keys, DB passwords, JWT signing keys, ADMIN_TOKEN |
| AWS KMS | CMK per environment for EBS, RDS, S3 encryption at rest |
| AWS Certificate Manager | TLS certificates for ALB and CloudFront |

No long-lived AWS access keys stored in frontend or application code. All workloads use IAM Roles for Tasks.

---

## 9. Observability

| Service | Purpose |
|---------|---------|
| Amazon CloudWatch | Metrics, alarms, dashboards |
| AWS X-Ray | Distributed tracing |
| Amazon CloudWatch Logs | Application and infrastructure logs |
| AWS CloudTrail | API audit trail (immutable, sent to Log Archive account) |
| AWS Config | Resource compliance and drift detection |

Billing: CloudWatch is pay-per-metric. Use standard resolution (1-minute) for prod, basic (5-minute) for dev/uat.

---

## 10. AWS Billing & Credits Intelligence

The Super Admin reads from AWS Cost Explorer API (read-only IAM role):

| Metric | Source |
|--------|--------|
| Monthly cost | AWS Cost Explorer `GetCostAndUsage` |
| Daily cost | Cost Explorer grouped by day |
| Service-wise costs | Cost Explorer grouped by service |
| Environment-wise costs | Cost Explorer grouped by resource tags |
| Forecast | Cost Explorer `GetCostForecast` |
| Credits | AWS Billing and Cost Management credits API |

**Important:** Cost Explorer data is not real-time (typically 24-48 hour lag). Display "last updated" timestamp. Do not describe estimated costs as final invoices.

---

## 11. Estimated Monthly Cost (ap-southeast-2)

| Component | Dev | UAT | Prod |
|-----------|-----|-----|------|
| ECS Fargate (shared fleet) | ₹4,000 | ₹6,000 | ₹18,000 |
| RDS PostgreSQL (Multi-AZ) | ₹3,500 | ₹5,000 | ₹15,000 |
| ElastiCache Redis | ₹1,500 | ₹2,000 | ₹4,000 |
| S3 + Data Transfer | ₹1,500 | ₹2,500 | ₹6,000 |
| ALB + CloudFront + ACM | ₹2,000 | ₹3,000 | ₹8,000 |
| WAF + Shield | ₹1,500 | ₹2,000 | ₹5,000 |
| Secrets Manager + KMS | ₹1,000 | ₹1,500 | ₹3,000 |
| CloudWatch + X-Ray | ₹1,500 | ₹2,500 | ₹5,000 |
| Route 53 | ₹500 | ₹500 | ₹1,000 |
| **Subtotal** | **~₹17,000** | **~₹24,500** | **~₹65,000** |
| **Total all envs** | | | **~₹1,06,500/month** |

**AWS Budgets**: Set alerts at 50%, 80%, 100% of monthly cap.

### AWS Free Tier (First 12 Months)

| Service | Free Tier |
|---------|-----------|
| EC2 t3.micro/t3.small | 750 hours/month |
| RDS db.t3.micro/t3.small | 750 hours/month |
| S3 | 5 GB storage |
| Lambda | 1M requests/month |

**First year could be nearly ₹0 if within free tier limits.**

---

## 13. Terraform (IaC) Structure

```
infra/aws/
  providers.tf          # AWS provider config (ap-southeast-2)
  environments/
    dev/
      main.tf
      variables.tf
      terraform.tfvars
    uat/
      main.tf
      variables.tf
      terraform.tfvars
    prod/
      main.tf
      variables.tf
      terraform.tfvars
  backend.tf            # S3 remote state
  providers.tf          # AWS provider config (ap-southeast-2)
```

**Never expose AWS access keys or SDK credentials to frontend code.** All workloads use IAM Roles for Tasks. Super Admin frontend calls backend API endpoints, which in turn call AWS SDK with temporary IAM role credentials.

---

## 14. Production Provisioning Workflow

1. Merchant onboarding approved by Super Admin
2. Merchant configuration validated (tenant isolation, UPI accounts)
3. Existing production capacity evaluated
4. Tenant isolation requirements validated
5. Resource requirement calculated
6. Estimated AWS expenditure calculated (from pricing calculator)
7. Budget and quota checked (AWS Service Quotas)
8. Required approval obtained (step-up authentication)
9. Terraform plan generated (dry-run, no changes)
10. Authorized infrastructure provisioning executed (`terraform apply`)
11. Application configuration applied
12. Deployment executed (CI/CD pipeline)
13. Health checks completed
14. Security checks completed
15. Tenant isolation validated
16. Merchant activated
17. Monitoring and alerting initialized
18. Provisioning audit record completed

Provisioning workflows must be:
- Idempotent
- Retry-aware
- Auditable
- Cost-aware
- Permission-controlled
- Environment-isolated

Do not report a merchant as active until required checks pass.

---

## 15. CI/CD and Deployment Integration

Integrate existing GitHub Actions and AWS deployment mechanisms:

| Product | Official URL |
|---------|--------------|
| GitHub Actions | https://docs.github.com/en/actions |
| AWS CodeBuild | https://aws.amazon.com/codebuild/ |
| AWS CodePipeline | https://aws.amazon.com/codepipeline/ |
| AWS CodeDeploy | https://aws.amazon.com/codedeploy/ |

Display:
- Repository
- Branch
- Commit
- Build status
- Test status
- Artifact version
- Container image digest
- Vulnerability scan status (where available)
- Deployment environment
- Deployment timestamp
- Release history
- Rollback availability

Implement a release promotion workflow:

```
Development
    ↓
Automated validation
    ↓
UAT deployment
    ↓
UAT testing
    ↓
Approved production promotion
    ↓
Production health validation
```

Do not deploy when CI is failing.
Production releases must use immutable versioned artifacts where practical.
Do not silently deploy untested changes.
Provide deployment status, logs and failure explanations.

---

## 16. Security Command Centre

Create a complete security operations view.

Include:
- Administrator authentication events
- Merchant authentication events
- Failed login attempts
- Access-denied events
- Role changes
- API authentication failures
- Device integrity assessment events
- Suspicious checkout sessions
- Security policy changes
- IP whitelist changes
- AWS CloudTrail activity
- Supported AWS security findings
- Secret rotation metadata
- Certificate expiration
- Resource encryption status
- Public-access configuration findings

Do not fabricate security findings.

Integrate Security Hub, GuardDuty and AWS Config only when enabled and authorized.
Display unavailable services as unavailable rather than healthy.

Provide security incident triage and audit history.

### Super Admin Authentication

Require appropriately strong authentication.

Support existing identity architecture and evaluate:
- MFA
- Passkeys
- WebAuthn
- Secure session management
- Step-up authentication
- Short-lived privileged authorization

Do not expose a public unrestricted Super Admin interface.
Use server-side access enforcement.

---

## 17. AWS IAM and Secrets Management

Implement least-privilege AWS access.

Separate roles for:
- Read-only discovery
- Metrics collection
- Billing access
- Deployment execution
- Authorized provisioning
- Backup operations
- Approved resource management

Use temporary AWS credentials and workload roles where practical.
Avoid long-lived static AWS credentials.

Never send AWS access keys, secret access keys or session tokens to frontend code.
Never render raw secret values in dashboards.

Secrets Management should display:
- Secret name
- ARN
- Associated environment
- Last changed timestamp
- Rotation status
- Authorized resource associations

Secret viewing, modification and rotation must be tightly restricted.

Do not implement arbitrary IAM policy editing without a dedicated reviewed security design.

---

## 18. Incident Command Centre

Create an incident management module.

Incident fields:
- Incident ID
- Severity
- Status
- Affected merchant
- Affected environment
- Affected resources
- Detection source
- First detected
- Last updated
- Assigned operator
- Impact summary
- Investigation notes
- Resolution notes
- Timeline

Severity levels:
- Informational
- Warning
- High
- Critical

Support:
- Acknowledge incident
- Assign incident
- Update incident
- Add notes
- Link affected resources
- Link affected merchants
- Resolve incident
- Reopen incident
- Export incident history

Integrate genuine telemetry and alarms.
Deduplicate repeated alerts.
Prevent alert storms.
Display incident age and response history.
Do not silently suppress critical security or availability incidents.

---

## 19. Notification and Alert Centre

Create portal-level configurable alerts.

Supported conditions:
- Merchant health degraded
- Merchant health critical
- Checkout unavailable
- Database unavailable
- API errors above threshold
- API latency above threshold
- Payment processing degradation
- Receipt processing failure
- Failed deployment
- Backup failure
- Certificate expiration
- Cloud expenditure threshold
- AWS credits expiration
- Security incident
- Resource quota threshold

Use supported existing notification channels.

Evaluate AWS SNS and EventBridge where appropriate.
Official URLs:
https://aws.amazon.com/sns/
https://aws.amazon.com/eventbridge/

Use configurable notification profiles, severity levels, quiet periods and deduplication.

Critical operational alerts must not be accidentally disabled by cosmetic configuration.

---

## 20. Backup and Disaster Recovery

Implement backup intelligence using actual configured backup systems.

Display:
- Protected resources
- Backup policies
- Backup frequency
- Last successful backup
- Failed backups
- Retention
- Encryption status
- Available recovery points
- Last verified restore test
- Recovery readiness

Integrate AWS Backup if already enabled or explicitly approved.
Documentation: https://aws.amazon.com/aws-backup/

Provide authorized restore workflows.

Never automatically overwrite production databases.

Restores must include:
- Impact assessment
- Recovery target
- Approval
- Backup validation
- Restoration verification
- Audit history

Do not claim disaster recovery readiness without successful restore testing.

---

## 21. Automation Centre

Monitor existing automation services and authorized AWS-native workflows.

Support relevant:
- EventBridge
- Step Functions
- Lambda
- SQS
- Existing n8n deployment hosted on AWS, if applicable

Display:
- Workflow name
- Current status
- Execution count
- Failed executions
- Pending executions
- Retry count
- Processing latency
- Last execution
- Associated environment
- Associated merchant when applicable

Provide bounded authorized workflow actions.

Do not allow uncontrolled execution of arbitrary scripts from the portal.

---

## 22. Global Settings and Portal-Level Configuration

All supported application-level administrative configuration should be manageable through the Super Admin portal.

Create modules for:
- Global platform settings
- Tenant configuration
- Merchant onboarding policies
- Role configuration
- Health thresholds
- Monitoring intervals
- Notification profiles
- Alert routing
- Budget limits
- Approved AWS regions
- Environment configuration
- Approved provisioning templates
- Resource tagging policies
- Feature flags
- Subscription configuration
- Checkout policy
- Receipt policy
- Branding defaults
- Theme settings

Store validated configuration through authenticated backend APIs.

Implement:
- Draft
- Preview
- Publish
- Version history
- Change comparison
- Rollback
- Audit trail

Do not allow arbitrary code injection.
Do not permit administrators to disable mandatory financial integrity controls through styling or configuration settings.

Infrastructure secrets and sensitive access policies must remain separately protected.

---

## 23. Super Admin Theme Studio

Build a visual configuration studio for the Super Admin interface.

Allow approved customization of:
- Logo
- Primary color
- Accent color
- Glass material
- Gradient presets
- Background
- Dashboard density
- Typography
- Border radius
- Approved 3D assets
- Animation intensity
- Sidebar appearance
- Widget arrangement
- Date and currency preferences

Include themes:
1. Champagne Emerald
2. Platinum Command
3. Crystal Jade
4. Opal Intelligence
5. Ivory Gold
6. Titanium Pearl
7. Emerald Aurora

Provide desktop, tablet and mobile previews.
Support save, draft, publish and restore.

Do not permit arbitrary JavaScript or unsafe HTML injection.

---

## 24. Premium Animation System

Create centralized animation tokens.

```ts
export const commandMotion = {
  duration: {
    instant: 0.08,
    press: 0.10,
    hover: 0.15,
    standard: 0.22,
    transition: 0.30,
    reveal: 0.45,
    counter: 0.50,
    topology: 0.65,
  },
  spring: {
    soft: {
      type: "spring",
      stiffness: 180,
      damping: 24,
    },
    responsive: {
      type: "spring",
      stiffness: 300,
      damping: 28,
    },
  },
};
```

Implement:
- Subtle 3D card elevation
- Crystal reflection sweep
- Physical button press
- Smooth dashboard transitions
- Animated rupee counters
- Animated chart updates
- Infrastructure node selection
- Health indicator transitions
- Contextual glass drawers
- Soft loading shimmer
- Incident notification animation

Do not continuously animate every infrastructure node.
Do not use flashing critical-alert effects.
Use readable status indicators rather than animation alone.
Respect reduced-motion preferences.

---

## 25. Live Data Synchronization

Create a secure data synchronization layer.

Use appropriate:
- TanStack Query
- Background server-side collection
- Server-Sent Events
- Existing supported WebSockets
- Backend caching
- Event-driven updates

Suggested initial refresh policy:
- Critical incidents: event-driven or short polling
- Application health: 15–60 seconds
- Merchant health: 30–120 seconds
- Infrastructure discovery: 5–15 minutes
- AWS metrics: aligned with actual collection resolution
- AWS billing: according to AWS billing-data availability
- Historical reports: on demand

Make refresh intervals configurable within safe limits.

Do not hammer AWS APIs.

Handle stale data, throttling, outages and partial availability.

Every monitoring panel must show its last updated timestamp.

Distinguish:
- Live
- Recently updated
- Cached
- Stale
- Unavailable
- Unknown

Do not label historical AWS billing information as live.

---

## 26. Suggested Backend Architecture

Adapt to existing backend codebase structure.

```
backend/
  superadmin/
    auth/
    permissions/
    dashboard/
    merchants/
    agents/
    users/
    transactions/
    health/
    incidents/
    notifications/
    configuration/
    audit/
    infrastructure/
      aws/
        discovery/
        compute/
        database/
        storage/
        networking/
        cloudwatch/
        billing/
        credits/
        iam/
        secrets/
        backups/
        security/
        deployments/
        provisioning/
    telemetry/
    collectors/
    workflows/
    reports/
    schemas/
    tests/
```

Create provider abstractions where useful.

The target implementation remains AWS-only.

Keep infrastructure operations isolated from ordinary merchant-facing APIs.

Use additive, non-destructive database migrations.

Do not introduce duplicate merchant or transaction sources of truth.

---

## 27. Suggested Super Admin Frontend Architecture

```text
src/
  superadmin/
    app/
    layouts/
    components/
      command/
      glass/
      cards/
      charts/
      topology/
      health/
      tables/
      forms/
      dialogs/
      notifications/
      responsive/
    assets/
      prism-command/
      aws-icons/
      animations/
      glb/
    design-system/
      tokens/
      materials/
      gradients/
      typography/
      motion/
      themes/
    features/
      overview/
      merchants/
      owners/
      agents/
      users/
      payments/
      transactions/
      accounts/
      checkout/
      receipts/
      infrastructure/
      environments/
      compute/
      databases/
      networking/
      storage/
      health-monitor/
      logs/
      billing/
      credits/
      deployments/
      automation/
      security/
      incidents/
      backups/
      subscriptions/
      feature-flags/
      theme-studio/
      global-settings/
      audit/
    hooks/
    providers/
    services/
    stores/
    types/
    utilities/
    tests/
```

Do not duplicate existing shared components unnecessarily.

Reuse the Prism Enterprise base design system where appropriate.

Maintain strict separation between ordinary portal permissions and Super Admin privileges.

---

## 28. Suggested Super Admin API Modules

Adapt endpoint names to existing conventions.

```text
/api/superadmin/overview
/api/superadmin/merchants
/api/superadmin/merchants/{id}
/api/superadmin/merchants/{id}/health
/api/superadmin/agents
/api/superadmin/users
/api/superadmin/transactions
/api/superadmin/accounts
/api/superadmin/environments
/api/superadmin/aws/resources
/api/superadmin/aws/topology
/api/superadmin/aws/metrics
/api/superadmin/aws/alarms
/api/superadmin/aws/logs
/api/superadmin/aws/costs
/api/superadmin/aws/credits
/api/superadmin/aws/budgets
/api/superadmin/deployments
/api/superadmin/incidents
/api/superadmin/backups
/api/superadmin/security
/api/superadmin/notifications
/api/superadmin/configuration
/api/superadmin/provisioning
/api/superadmin/audit
```

For privileged operations, use explicit action-specific endpoints and validated request schemas.

Implement:
- Authentication
- RBAC
- Pagination
- Filtering
- Input validation
- Rate limiting
- Audit logging
- Error handling
- Operation IDs
- Idempotency where appropriate

Do not expose unrestricted AWS API proxy endpoints.

---

## 29. Data and Financial Integrity

Never display invented production metrics.

Never fabricate:
- Merchant count
- Merchant health
- AWS resource status
- AWS credits
- AWS costs
- Transaction confirmation
- Payment volume
- Platform revenue
- Backup success
- Deployment success
- Security findings
- Test results

Use mock data only in isolated design-preview or development fixtures.

Clearly label all simulated information.

Production dashboards must use actual authorized data sources.

An unavailable data source must produce an explicit unavailable state.

Do not fabricate successful credit-side or debit-side payment verification.

---

## 30. Performance Requirements

Target:

- LCI ≤ 2.5 seconds under representative conditions
- INP ≤ 200 milliseconds
- CLS ≤ 0.1
- Target 60 FPS for supported simple animations
- No page-level horizontal overflow
- Efficient handling of large merchant fleets
- Efficient transaction table rendering
- Efficient resource graph rendering
- Fast initial dashboard loading

Implement:

- Route-level code splitting
- Lazy-loaded charts
- Lazy-loaded WebGL
- Optimized images
- Virtualized tables
- Graph node clustering
- Query caching
- Batched AWS API calls
- Background telemetry collection
- Static visual fallbacks
- Resource cleanup
- Reduced animation quality on constrained devices

Measure actual performance.

Do not claim targets were achieved without benchmarks.

---

## 31. Accessibility Requirements

Target WCAG 2.2 AA.

Official documentation:
https://www.w3.org/TR/WCAG22/

Ensure:
- Readable typography
- Contrast compliance
- Keyboard navigation
- Screen-reader support
- Accessible dialogs
- Accessible charts
- Accessible status labels
- Visible focus states
- Touch-friendly controls
- Reduced-motion mode
- No color-only health communication
- Accessible mobile layouts
- User zoom support

All important realistic 3D navigation images must retain clear text labels.

---

## 32. Security Requirements

Preserve and strengthen:

- Server-side RBAC enforcement
- Least-privilege IAM
- Strong administrator authentication
- MFA or supported passkeys
- Session security
- Secure cookies
- CSRF protection where applicable
- Content Security Policy
- XSS protection
- Input validation
- Rate limiting
- Audit logging
- Secret management
- Encryption in transit
- Encryption at rest where appropriate
- Environment isolation
- Tenant isolation
- Secure exports
- Sensitive log redaction

Privileged operations must use:

1. Authenticated administrator
2. Authorized role
3. Validated resource
4. Validated AWS account and environment
5. Impact preview
6. Explicit confirmation
7. Step-up authentication where appropriate
8. Approval for high-risk actions
9. Audit record
10. Post-operation validation

Never allow frontend privilege escalation.

Do not weaken production financial safeguards.

Do not execute destructive operations merely to demonstrate functionality.

---

## 33. Installation Candidates

Inspect existing dependencies before installation.

Frontend candidate commands:

```powershell
npm install motion
npm install @phosphor-icons/react
npm install clsx tailwind-merge class-variance-authority

npm install three @react-three/fiber @react-three/drei
npm install -D @types/three

npm install @xyflow/react elkjs
npm install echarts echarts-for-react

npm install @tanstack/react-query
npm install @tanstack/react-table
npm install @tanstack/react-virtual

npm install zustand
npm install react-hook-form zod @hookform/resolvers

npm install @react-pdf/renderer exceljs

npm install @fontsource-variable/manrope
npm install @fontsource-variable/inter

npm install -D @playwright/test
npm install -D vitest
npm install -D @testing-library/react
npm install -D @testing-library/user-event
npm install -D @axe-core/playwright
```

If required:

```powershell
npm install @rive-app/react-canvas
```

Use framework-compatible shadcn and Radix installation procedures.

For the existing Python backend, evaluate:

```powershell
pip install boto3
```

Manage Python dependencies through the existing project dependency files and virtual environment.

Do not blindly execute these commands.

Respect the actual package manager, lockfiles, framework versions and existing project standards.

---

## 34. Automated Testing Matrix

Test screen widths:

```text
320
360
375
390
412
430
480
640
768
820
834
1024
1180
1280
1366
1440
1536
1920
2560
3840
```

Test:

- Chromium
- Firefox
- WebKit
- Mobile Chrome emulation
- Mobile Safari emulation
- Tablet portrait
- Tablet landscape
- Desktop
- Touch interactions
- Keyboard interactions
- Reduced-motion mode
- Slow networks
- GPU fallback
- Large merchant fleets
- Large resource inventories
- Large transaction tables
- Missing telemetry
- Stale metrics
- AWS permission errors
- AWS throttling
- AWS outages
- Unavailable billing data
- Failed provisioning
- Failed deployments
- Failed backup
- Unauthorized access
- Cross-environment access
- Cross-tenant isolation
- Invalid configuration
- Audit logging
- Financial formatting
- Secure administrative actions

Use mocked AWS SDK responses or controlled test environments for destructive-operation tests.

Do not execute destructive tests against production.

Capture screenshots of critical pages for desktop, tablet and mobile.

---

## 35. Implementation Execution Phases

### Phase 1 — Existing system audit

Inspect:

- Repository architecture
- Existing Super Admin pages
- Existing backend
- Existing merchant data models
- Existing payment data models
- Existing authentication
- Existing authorization
- Existing AWS configuration
- Existing infrastructure as code
- Existing AWS resources
- Existing CI/CD
- Existing monitoring
- Existing design system

Document actual capabilities and blockers.

### Phase 2 — Premium design foundation

Implement:

- Prism Command tokens
- Gradient engine
- Liquid glass materials
- Original 3D asset system
- Responsive layout system
- Typography
- Motion system
- Shared components

### Phase 3 — Application shell

Implement:

- Sidebar
- Mobile navigation
- Header
- Environment selector
- Global search
- Notification centre
- Profile
- Role-aware navigation
- Dashboard customization

### Phase 4 — Merchant intelligence

Implement:

- Merchant directory
- Merchant profiles
- Health scoring engine
- Operational status
- Agent and owner intelligence
- Transaction intelligence

### Phase 5 — AWS intelligence

Implement:

- AWS discovery
- Infrastructure inventory
- Environment management
- Infrastructure topology
- CloudWatch metrics
- Database intelligence
- Logs
- Operational health

### Phase 6 — Financial intelligence

Implement:

- AWS cost monitoring
- Credit information
- Budget tracking
- INR formatting
- Cost attribution
- Forecasts

### Phase 7 — Operational control

Implement:

- Deployments
- Incidents
- Alerts
- Backup intelligence
- Automation intelligence
- Authorized provisioning
- Security centre
- Audit centre

### Phase 8 — Configuration studios

Implement:

- Global Theme Studio
- Dashboard personalization
- Health configuration
- Notification profiles
- Feature flags
- Provisioning policies
- Configuration history and rollback

### Phase 9 — Testing

Run:

- Type checking
- Linting
- Unit tests
- Integration tests
- Responsive tests
- Accessibility tests
- End-to-end tests
- AWS API contract tests
- Security regression tests

### Phase 10 — Final integration

Resolve failures.

Validate actual data sources.

Verify authorization.

Verify financial integrity.

Verify existing payment logic.

Prepare release candidate.

Do not deploy production until CI and required release validation are complete.

---

## 37. Autonomous Execution Instructions

Do not stop after creating the dashboard homepage.

Do not repeatedly ask for routine design decisions already covered in this specification.

Inspect the actual repository and implement functionality according to existing architecture.

For every module:

1. Inspect current implementation
2. Identify existing data sources
3. Identify missing functionality
4. Implement premium responsive UI
5. Implement required backend integration
6. Apply permissions
7. Integrate genuine data
8. Handle unavailable states
9. Test functionality
10. Test responsiveness
11. Test security
12. Fix regressions
13. Document limitations
14. Proceed to the next module

Do not delete working features unnecessarily.

Do not create mock production integrations.

Do not provision paid services without validating requirements, cost and authorization.

Do not access secret values unnecessarily.

Do not make irreversible infrastructure changes without explicit approval.

When an AWS API, permission, account entitlement or service capability is unavailable, implement the safe available portion and explicitly document the blocker.

---

## 36. Required Final Deliverables

Deliver:

- Complete implemented Super Admin source code
- Premium Prism Command design system
- Original consistent 3D asset collection
- Fully responsive application shell
- Executive dashboard
- Merchant intelligence centre
- Merchant health scoring engine
- Individual merchant profiles
- Agent intelligence
- Global transaction intelligence
- AWS resource discovery
- Interactive AWS infrastructure topology
- Optional 3D infrastructure digital twin
- Environment management
- CloudWatch health monitoring
- AWS billing intelligence
- AWS credit intelligence
- Incident centre
- Security centre
- Deployment centre
- Backup centre
- Automation centre
- Authorized production provisioning workflows
- Portal-level global settings
- Theme Studio
- Dashboard personalization
- Configuration versioning
- Audit logging
- Backend integrations
- API documentation
- Responsive screenshots
- Test results
- Security review
- Performance benchmarks
- Cost assessment
- Known limitations
- Release readiness report

Create or update:

```text
docs/PRISM_COMMAND_DESIGN_SYSTEM.md
docs/PRISM_COMMAND_ARCHITECTURE.md
docs/PRISM_COMMAND_IMPLEMENTATION_STATUS.md
docs/PRISM_COMMAND_ASSET_MANIFEST.md
docs/PRISM_COMMAND_AWS_INTEGRATION.md
docs/PRISM_COMMAND_IAM_PERMISSIONS.md
docs/PRISM_COMMAND_MERCHANT_HEALTH.md
docs/PRISM_COMMAND_PROVISIONING.md
docs/PRISM_COMMAND_COST_MODEL.md
docs/PRISM_COMMAND_SECURITY_REVIEW.md
docs/PRISM_COMMAND_RESPONSIVE_TESTS.md
docs/PRISM_COMMAND_PERFORMANCE.md
docs/PRISM_COMMAND_RELEASE_READINESS.md
```

Maintain an implementation checklist with:

- Not started
- In progress
- Implemented
- Tested
- Blocked
- Verified

A feature must not be marked verified unless evidence exists.

---

## 37. Final Success Criteria

The finished product must be:

- AWS-native
- Premium
- Original
- Realistically 3D
- Liquid-glass based
- Responsive
- Mobile-friendly
- Tablet-friendly
- Desktop-friendly
- Indian rupee localized
- Merchant-aware
- Infrastructure-aware
- Health-aware
- Security-aware
- Cost-aware
- Configurable at portal level
- Auditable
- Production-conscious
- Integrated with actual backend services

The Super Admin should provide one unified intelligence and operational control plane for the entire Agentic Pay platform.

Do not deliver merely a beautiful demonstration.

Deliver the actual functional, secured and tested product.

Begin by inspecting the existing repository, its AWS infrastructure definitions and currently available application capabilities.

Then proceed systematically through all implementation phases. Recommended Kilo execution configuration:

Setting | Configuration
--- | ---
Initial mode | Architect
Implementation mode | Code
Reasoning effort | High or maximum available
Terminal | Enabled
Repository access | Existing Agentic Pay project
AWS region | ap-southeast-2
Cloud architecture | AWS only
Browser testing | Enabled
Dependency installation | Enabled within project
Infrastructure discovery | Read-only initially
Production provisioning | Authorized, cost-validated
Production deployment | Only after CI passes
Destructive operations | Explicit approval required

Keep this prompt separate from the previous Prism Enterprise SaaS prompt. Both applications should share design tokens, assets and reusable components, but Super Admin authentication, AWS permissions, infrastructure operations and privileged backend APIs must remain isolated.

I have included the complete proposed implementation architecture and library documentation links. Actual AWS resource availability, account permissions, service costs and existing repository compatibility must be verified by Kilo during its initial audit.

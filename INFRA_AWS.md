# Prism Command — AWS Infrastructure Architecture (ap-southeast-2)

This document defines the AWS-native infrastructure for the DISHA Super Admin control plane.

**Target Region:** `ap-southeast-2` (Asia Pacific / Sydney)
**Environments:** `dev`, `uat`, `prod`
**Provider:** AWS only (no Azure, Railway, or GCP)

---

## 1. Architecture Principles

- **AWS-only**: All infrastructure provisioned in AWS ap-southeast-2.
- **Multi-account**: Separate AWS accounts for dev, uat, prod via AWS Organizations.
- **Zero-trust**: IAM Identity Center (SSO), least-privilege IAM roles, no long-lived credentials.
- **Private by default**: No public IPs on backend services; ALB only in public subnets.
- **Cost-conscious**: Dev/UAT auto-stop on nights/weekends; Prod uses Savings Plans for stable baseline.
- **Infrastructure as Code**: Terraform or AWS CDK for all new resources.
- **Read-only discovery**: Super Admin probes AWS via read-only IAM role; no write access from frontend.

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
├── Public Subnets (ALB, NAT Gateways)  - 10.x.1.0/24, 10.x.2.0/24, 10.x.3.0/24
├── Private App Subnets (ECS Fargate)   - 10.x.10.0/24, 10.x.11.0/24, 10.x.12.0/24
└── Private DB Subnets (RDS, Redis)     - 10.x.20.0/24, 10.x.21.0/24, 10.x.22.0/24
```

Security Groups:
- ALB: 443/80 from 0.0.0.0/0
- App: 8080 from ALB security group only
- RDS: 5432 from App security group only
- No public IP on backend services

---

## 4. Compute (ECS on Fargate)

| Service | Task CPU | Task Memory | Min Tasks | Max Tasks |
|---------|----------|-------------|-----------|-----------|
| checkout-api (dev) | 0.25 vCPU | 0.5 GB | 1 | 2 |
| checkout-api (uat) | 0.5 vCPU | 1 GB | 1 | 2 |
| checkout-api (prod) | 1 vCPU | 2 GB | 2 | 6 |
| agentic-pay (dev) | 0.25 vCPU | 0.5 GB | 1 | 2 |
| agentic-pay (uat) | 0.5 vCPU | 1 GB | 1 | 2 |
| agentic-pay (prod) | 1 vCPU | 2 GB | 2 | 6 |

Auto-scaling based on CPU > 70% or memory > 80%.

---

## 5. Database (Amazon RDS PostgreSQL)

| Environment | Instance Class | Storage | Multi-AZ | Backup |
|-------------|---------------|---------|----------|--------|
| dev | db.t3.micro | 20 GB | No | 7 days |
| uat | db.t3.medium | 40 GB | Yes | 7 days |
| prod | db.t3.large | 100 GB | Yes | 35 days |

Encryption: AWS KMS CMK per environment.
Network: Private subnets only, VPC Endpoint.

---

## 6. Cache (Amazon ElastiCache Redis)

| Environment | Node Type | Nodes | Multi-AZ |
|-------------|-----------|-------|----------|
| dev | cache.t3.micro | 1 | No |
| uat | cache.t3.small | 1 | Yes |
| prod | cache.t3.medium | 2 | Yes |

---

## 7. Load Balancing & DNS

- **ALB**: Application Load Balancer in public subnets, HTTPS only via ACM certificate.
- **CloudFront**: Optional CDN for static assets, origin from ALB.
- **Route 53**: Private hosted zone for internal service discovery; public zone for `api.<domain>`.
- **ACM**: Public SSL/TLS certificates, auto-renewed.

---

## 8. Secrets & Encryption

| Secret Store | Usage |
|--------------|-------|
| AWS Secrets Manager | API keys, DB passwords, JWT signing keys, PDEP_ADMIN_TOKEN |
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

## 11. Estimated Monthly Cost (ap-southeast-2, Mumbai)

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

## 12. Terraform (IaC) Structure

```
infrastructure/
  modules/
    vpc/
    ecs/
    rds/
    elasticache/
    alb/
    waf/
    secrets/
    kms/
    cloudwatch/
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
  backend.tf          # S3 remote state
  providers.tf        # AWS provider config (ap-southeast-2)
```

**Never expose AWS access keys or SDK credentials to frontend code.** All workloads use IAM Roles for Tasks. Super Admin frontend calls backend API endpoints, which in turn call AWS SDK with temporary IAM role credentials.

---

## 13. Production Provisioning Workflow

1. Merchant onboarding approved by Super Admin.
2. Merchant configuration validated (tenant isolation, UPI accounts).
3. Existing production capacity evaluated.
4. Tenant isolation requirements validated.
5. Resource requirement calculated.
6. Estimated AWS expenditure calculated (from pricing calculator).
7. Budget and quota checked (AWS Service Quotas).
8. Required approval obtained (step-up authentication).
9. Terraform plan generated (dry-run, no changes).
10. Authorized infrastructure provisioning executed (`terraform apply`).
11. Application configuration applied.
12. Deployment executed (CI/CD pipeline).
13. Health checks completed.
14. Security checks completed.
15. Tenant isolation validated.
16. Merchant activated.
17. Monitoring and alerting initialized.
18. Provisioning audit record completed.

Provisioning workflows must be idempotent, retry-aware, auditable, cost-aware, permission-controlled, and environment-isolated.

---

## 14. What's Not Auto-Provisioned

- Do not automatically create dedicated EC2, RDS, NAT gateway, or load balancer per merchant.
- Evaluate shared multi-tenant resources where secure and practical.
- Do not deploy every AWS service mentioned; discover existing resources first.
- Do not destroy existing external infrastructure before migration, validation, backup, and explicitly authorized cutover.

---

## 15. Known Limitations

- AWS resource discovery requires Boto3 and valid AWS credentials configured in the backend environment.
- AWS Cost Explorer data has ~24-48 hour lag; not real-time.
- Some AWS APIs may not be available under the existing account or support plan.
- Production provisioning requires explicit Super Admin approval and step-up authentication.
- No destructive operations without explicit authorization.

# DISHA AWS infrastructure

The CloudFormation stacks use Sydney (`ap-southeast-2`). The `DISHA8-2` stack is the production network foundation. The separate `DISHA8-2-Dev-UAT` stack defines two independent VPCs, each with private subnets, an ECS cluster, an ECR repository, and a log group. Dev is for development and UAT is for acceptance testing.

Dev and UAT have no public ingress or NAT gateways. The `DevDependencies` and `UatDependencies` switches add single-AZ PostgreSQL 18, a TLS Valkey cache, private service discovery, and AWS interface endpoints to each environment independently. These resources consume credits while provisioned. Use synthetic test data and stop application tasks when the test window ends. Databases, caches, interfaces, image storage, logs, and retained snapshots have their own billing lifecycles.

When the first merchant is ready and production provisioning is authorized, use `production.json` with `FoundationStackName=DISHA8-2` and `MerchantOnboardingAuthorized=Yes`. The template rejects creation by default. It uses the existing `DISHA8-2-Production-Edge` load balancer and adds WAF, private ECS Fargate services and ECR repositories for Checkout, Agentic Pay, and n8n, Multi-AZ PostgreSQL, Redis, a private versioned backup bucket, a Cognito pool, and CloudWatch alarms. Once provisioned, several of these resources incur charges even with zero application tasks. The `BackupRetentionDays` parameter defaults to seven days. Set it to `0` when provisioning without automated PostgreSQL or Redis backups. RDS generates its master password in Secrets Manager. A separate application credential and database are required for each workload before enabling it.

The application services start at zero tasks. Before application deployment, configure pinned release images, task secrets, application database roles, internal n8n discovery, and target-group registration. The production edge owns the certificate, host rules, and target groups. Keep the portal rules on their service-unavailable responses until the isolated production services have passed readiness checks. Cloudflare records, application data, and Railway services are outside this infrastructure step.

The Cognito pool is reserved for later application integration. When `BackupRetentionDays` is positive, the backup bucket can receive exports and RDS retains automated backups for the configured duration. Scheduled exports and external webhook egress are separate pieces that still need implementation. External internet destinations require an explicit egress design.

## Provision in the AWS Console

Open CloudFormation in Sydney. For Dev and UAT, use `nonproduction.json` in stack `DISHA8-2-Dev-UAT`. The production foundation is already deployed as `DISHA8-2` from `foundation.json`. Reuse that name for updates. After onboarding authorization, create `DISHA8-2-Production` from the current `production.json` with the parameters above.

## CLI equivalent

Use an authenticated AWS CLI profile for the intended DISHA account. Confirm the account, check for existing DISHA stacks, and run these commands from this directory. Substitute an existing foundation stack name on both deployment commands if applicable. Use PowerShell or another shell that stops on a failed step before continuing.

```powershell
aws sts get-caller-identity --profile disha --region ap-southeast-2
aws cloudformation describe-stacks --profile disha --region ap-southeast-2 --query 'Stacks[].StackName'
aws cloudformation validate-template --profile disha --region ap-southeast-2 --template-body file://foundation.json
aws cloudformation validate-template --profile disha --region ap-southeast-2 --template-body file://production.json
aws cloudformation deploy --profile disha --region ap-southeast-2 --stack-name DISHA8-2 --template-file foundation.json --no-fail-on-empty-changeset
aws cloudformation deploy --profile disha --region ap-southeast-2 --stack-name DISHA8-2-Dev-UAT --template-file nonproduction.json --no-fail-on-empty-changeset
```

For the production stack, pass `EdgeStackName` only if the existing production edge uses a different stack name. Pass `AlertEmail` to subscribe to alarms and confirm the SNS subscription. Pass `MonthlyBudgetUSD` and `AlertEmailForBudget` to set the monthly budget notifications.

After provisioning, confirm both stacks completed successfully, RDS and Redis are available across Availability Zones, the load balancer is active, and the three ECS services have zero running tasks. Availability and operational checks against the application belong to its later deployment.

## Railway release rehearsal in Dev and UAT

The Railway source inventory is Checkout, Agentic Pay, n8n, PostgreSQL 18, and Redis 8.2. The three applications were deployed from commit `351e3317867229622f234f67591ee4afac5971fc` during the inventory. The Dev and UAT copies are independent of live Railway and production DNS.

The AWS migration build `dbeb5da5-4ad6-48b0-b1a0-72f9fa9d0c8f` uses that archived Railway source and two build-time fixes. It permits the exact Dev and UAT private n8n hosts on port 5678, and converts the n8n startup script to LF. The resulting ECR release tag suffix is `0bc5ec72db9f157752cc3b74d12f60c895c43ee4`. This suffix identifies the patched build and is distinct from a Git commit.

1. Create the build stack from `nonproduction-image-build.json` using the two ECR repository names from the Dev/UAT stack. Upload the reviewed release archive into its private source bucket as `source/<full-commit-sha>.zip`. Run the build and verify all three immutable tags in both repositories. Check the commit's application CI results before enabling ECS tasks.
2. Deploy `nonproduction-services.json` once per environment with the corresponding infrastructure outputs, build commit, and ECR repository name. Start with zero tasks. Each stack generates fresh application passwords and keys in Secrets Manager. The application task role reads only that environment's generated secrets and uses TLS for RDS.
3. With authorization for the short-lived database bootstrap role, update the application stack with `EnableBootstrap=Enabled` and the corresponding `DatabaseMasterSecretArn`. Run its `DatabaseBootstrapTask` in the private subnets with the environment's task security group. Confirm exit code zero for the separate `checkout_app`, `agenticpay`, and `n8n` databases, then set `EnableBootstrap=Disabled` and clear `DatabaseMasterSecretArn` to remove the role and task definition. The standalone `bootstrap_nonproduction.py` is available for an authorized client inside the VPC if a manual restore rehearsal requires it.
4. For a fresh test installation, run `WorkflowBootstrapTask` to import and publish the dispatch workflow with a new environment-local credential. Keep the Railway editor tunnel token and encryption key on Railway. Enable one task per service in Dev first.
5. From an authorized private client, verify all three health endpoints, the database isolation, and that the n8n dispatch rejects missing credentials and accepts the environment token. Exercise checkout and Agentic Pay with synthetic records and verify the expected payment verification state. Promote the same image tags to UAT and repeat the checks. Keep public DNS and live Railway untouched throughout.

For a restore rehearsal, use a scrubbed dataset approved for nonproduction and a PostgreSQL 18 dump/restore client. Restore only into an empty matching database and validate counts, migration versions, and environment-local credentials. Fresh n8n imports exercise the workflow without copying encrypted Railway credentials. Start Valkey empty unless a review identifies durable state that must be migrated.

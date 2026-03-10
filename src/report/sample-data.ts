import type { ReportData } from "./types";

export const sampleReport: ReportData = {
  title: "Security & Quality Assessment",
  project: "Acme Platform v2.4",
  date: "2026-02-03",
  version: "1.0",
  overallScore: "B",
  dimensions: [
    {
      id: "development",
      name: "Development",
      criteria: [
        {
          id: "code-quality",
          name: "Code Quality",
          score: "A",
          comment:
            "Codebase follows consistent patterns with strong typing throughout. Linting rules are enforced via CI. Minor issues with dead code in legacy modules.",
          checklist: [
            { id: "cq-1", label: "Consistent coding style enforced", status: "done", comments: ["ESLint + Prettier enforced in CI", "Pre-commit hooks configured"] },
            { id: "cq-2", label: "Static analysis configured and passing", status: "done", comments: ["SonarQube integrated"] },
            { id: "cq-3", label: "No critical code smells detected", status: "done" },
            { id: "cq-4", label: "Technical debt tracked and managed", status: "partial", comments: ["Tracked in Jira backlog", "No burndown targets set"] },
            { id: "cq-5", label: "Code review process documented", status: "done" },
          ],
        },
        {
          id: "error-tracking",
          name: "Error Tracking",
          score: "B",
          comment:
            "Sentry is integrated for runtime error tracking. Alert thresholds are configured. Some gaps in backend service coverage.",
          checklist: [
            { id: "et-1", label: "Error tracking tool integrated", status: "done", comments: ["Sentry"] },
            { id: "et-2", label: "Alerting thresholds configured", status: "done" },
            { id: "et-3", label: "All services covered", status: "partial", comments: ["3 backend services missing", "Payment service not instrumented", "Legacy auth service excluded"] },
            { id: "et-4", label: "Error triage process defined", status: "done" },
          ],
        },
        {
          id: "owasp",
          name: "OWASP Top 10",
          score: "B",
          comment:
            "Most OWASP Top 10 vulnerabilities are mitigated. SQL injection and XSS protections are solid. CSRF tokens need review on newer endpoints.",
          checklist: [
            { id: "ow-1", label: "SQL injection prevention", status: "done", comments: ["Parameterized queries throughout"] },
            { id: "ow-2", label: "XSS protection", status: "done", comments: ["CSP headers configured"] },
            { id: "ow-3", label: "CSRF token validation", status: "partial", comments: ["Missing on 4 newer endpoints", "/api/v2/settings, /api/v2/export, /api/v2/webhooks, /api/v2/integrations"] },
            { id: "ow-4", label: "Authentication controls", status: "done" },
            { id: "ow-5", label: "Security misconfiguration audit", status: "done" },
            { id: "ow-6", label: "Sensitive data exposure checks", status: "done" },
          ],
        },
        {
          id: "dependency-mgmt",
          name: "Dependency Management",
          score: "C",
          comment:
            "Lock files are committed. Automated dependency updates via Renovate, but several high-severity CVEs remain unpatched in transitive dependencies.",
          checklist: [
            { id: "dm-1", label: "Lock files committed", status: "done" },
            { id: "dm-2", label: "Automated dependency updates", status: "done", comments: ["Renovate Bot"] },
            { id: "dm-3", label: "No high-severity CVEs", status: "none", comments: ["7 CVEs in transitive deps", "CVE-2024-1234 in lodash (critical)", "CVE-2024-5678 in xmldom (high)"] },
            { id: "dm-4", label: "License compliance checked", status: "none" },
          ],
        },
      ],
    },
    {
      id: "ai",
      name: "AI & Automation",
      criteria: [
        {
          id: "model-governance",
          name: "Model Governance",
          score: "C",
          comment:
            "Model registry exists but versioning is inconsistent. No formal approval process for promoting models to production.",
          checklist: [
            { id: "mg-1", label: "Model registry maintained", status: "done", comments: ["MLflow"] },
            { id: "mg-2", label: "Version control for models", status: "partial", comments: ["Ad-hoc naming only", "No semantic versioning"] },
            { id: "mg-3", label: "Approval process for deployment", status: "none" },
            { id: "mg-4", label: "Model performance monitoring", status: "none", comments: ["Planned for Q2"] },
          ],
        },
        {
          id: "data-privacy",
          name: "Data Privacy & Bias",
          score: "B",
          comment:
            "PII is scrubbed from training data. Bias testing is performed on key models. Documentation of data lineage could be improved.",
          checklist: [
            { id: "dp-1", label: "PII removed from training data", status: "done", comments: ["Automated scrubbing pipeline"] },
            { id: "dp-2", label: "Bias testing performed", status: "done" },
            { id: "dp-3", label: "Data lineage documented", status: "partial", comments: ["Partial coverage only", "Missing lineage for recommendation model"] },
            { id: "dp-4", label: "Consent mechanisms in place", status: "done" },
          ],
        },
        {
          id: "prompt-security",
          name: "Prompt Security",
          score: "D",
          comment:
            "Basic input sanitization exists but no structured prompt injection defenses. Output validation is minimal. Needs significant improvement.",
          checklist: [
            { id: "ps-1", label: "Input sanitization", status: "partial" },
            { id: "ps-2", label: "Prompt injection defenses", status: "none", comments: ["No guardrails in place", "No system prompt hardening", "User input passed directly to model"] },
            { id: "ps-3", label: "Output validation", status: "none" },
            { id: "ps-4", label: "Rate limiting on AI endpoints", status: "done", comments: ["100 req/min per user"] },
          ],
        },
      ],
    },
    {
      id: "documentation",
      name: "Documentation",
      criteria: [
        {
          id: "api-docs",
          name: "API Documentation",
          score: "A",
          comment:
            "OpenAPI specs are auto-generated and kept in sync. Interactive documentation available via Swagger UI. Examples provided for all endpoints.",
          checklist: [
            { id: "ad-1", label: "OpenAPI specification maintained", status: "done", comments: ["Auto-generated from code"] },
            { id: "ad-2", label: "Interactive docs available", status: "done", comments: ["Swagger UI"] },
            { id: "ad-3", label: "Request/response examples", status: "done" },
            { id: "ad-4", label: "Versioning documented", status: "done" },
          ],
        },
        {
          id: "runbooks",
          name: "Runbooks & Playbooks",
          score: "C",
          comment:
            "Incident runbooks exist for critical services but are outdated. No playbooks for newer microservices. On-call rotation lacks clear escalation docs.",
          checklist: [
            { id: "rb-1", label: "Incident runbooks exist", status: "done" },
            { id: "rb-2", label: "Runbooks up-to-date", status: "none", comments: ["Last updated 8 months ago"] },
            { id: "rb-3", label: "Escalation paths documented", status: "partial" },
            { id: "rb-4", label: "Recovery procedures tested", status: "none", comments: ["Never tested"] },
          ],
        },
        {
          id: "architecture-docs",
          name: "Architecture Documentation",
          score: "B",
          comment:
            "High-level architecture diagrams are maintained. ADRs are used for major decisions. Some service boundaries are poorly documented.",
          checklist: [
            { id: "ar-1", label: "Architecture diagrams current", status: "done" },
            { id: "ar-2", label: "ADRs for major decisions", status: "done", comments: ["23 ADRs recorded"] },
            { id: "ar-3", label: "Service boundaries defined", status: "partial", comments: ["Unclear for 3 services"] },
            { id: "ar-4", label: "Data flow diagrams", status: "done" },
          ],
        },
      ],
    },
    {
      id: "design",
      name: "Design & UX",
      criteria: [
        {
          id: "accessibility",
          name: "Accessibility",
          score: "C",
          comment:
            "Basic WCAG 2.1 AA compliance for core flows. Keyboard navigation works but screen reader support is inconsistent. Color contrast issues on some pages.",
          checklist: [
            { id: "ac-1", label: "WCAG 2.1 AA compliance", status: "partial", comments: ["Core flows only"] },
            { id: "ac-2", label: "Keyboard navigation", status: "done" },
            { id: "ac-3", label: "Screen reader support", status: "none", comments: ["Inconsistent ARIA labels", "Missing landmark roles on 8 pages"] },
            { id: "ac-4", label: "Color contrast ratios", status: "none", comments: ["Fails on 12 pages", "Secondary text below 4.5:1 ratio"] },
          ],
        },
        {
          id: "design-system",
          name: "Design System",
          score: "B",
          comment:
            "Shared component library with Storybook. Tokens for colors, spacing, and typography are centralized. Some legacy pages use outdated components.",
          checklist: [
            { id: "ds-1", label: "Component library maintained", status: "done", comments: ["Storybook v7"] },
            { id: "ds-2", label: "Design tokens centralized", status: "done" },
            { id: "ds-3", label: "Storybook documentation", status: "done" },
            { id: "ds-4", label: "Consistent usage across app", status: "partial", comments: ["Legacy pages use v1 components", "Migration planned for Q3"] },
          ],
        },
      ],
    },
    {
      id: "qa",
      name: "QA & Testing",
      criteria: [
        {
          id: "test-coverage",
          name: "Test Coverage",
          score: "B",
          comment:
            "Unit test coverage at 78%. Integration tests cover critical paths. E2E tests exist but are flaky and slow. Coverage gaps in newer modules.",
          checklist: [
            { id: "tc-1", label: "Unit test coverage > 80%", status: "partial", comments: ["Currently at 78%"] },
            { id: "tc-2", label: "Integration tests for critical paths", status: "done" },
            { id: "tc-3", label: "E2E tests stable", status: "none", comments: ["30% flake rate", "Timeout issues on CI runners", "Shared test DB causes conflicts"] },
            { id: "tc-4", label: "Test execution in CI", status: "done", comments: ["GitHub Actions"] },
            { id: "tc-5", label: "Coverage trend positive", status: "done" },
          ],
        },
        {
          id: "security-testing",
          name: "Security Testing",
          score: "C",
          comment:
            "SAST is integrated in CI. DAST runs weekly. No regular penetration testing. Dependency scanning catches most issues but response time to fix is slow.",
          checklist: [
            { id: "st-1", label: "SAST in CI pipeline", status: "done", comments: ["Semgrep"] },
            { id: "st-2", label: "DAST scanning", status: "done", comments: ["Weekly OWASP ZAP scans"] },
            { id: "st-3", label: "Regular penetration testing", status: "none", comments: ["Last pentest 14 months ago", "Budget approved for next quarter"] },
            { id: "st-4", label: "Dependency vulnerability scanning", status: "done" },
            { id: "st-5", label: "Remediation SLA met", status: "partial", comments: ["Avg 45 days, target is 30"] },
          ],
        },
        {
          id: "perf-testing",
          name: "Performance Testing",
          score: "D",
          comment:
            "Load testing exists for the main API but is not part of CI. No baseline benchmarks tracked. Performance regressions are caught in production, not pre-release.",
          checklist: [
            { id: "pt-1", label: "Load testing automated", status: "none", comments: ["Manual runs only"] },
            { id: "pt-2", label: "Performance baselines tracked", status: "none" },
            { id: "pt-3", label: "Regression detection pre-release", status: "none" },
            { id: "pt-4", label: "Capacity planning documented", status: "partial" },
          ],
        },
      ],
    },
    {
      id: "infrastructure",
      name: "Infrastructure & Ops",
      criteria: [
        {
          id: "iac",
          name: "Infrastructure as Code",
          score: "A",
          comment:
            "All infrastructure managed via Terraform with state stored remotely. Modules are reusable and versioned. Drift detection runs nightly.",
          checklist: [
            { id: "ic-1", label: "All infra defined as code", status: "done", comments: ["Terraform"] },
            { id: "ic-2", label: "State management configured", status: "done", comments: ["S3 + DynamoDB locking"] },
            { id: "ic-3", label: "Modules versioned", status: "done" },
            { id: "ic-4", label: "Drift detection enabled", status: "done", comments: ["Nightly runs"] },
          ],
        },
        {
          id: "observability",
          name: "Observability",
          score: "B",
          comment:
            "Metrics, logs, and traces are collected. Dashboards exist for key services. Correlation between signals needs improvement. Alert fatigue is a concern.",
          checklist: [
            { id: "ob-1", label: "Metrics collection", status: "done", comments: ["Prometheus + Grafana"] },
            { id: "ob-2", label: "Centralized logging", status: "done", comments: ["ELK stack"] },
            { id: "ob-3", label: "Distributed tracing", status: "done", comments: ["Jaeger"] },
            { id: "ob-4", label: "Signal correlation", status: "none" },
            { id: "ob-5", label: "Alert quality", status: "partial", comments: ["Too many false positives", "200+ alerts/week, 80% noise"] },
          ],
        },
        {
          id: "disaster-recovery",
          name: "Disaster Recovery",
          score: "D",
          comment:
            "Backups exist but recovery has never been fully tested. RTO/RPO targets are not formally defined. No documented DR plan for multi-region failover.",
          checklist: [
            { id: "dr-1", label: "Backup strategy implemented", status: "done", comments: ["Daily snapshots"] },
            { id: "dr-2", label: "Recovery tested regularly", status: "none", comments: ["Never fully tested", "Partial restore attempted once in 2024"] },
            { id: "dr-3", label: "RTO/RPO defined", status: "none" },
            { id: "dr-4", label: "Multi-region failover plan", status: "none", comments: ["Single region only"] },
          ],
        },
      ],
    },
    {
      id: "databases",
      name: "Databases",
      criteria: [
        {
          id: "db-security",
          name: "DB Security",
          score: "C",
          comment:
            "Encryption at rest is enabled for primary databases. Backup encryption is partial. Replica failover is configured but untested. Network-level access controls need tightening. Transit encryption not enforced on all connections.",
          checklist: [
            { id: "dbs-1", label: "Encryption at rest", status: "done", comments: ["AES-256 on primary DBs"] },
            { id: "dbs-2", label: "Backup encryption", status: "partial", comments: ["Only production backups encrypted", "Staging and dev backups unencrypted"] },
            { id: "dbs-3", label: "Replica failover", status: "partial", comments: ["Configured but never tested"] },
            { id: "dbs-4", label: "DB access protected at network level", status: "done", comments: ["VPC + security groups"] },
            { id: "dbs-5", label: "Encryption in transit", status: "none", comments: ["Not enforced on internal services", "Only external connections use TLS"] },
          ],
        },
        {
          id: "files-security",
          name: "Files Security",
          score: "C",
          comment:
            "Private files require signed URLs. Public assets are served via CDN with CORS configured. Sensitive file encryption is inconsistent. ACL-based access for sensitive files is not fully implemented. File replication exists but scanning is missing.",
          checklist: [
            { id: "fs-1", label: "Private files allowed only from signed URL or behind auth", status: "done", comments: ["S3 presigned URLs"] },
            { id: "fs-2", label: "Public data behind CORS and CDN", status: "done", comments: ["CloudFront"] },
            { id: "fs-3", label: "Sensitive files encrypted", status: "none" },
            { id: "fs-4", label: "Sensitive files accessed via separate ACL limited to special access", status: "none", comments: ["No separate ACL"] },
            { id: "fs-5", label: "Files replication", status: "done", comments: ["Cross-region S3 replication"] },
            { id: "fs-6", label: "Files scanning", status: "none", comments: ["No malware scanning", "No content validation"] },
          ],
        },
        {
          id: "multi-tenant",
          name: "Multi-tenant Strategy",
          score: "C",
          comment:
            "Tenant isolation strategy is chosen and documented. Cross-tenant safeguards exist but have gaps in query-level enforcement. Backup strategy does not account for per-tenant restoration.",
          checklist: [
            { id: "mt-1", label: "Isolation strategy chosen and documented", status: "done", comments: ["Row-level isolation"] },
            { id: "mt-2", label: "Cross-tenant data safeguards", status: "partial", comments: ["Missing query-level RLS", "Application-level checks only"] },
            { id: "mt-3", label: "Backup risk per tenant", status: "none", comments: ["No per-tenant restore capability"] },
          ],
        },
        {
          id: "db-monitoring",
          name: "Database Active Monitoring",
          score: "C",
          comment:
            "Hardware monitoring alerts are in place. Software-level monitoring covers connection pooling but lacks visibility into locks and wait times. Query performance tracking is minimal. Database versions and extensions are mostly current.",
          checklist: [
            { id: "dbm-1", label: "Hardware monitoring alerts (disk, CPU, memory)", status: "done", comments: ["CloudWatch alarms"] },
            { id: "dbm-2", label: "Software monitoring (connection pooling, wait time, locks)", status: "partial", comments: ["Only connection pool monitored", "No lock or wait time visibility"] },
            { id: "dbm-3", label: "Query performance tracking", status: "none" },
            { id: "dbm-4", label: "Up-to-date version and extensions", status: "done", comments: ["PostgreSQL 16"] },
          ],
        },
      ],
    },
  ],
};

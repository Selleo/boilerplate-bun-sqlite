export type ChecklistItem = {
  id: string;
  name: string;
  position: number;
};

export type Criterion = {
  id: string;
  name: string;
  description: string;
  position: number;
  items: ChecklistItem[];
};

export type Dimension = {
  id: string;
  name: string;
  position: number;
  criteria: Criterion[];
};

export type Audit = {
  id: string;
  publicId?: string;
  lastPublishedAt?: string | null;
  version: number;
  name: string;
  description: string;
  owner: string;
  status: string;
  position: number;
  dimensions: Dimension[];
};

export const auditsData: Audit[] = [
  {
    id: "A-2026-001",
    version: 3,
    name: "SOC2 Type II",
    description:
      "Security controls assessment focused on access, monitoring, and incident response readiness.",
    owner: "Trust Team",
    status: "In Progress",
    position: 1,
    dimensions: [
      {
        id: "dim-1",
        name: "Security & Access",
        position: 2,
        criteria: [
          {
            id: "crit-1",
            name: "Authentication Controls",
            description: "Controls around account authentication and protection.",
            position: 2,
            items: [
              { id: "item-1", name: "MFA enabled for admins", position: 2 },
              { id: "item-2", name: "SSO enforced for workforce", position: 1 },
            ],
          },
          {
            id: "crit-2",
            name: "Authorization Controls",
            description: "Access permissions are role based and reviewed regularly.",
            position: 1,
            items: [
              { id: "item-3", name: "Least privilege roles defined", position: 1 },
              { id: "item-4", name: "Quarterly access reviews", position: 2 },
            ],
          },
        ],
      },
      {
        id: "dim-2",
        name: "Monitoring & Response",
        position: 1,
        criteria: [
          {
            id: "crit-3",
            name: "Logging",
            description: "Security-relevant events are logged and retained.",
            position: 1,
            items: [
              { id: "item-5", name: "Audit logs immutable", position: 1 },
              { id: "item-6", name: "Retention policy documented", position: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "A-2026-002",
    version: 1,
    name: "PCI DSS",
    description: "Cardholder data environment controls assessment for payment security compliance.",
    owner: "Platform Security",
    status: "Planning",
    position: 2,
    dimensions: [],
  },
  {
    id: "A-2026-003",
    version: 7,
    name: "ISO 27001",
    description: "ISMS effectiveness review aligned with risk treatment and governance controls.",
    owner: "GRC",
    status: "Fieldwork",
    position: 3,
    dimensions: [],
  },
  {
    id: "A-2026-004",
    version: 2,
    name: "Vendor Risk Cycle",
    description: "Third-party risk and due diligence controls review across vendor lifecycle phases.",
    owner: "Compliance",
    status: "Reporting",
    position: 4,
    dimensions: [],
  },
];

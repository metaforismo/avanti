import type { Office, OrganizationPublic } from "@avanti/contracts";
import type { offices, organizations } from "@avanti/db";

export function officeView(row: typeof offices.$inferSelect): Office {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    openingHours: row.openingHours,
  };
}

export function organizationView(row: typeof organizations.$inferSelect): OrganizationPublic {
  return { id: row.id, name: row.name, kind: row.kind };
}

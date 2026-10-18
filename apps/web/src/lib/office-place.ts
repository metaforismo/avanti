import type { Office } from "@avanti/contracts";

/** «Via Indipendenza 10, Bologna», or just the city: the address is optional for the API. */
export const officePlace = (office: Pick<Office, "address" | "city">) =>
  [office.address, office.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

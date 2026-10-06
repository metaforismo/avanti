import { expect, it } from "vitest";
import { applyAnswer } from "./interview";

const now = new Date("2027-01-05T10:00:00Z");
it.each([1, 2, 3])("uses the %i confirmed members instead of the declared count", (size) => {
  const members = [
    { role: "richiedente", firstName: "Esempio" },
    { role: "genitore", firstName: "Madre" },
    { role: "genitore", firstName: "Padre" },
  ].slice(0, size);
  const result = applyAnswer(
    "isee_ordinario",
    { household_count: 4 },
    "members",
    members,
    "it",
    now,
  );
  expect(result.household_count).toBe(size);
  expect(result.members).toEqual(members);
});
it.each([
  [],
  [{ role: "genitore", firstName: "Madre" }],
  Array.from({ length: 21 }, (_, index) => ({
    role: index === 0 ? "richiedente" : "altro",
    firstName: `Persona ${index}`,
  })),
])("still validates household limits and applicant: %j", (members) => {
  expect(() =>
    applyAnswer("isee_ordinario", { household_count: 2 }, "members", members, "it", now),
  ).toThrow();
});

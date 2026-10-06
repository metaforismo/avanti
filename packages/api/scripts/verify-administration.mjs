import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Runs the real curl client against the local seeded demo; never prints cookies or passwords.
const base = new URL(process.argv[2] ?? "http://localhost:3417");
assert(["localhost", "127.0.0.1"].includes(base.hostname), "Use the local demo server");
const directory = mkdtempSync(join(tmpdir(), "avanti-admin-curl-"));
const admin = join(directory, "admin.cookies");
const operator = join(directory, "operator.cookies");
const other = join(directory, "other.cookies");
const resetSession = join(directory, "reset.cookies");
const results = [];
for (const jar of [admin, operator, other, resetSession]) writeFileSync(jar, "", { mode: 0o600 });

function curl(label, method, path, expected, { body, cookie, origin = base.origin, file } = {}) {
  const args = [
    "--silent",
    "--show-error",
    "--max-time",
    "60",
    "--request",
    method,
    "--write-out",
    "\n%{http_code}",
  ];
  if (origin) args.push("--header", `Origin: ${origin}`);
  if (cookie) args.push("--cookie", cookie, "--cookie-jar", cookie);
  if (body !== undefined)
    args.push("--header", "Content-Type: application/json", "--data-binary", "@-");
  if (file) args.push("--form", `file=@${file};type=image/png`);
  args.push(new URL(`/api${path}`, base).href);
  const response = spawnSync("curl", args, {
    encoding: "utf8",
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 0, `${label}: curl failed`);
  const separator = response.stdout.lastIndexOf("\n");
  const status = Number(response.stdout.slice(separator + 1));
  const raw = response.stdout.slice(0, separator);
  assert.equal(status, expected, `${label}: expected HTTP ${expected}, received ${status}`);
  results.push({
    check: label,
    method,
    path: path
      .replace(/\/c\/[^/]+/, "/c/:token")
      .replace(/\/cases\/[^/]+/, "/cases/:id")
      .replace(/\/operators\/[^/]+/, "/operators/:id")
      .replace(/\/offices\/[^/]+/, "/offices/:id"),
    status,
  });
  return raw ? JSON.parse(raw) : null;
}
function signIn(label, email, password, cookie) {
  return curl(label, "POST", "/auth/login", 200, { body: { email, password }, cookie });
}

try {
  curl("health", "GET", "/health", 200);
  const loggedIn = signIn("login admin demo", "admin@demo.avanti.local", "DemoAvanti2027!", admin);
  assert.equal(loggedIn.mustChangePassword, false);
  const seeded = curl("list operators including inactive demo", "GET", "/operators", 200, {
    cookie: admin,
  });
  assert(
    seeded.some((row) => row.email === "disattivato@demo.avanti.local" && row.active === false),
  );
  const created = curl("create operator", "POST", "/operators", 201, {
    cookie: admin,
    body: { name: "Operatore Curl Demo", email: `curl-${randomUUID()}@demo.avanti.local` },
  });
  const pending = signIn(
    "login temporary password",
    created.operator.email,
    created.temporaryPassword,
    operator,
  );
  assert.equal(pending.mustChangePassword, true);
  curl("cases before password change", "GET", "/cases", 403, { cookie: operator });
  curl("me during forced password change", "GET", "/auth/me", 200, { cookie: operator });
  signIn("second temporary session", created.operator.email, created.temporaryPassword, other);
  const newPassword = `DemoCurl-${randomUUID()}!`;
  const changed = curl("change password", "POST", "/auth/password", 200, {
    cookie: operator,
    body: { currentPassword: created.temporaryPassword, newPassword },
  });
  assert.equal(changed.mustChangePassword, false);
  curl("cases after password change", "GET", "/cases", 200, { cookie: operator });
  curl("other session revoked", "GET", "/auth/me", 401, { cookie: other });
  curl("ordinary operator denied settings", "GET", "/settings", 403, { cookie: operator });
  const temporary = curl(
    "reset password",
    "POST",
    `/operators/${created.operator.id}/reset-password`,
    200,
    { cookie: admin },
  );
  curl("reset revokes old session", "GET", "/auth/me", 401, { cookie: operator });
  assert.equal(
    signIn(
      "login reset password",
      created.operator.email,
      temporary.temporaryPassword,
      resetSession,
    ).mustChangePassword,
    true,
  );
  curl("deactivate operator", "PATCH", `/operators/${created.operator.id}`, 200, {
    cookie: admin,
    body: { active: false },
  });
  curl("deactivation revokes sessions", "GET", "/auth/me", 401, { cookie: resetSession });
  curl("inactive operator login", "POST", "/auth/login", 401, {
    body: { email: created.operator.email, password: temporary.temporaryPassword },
  });
  const office = curl("create office", "POST", "/offices", 201, {
    cookie: admin,
    body: {
      name: `Sportello Curl ${randomUUID().slice(0, 8)}`,
      city: "Città Demo",
      address: "Via Esempio 10",
    },
  });
  const edited = curl("edit office without changing slug", "PATCH", `/offices/${office.id}`, 200, {
    cookie: admin,
    body: { name: "Sportello Curl Aggiornato", city: "Milano" },
  });
  assert.equal(edited.slug, office.slug);
  curl("printed QR slug still resolves", "GET", `/offices/${office.slug}`, 200);
  const previousSettings = curl("get settings", "GET", "/settings", 200, { cookie: admin });
  curl("patch settings", "PATCH", "/settings", 200, {
    cookie: admin,
    body: { linkDays: 7, retentionDays: 90, baselineMinutesPerCase: 30 },
  });
  const createdCase = curl("create case for erasure", "POST", "/cases", 201, {
    cookie: admin,
    body: { officeId: office.id, language: "it", practiceId: "isee_ordinario" },
  });
  const token = new URL(createdCase.citizenLink).pathname.split("/").at(-1);
  const citizen = curl("new link uses seven days", "GET", `/c/${token}`, 200);
  assert(Math.abs(Date.parse(citizen.expiresAt) - Date.now() - 7 * 86400000) < 60000);
  const answer = (questionId, value, label) =>
    curl(label, "POST", `/c/${token}/turn`, 200, { body: { type: "answer", questionId, value } });
  answer("household_count", 2, "declared household count");
  const members = answer(
    "members",
    [{ role: "richiedente", firstName: "Esempio" }],
    "member list aligns household count",
  );
  assert.equal(members.answers.household_count, 1);
  const png = join(directory, "ESEMPIO.png");
  writeFileSync(
    png,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/R9sAAAAASUVORK5CYII=",
      "base64",
    ),
    { mode: 0o600 },
  );
  const uploaded = curl("upload file before erasure", "POST", `/c/${token}/documents`, 201, {
    file: png,
  });
  assert(uploaded.documents.length > 0);
  curl("reject wrong deletion reference", "DELETE", `/cases/${createdCase.case.id}`, 400, {
    cookie: admin,
    body: { confirmReference: "WRONG" },
  });
  curl("delete case", "DELETE", `/cases/${createdCase.case.id}`, 204, {
    cookie: admin,
    body: { confirmReference: createdCase.case.reference.toLowerCase() },
  });
  curl("deleted case unavailable", "GET", `/cases/${createdCase.case.id}`, 404, { cookie: admin });
  curl("deleted citizen capability unavailable", "GET", `/c/${token}`, 404);
  curl("restore demo settings", "PATCH", "/settings", 200, {
    cookie: admin,
    body: previousSettings,
  });
  console.log(JSON.stringify({ result: "PASS", server: base.origin, checks: results }, null, 2));
} finally {
  rmSync(directory, { recursive: true, force: true });
}

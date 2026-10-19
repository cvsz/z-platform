import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["apps", "services", "packages", "tools"];

async function packageFiles(root) {
  const out = [];
  async function walk(dir) {
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      if (entry.isFile() && entry.name === "package.json") out.push(path);
    }
  }
  await walk(root);
  return out;
}

function packageIdentity(pkg, file) {
  const normalizedFile = file.replace(/\\/g, "/");
  const name = typeof pkg.name === "string" && pkg.name.trim()
    ? pkg.name.trim()
    : normalizedFile.replace(/\/package\.json$/, "");
  const spdxName = name.replace(/[^A-Za-z0-9.-]/g, "-") || "unnamed";
  // Distinct workspaces may share names or sanitize to the same identifier.
  const pathDigest = createHash("sha256").update(normalizedFile).digest("hex");
  return { name, spdxId: `SPDXRef-Package-${spdxName}-${pathDigest}` };
}

const files = (await Promise.all(roots.map(packageFiles))).flat().sort();
const packages = [];
for (const file of files) {
  const pkg = JSON.parse(await readFile(file, "utf8"));
  const { name, spdxId } = packageIdentity(pkg, file);
  packages.push({
    SPDXID: spdxId,
    name,
    versionInfo: pkg.version || "0.0.0",
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
    externalRefs: [],
  });
}
console.log(JSON.stringify({
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "z-platform-sbom",
  documentNamespace: `https://z-platform.local/sbom/${Date.now()}`,
  creationInfo: { created: new Date().toISOString(), creators: ["Tool: z-platform-tools-ops"] },
  packages,
}, null, 2));

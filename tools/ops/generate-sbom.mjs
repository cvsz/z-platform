import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

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

export function toSpdxPackage(pkg, file) {
  const declaredName = typeof pkg?.name === "string" ? pkg.name.trim() : "";
  const normalizedPath = String(file).replace(/\\\\/g, "/");
  const fallbackName = `unnamed-${normalizedPath.replace(/[^A-Za-z0-9.-]/g, "-")}`;
  const name = declaredName || fallbackName;
  const spdxName = name.replace(/[^A-Za-z0-9.-]/g, "-").replace(/-+/g, "-");

  return {
    SPDXID: `SPDXRef-Package-${spdxName}`,
    name,
    versionInfo: typeof pkg?.version === "string" && pkg.version.trim() ? pkg.version.trim() : "0.0.0",
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
    externalRefs: [],
  };
}

async function main() {
  const files = (await Promise.all(roots.map(packageFiles))).flat();
  const packages = [];
  for (const file of files) {
    const pkg = JSON.parse(await readFile(file, "utf8"));
    packages.push(toSpdxPackage(pkg, file));
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
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

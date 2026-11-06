// The mirror: this repository releases its skin's resource exactly as npm serves it inside the skin's package, and
// builds nothing. Kept in Krystosterone/dashhaus at hacs/<repository>/.github/mirror.js, the same file in every skin's
// repository (it reads which skin from the repository's name); change it there. Node 22, no dependencies.
//
//   node .github/mirror.js latest                    the newest version on npm's latest tag
//   node .github/mirror.js fetch <version> <dir>      the checked file, the release notes and the pages, into <dir>
//
// `fetch` takes the version's document from npm (never the package's index, which npm's CDN keeps for minutes), its
// tarball, and the tarball's attestations, and refuses unless the tarball is the one the document names (its sha512
// integrity) and the SLSA provenance npm holds for it names this very tarball, built by Krystosterone/dashhaus's
// release workflow on main. That the attestations themselves are signed is `npm audit signatures`'s to check, which the
// workflow runs next. Then it writes `<repository>.js` out of `package/dist/`, the release's notes, and this
// repository's README.md and hacs.json from the commit the provenance names.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Where the skin's packages are built and released. */
export const SOURCE = { repository: "https://github.com/Krystosterone/dashhaus", workflow: ".github/workflows/release.yml", ref: "refs/heads/main" };
const SLSA = "https://slsa.dev/provenance/v1";

/** `Krystosterone/orb-dashboard` → the skin it mirrors: its package and the file it releases. */
export function skinOf(fullName) {
  const match = /^([\w.-]+)\/([a-z]+)-dashboard$/.exec(fullName ?? "");
  if (!match) throw new Error(`"${fullName}" is not a skin's repository (<owner>/<skin>-dashboard)`);
  const [, owner, skin] = match;
  return { owner, repository: `${skin}-dashboard`, skin, name: skin[0].toUpperCase() + skin.slice(1), package: `@dashhaus/${skin}`, asset: `${skin}-dashboard.js` };
}

/** The tarball's bytes against the `sha512-<base64>` integrity npm's document gives it; its hex digest when they match. */
export function checkIntegrity(tarball, integrity) {
  const digest = createHash("sha512").update(tarball);
  const hex = digest.copy().digest("hex");
  const expected = /^sha512-(.+)$/.exec(integrity ?? "")?.[1];
  if (!expected) throw new Error(`npm gives no sha512 integrity (${integrity})`);
  if (digest.digest("base64") !== expected) throw new Error("the tarball is not the one npm's document names: its sha512 differs");
  return hex;
}

/**
 * The SLSA provenance among a version's attestations, checked against the tarball and where it must come from.
 * Returns the commit and the run that built it.
 */
export function checkProvenance(attestations, { name, version, sha512 }) {
  const statements = (attestations?.attestations ?? []).filter((entry) => entry.predicateType === SLSA)
    .map((entry) => JSON.parse(Buffer.from(entry.bundle?.dsseEnvelope?.payload ?? "", "base64").toString("utf8")));
  if (statements.length !== 1) throw new Error(`${name}@${version} has ${statements.length} SLSA provenance statements; it needs one`);
  const [statement] = statements;
  const purl = `pkg:npm/${name.replace("@", "%40")}@${version}`;
  const subject = statement.subject?.find((entry) => entry.name === purl);
  if (!subject) throw new Error(`the provenance is not for ${purl}`);
  if (subject.digest?.sha512 !== sha512) throw new Error(`the provenance is for another tarball of ${name}@${version}`);
  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow ?? {};
  for (const key of ["repository", "workflow", "ref"]) {
    const found = key === "workflow" ? workflow.path : workflow[key];
    if (found !== SOURCE[key]) throw new Error(`${name}@${version} was built from ${key} ${found}, not ${SOURCE[key]}`);
  }
  const commit = statement.predicate.buildDefinition.resolvedDependencies?.find((entry) => entry.uri?.startsWith(`git+${SOURCE.repository}@`))?.digest?.gitCommit;
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error(`the provenance names no commit of ${SOURCE.repository}`);
  return { commit, run: statement.predicate.runDetails?.metadata?.invocationId };
}

/** The release's notes: what it is, where it came from and where its changes are. */
export function releaseNotes(skin, version, { commit, run }) {
  return `${skin.name} ${version}, the file inside [${skin.package}@${version}](https://www.npmjs.com/package/${skin.package}/v/${version}), released here unchanged.

What changed: [release notes](https://krystosterone.github.io/dashhaus/releases/). Built by [${SOURCE.repository.replace("https://github.com/", "")}](${SOURCE.repository}/commit/${commit})${run ? ` ([its run](${run}))` : ""}; npm holds its provenance.
`;
}

const registry = () => (process.env.NPM_REGISTRY ?? "https://registry.npmjs.org").replace(/\/+$/, "");

async function get(url, as = "json") {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
  return as === "json" ? response.json() : Buffer.from(await response.arrayBuffer());
}

/** The checked release, written into `dir`. */
export async function fetchRelease(skin, version, dir) {
  const encoded = skin.package.replace("/", "%2f");
  const document = await get(`${registry()}/${encoded}/${version}`);
  if (document.version !== version) throw new Error(`npm's document is for ${document.version}, not ${version}`);
  const tarball = await get(document.dist.tarball, "buffer");
  const sha512 = checkIntegrity(tarball, document.dist.integrity);
  const provenance = checkProvenance(await get(`${registry()}/-/npm/v1/attestations/${encoded}@${version}`), { name: skin.package, version, sha512 });
  const file = execFileSync("tar", ["-xzOf", "-", `package/dist/${skin.asset}`], { input: tarball, maxBuffer: 64 * 1024 * 1024 });
  if (!file.length) throw new Error(`${skin.package}@${version} ships no dist/${skin.asset}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, skin.asset), file);
  await writeFile(join(dir, "notes.md"), releaseNotes(skin, version, provenance));
  // The pages this repository shows, from the commit that built the file, so its README always matches its release.
  const raw = `https://raw.githubusercontent.com/${SOURCE.repository.replace("https://github.com/", "")}/${provenance.commit}/hacs/${skin.repository}`;
  for (const page of ["README.md", "hacs.json"]) await writeFile(join(dir, page), await get(`${raw}/${page}`, "buffer"));
  return { file: join(dir, skin.asset), bytes: file.length, ...provenance };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, version, dir] = process.argv.slice(2);
  const skin = skinOf(process.env.GITHUB_REPOSITORY);
  if (command === "latest") {
    const tags = await get(`${registry()}/-/package/${skin.package.replace("/", "%2f")}/dist-tags`);
    if (!tags.latest) throw new Error(`${skin.package} has no latest version`);
    console.log(tags.latest);
  } else if (command === "fetch" && version && dir) {
    const { file, bytes, commit } = await fetchRelease(skin, version, dir);
    console.log(`${file}: ${Math.round(bytes / 1024)} kB from ${skin.package}@${version}, built by ${SOURCE.repository} at ${commit.slice(0, 7)}`);
  } else {
    console.error("usage: node .github/mirror.js latest | fetch <version> <dir>");
    process.exit(1);
  }
}

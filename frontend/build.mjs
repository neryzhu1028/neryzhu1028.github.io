import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = join(root, "frontend");
const dist = join(root, "dist");
const pages = ["", "about/", "projects/", "courses/", "videos/", "unboxing/", "admin/"];
const site = "https://aceskills.cn/";
const contentBytes = await readFile(join(root, "data/content.json"));
const content = JSON.parse(contentBytes);
for (const section of ["site", "hero", "projects", "courses", "videos", "unboxing", "about"]) {
  if (!content[section] || typeof content[section] !== "object") {
    throw new Error("Missing content section: " + section);
  }
}
const staging = await mkdtemp(join(root, ".site-build-"));
const assets = new Map();

function encode(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function write(target, bytes) {
  const path = join(staging, target);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

async function fingerprint(source, from) {
  const file = posix.normalize(posix.join(from, source));
  if (assets.has(file)) return assets.get(file);
  const resolved = await realpath(join(frontend, file));
  if (!resolved.startsWith(frontend + "/")) throw new Error("Asset escapes frontend: " + file);
  const bytes = await readFile(resolved);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const extension = extname(file);
  const output = posix.join(posix.dirname(file), basename(file, extension) + "." + hash + extension);
  await write(output, bytes);
  assets.set(file, output);
  return output;
}

async function rewriteAssets(html, page) {
  const pattern = /\b(href|src|srcset)="((?:\.\.\/)?(?:css\/|js\/|visuals\/|admin\.css|app\.js|core\.js)[^"]*)"/g;
  let updated = "";
  let cursor = 0;
  for (const match of html.matchAll(pattern)) {
    if (!/\.(?:css|js|webp)$/.test(match[2])) continue;
    const output = await fingerprint(match[2], page);
    updated += html.slice(cursor, match.index) + match[1] + '="' + posix.relative(page || ".", output) + '"';
    cursor = match.index + match[0].length;
  }
  return updated + html.slice(cursor);
}

function metadata(html, page) {
  const subsection = content[page.replace("/", "")];
  const title = subsection ? [subsection.title, content.site.brandName].filter(Boolean).join(" · ") : content.site.pageTitle;
  const description = subsection ? subsection.desc || subsection.text : content.site.description;
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, () => "<title>" + encode(title) + "</title>");
    html = html.replace(/(<meta property="og:title" content=")[^"]*/, (_, prefix) => prefix + encode(title));
  }
  if (description) {
    html = html.replace(/(<meta name="description" content=")[^"]*/, (_, prefix) => prefix + encode(description));
    html = html.replace(/(<meta property="og:description" content=")[^"]*/, (_, prefix) => prefix + encode(page ? description : content.site.ogDescription || description));
  }
  const url = site + page;
  return html.replace("</head>", () =>
    '  <link rel="canonical" href="' + url + '">\n' +
    '  <meta property="og:url" content="' + url + '">\n</head>');
}

async function uploadFilter(path) {
  if ((await lstat(path)).isSymbolicLink()) return false;
  const name = basename(path);
  return !name.startsWith(".") && (name === "uploads" || name === "README.txt" || name === "index.html" ||
    /\.(?:avif|gif|jpe?g|png|webp|mp4|webm)$/i.test(name));
}

try {
  for (const page of pages) {
    const name = page + "index.html";
    const html = await readFile(join(frontend, name), "utf8");
    await write(name, await rewriteAssets(page === "admin/" ? html : metadata(html, page), page));
  }

  await write("data/content.json", contentBytes);
  await cp(join(root, "assets/uploads"), join(staging, "assets/uploads"), { recursive: true, filter: uploadFilter });
  await write("CNAME", await readFile(join(root, "CNAME")));
  await write(".nojekyll", "");
  await write("robots.txt", "User-agent: *\nDisallow: /admin/\nSitemap: " + site + "sitemap.xml\n");
  await write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.filter((page) => page !== "admin/").map((page) => "  <url><loc>" + site + page + "</loc></url>").join("\n") +
    "\n</urlset>\n");
  const commit = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  await write("release.json", JSON.stringify({ commit }, null, 2) + "\n");

  await rm(dist, { recursive: true, force: true });
  await rename(staging, dist);
  console.log("Built " + pages.length + " routes in " + dist + " (" + commit.slice(0, 12) + ")");
} finally {
  await rm(staging, { recursive: true, force: true });
}

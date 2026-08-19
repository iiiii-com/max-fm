const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "history-src");
const out = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  out.push(...arr);
}
fs.writeFileSync(path.join(__dirname, "history-events.json"), JSON.stringify(out, null, 0), "utf8");
const byRegion = { cn: 0, west: 0 };
for (const e of out) byRegion[e.region]++;
console.log("total:", out.length, JSON.stringify(byRegion));
const cats = {};
for (const e of out) cats[e.category] = (cats[e.category] || 0) + 1;
console.log("categories:", JSON.stringify(cats));
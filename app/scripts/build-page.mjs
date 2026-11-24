// Construit public/ depuis la maquette (../site) et y branche le vrai labo (public/lab.js).
import fs from "node:fs";

const site = new URL("../../site/", import.meta.url);
const pub = new URL("../public/", import.meta.url);
if (!fs.existsSync(new URL("index.html", site))) { console.log("../site absent : public/ conservé"); process.exit(0); }
let html = fs.readFileSync(new URL("index.html", site), "utf8");
if (!html.includes("</body>")) throw new Error("</body> introuvable");
html = html.replace("</body>", '<script type="module" src="/lab.js"></script>\n</body>');
fs.writeFileSync(new URL("index.html", pub), html);
fs.cpSync(new URL("img/", site), new URL("img/", pub), { recursive: true });
console.log("public/index.html construit (" + Math.round(html.length / 1024) + " Ko) + img/");

import { readFile } from "node:fs/promises";
const path=process.argv[2];
if(!path)throw new Error("Usage: node validate-manifest.mjs <manifest.json>");
const value=JSON.parse(await readFile(path,"utf8"));
if(!/^[a-z0-9-]+$/.test(value.id||""))throw new Error("Invalid template id");
if(!Array.isArray(value.files)||value.files.length===0)throw new Error("Template files are required");
for(const file of value.files)if(typeof file!=="string"||/(^|\/)\.env$|\.pem$|\.key$|\.tfstate$/.test(file))throw new Error("Unsafe template file: "+file);
console.log("Template manifest is valid");
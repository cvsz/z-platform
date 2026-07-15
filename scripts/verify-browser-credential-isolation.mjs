import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const ZCHAT_PUBLIC = path.join(REPO_ROOT, 'apps', 'zchat', 'public');
const CONTROL_PANEL_SRC = path.join(REPO_ROOT, 'apps', 'agent-control-panel', 'src'); // We scan the src since it's Next.js and builds dynamically

const SUSPICIOUS_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /Z_PLATFORM_SERVICE_TOKEN/,
  /Bearer\s+sk-/,
  /AI_GATEWAY_URL/
];

let hasErrors = false;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.html') || fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`❌ Found suspicious pattern ${pattern} in ${fullPath}`);
          hasErrors = true;
        }
      }
    }
  }
}

console.log('🔍 Scanning ZChat public browser bundle...');
scanDirectory(ZCHAT_PUBLIC);

console.log('🔍 Scanning Agent Control Panel browser components...');
scanDirectory(CONTROL_PANEL_SRC);

if (hasErrors) {
  console.error('\n❌ Browser credential isolation test FAILED.');
  process.exit(1);
} else {
  console.log('\n✅ Browser credential isolation test PASSED. No provider keys or service tokens exposed.');
}

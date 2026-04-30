/**
 * Two-pass fix:
 * Pass 1 – inside every `const makeStyles = (t: any) => StyleSheet.create({…})` block,
 *           replace any remaining `theme.` references with `t.`
 * Pass 2 – for files that still have module-level `theme.` usage (outside components),
 *           re-add the static import so those module-level constants keep working.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'src', 'screens'),
  path.join(ROOT, 'src', 'components'),
];

// Properties on the theme object that must be rewritten
const THEME_PROPS = ['colors', 'spacing', 'fontSize', 'borderRadius', 'isDark'];

function fixMakeStylesBlock(src) {
  const marker = 'const makeStyles = (t: any) => StyleSheet.create(';
  const idx = src.indexOf(marker);
  if (idx === -1) return src; // param is `theme:` not `t:` — already correct

  const before = src.slice(0, idx);
  let block = src.slice(idx);

  for (const prop of THEME_PROPS) {
    // Replace `theme.prop` but NOT `t.prop` (already correct) or inside strings handled below
    const re = new RegExp(`\\btheme\\.${prop}\\b`, 'g');
    block = block.replace(re, `t.${prop}`);
  }

  return before + block;
}

function hasModuleLevelThemeRef(src) {
  // Find the first component/function declaration line
  const lines = src.split('\n');
  const firstCompLine = lines.findIndex(l =>
    /^(const \w+ = \(|const \w+ = \s*\(|export default function|export function|function \w)/.test(l)
  );
  if (firstCompLine <= 0) return false;
  const modulePart = lines.slice(0, firstCompLine).join('\n');
  return THEME_PROPS.some(p => new RegExp(`\\btheme\\.${p}\\b`).test(modulePart));
}

let fixed = 0, addedImport = 0;

for (const dir of DIRS) {
  const isScreen = dir.includes('screens');
  const relDepth = isScreen ? '../styles/theme' : '../styles/theme';

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
    const fp = path.join(dir, file);
    let src = fs.readFileSync(fp, 'utf8');
    const original = src;

    // Pass 1: fix theme. → t. inside makeStyles block
    src = fixMakeStylesBlock(src);

    // Pass 2: if module-level theme. references remain, re-add static import
    if (hasModuleLevelThemeRef(src)) {
      const hasStaticImport = src.includes("from '../styles/theme'") ||
                              src.includes('from "../styles/theme"');
      if (!hasStaticImport) {
        // Append import after last import line
        const lines = src.split('\n');
        let lastImport = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^import\s+/.test(lines[i])) lastImport = i;
        }
        if (lastImport >= 0) {
          lines.splice(lastImport + 1, 0, `import { theme } from '${relDepth}';`);
          src = lines.join('\n');
          addedImport++;
        }
      }
    }

    if (src !== original) {
      fs.writeFileSync(fp, src, 'utf8');
      fixed++;
      console.log(`  FIXED: ${file}`);
    }
  }
}

console.log(`\nFixed ${fixed} files, added ${addedImport} static imports.`);

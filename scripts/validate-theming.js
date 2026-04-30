/**
 * Validates that:
 * 1. All files with makeStyles use `t.` not `theme.` inside the block
 * 2. No static module-level `theme.` references remain (outside components)
 * 3. Files with `const { theme } = useTheme()` also have the import
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'src', 'screens'),
  path.join(ROOT, 'src', 'components'),
];

let issues = 0;

for (const dir of DIRS) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
    const fp = path.join(dir, file);
    const src = fs.readFileSync(fp, 'utf8');
    const lines = src.split('\n');

    const hasMakeStyles = src.includes('const makeStyles');
    const hasImport = src.includes("from '../contexts/ThemeContext'") || src.includes('from "../contexts/ThemeContext"');
    const hasCall = src.includes('useTheme()');

    // Check: calls useTheme but no import
    if (hasCall && !hasImport) {
      console.log(`  MISSING IMPORT: ${file}`);
      issues++;
    }

    // Check: inside makeStyles block where param is `t`, `theme.` should not appear
    if (hasMakeStyles) {
      const tParamIdx = src.indexOf('const makeStyles = (t: any) => StyleSheet.create(');
      if (tParamIdx !== -1) {
        const block = src.slice(tParamIdx);
        const badRefs = [...block.matchAll(/\btheme\.(colors|spacing|fontSize|borderRadius|isDark)\b/g)];
        if (badRefs.length) {
          console.log(`  BAD theme. IN makeStyles/t (${badRefs.length}x): ${file}`);
          issues++;
        }
      }
      // If param is `theme:` → skip, the references are valid
    }

    // Check: module-level `theme.` usage only when static import is ABSENT
    const hasStaticImport = src.includes("from '../styles/theme'") || src.includes('from "../styles/theme"');
    // Find first component declaration (excluding makeStyles)
    const firstComponentLine = lines.findIndex(l =>
      /^(const \w+ = \(|export default function|export function|function \w|export const \w+ =)/.test(l) &&
      !l.includes('makeStyles')
    );
    if (!hasStaticImport && firstComponentLine > 0) {
      const modulePart = lines.slice(0, firstComponentLine).join('\n');
      const moduleThemeRefs = [...modulePart.matchAll(/\btheme\.(colors|spacing|fontSize|borderRadius|isDark)\b/g)];
      if (moduleThemeRefs.length) {
        console.log(`  MODULE-LEVEL theme. without import (${moduleThemeRefs.length}x): ${file}`);
        issues++;
      }
    }
  }
}

console.log(`\n${issues === 0 ? '✓ All clean!' : `${issues} issue(s) found.`}`);

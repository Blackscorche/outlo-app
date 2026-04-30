/**
 * Finds files that call useTheme() but don't have the import,
 * and adds the import after the last import line.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'src', 'screens'),
  path.join(ROOT, 'src', 'components'),
];

for (const dir of DIRS) {
  const isScreen = dir.includes('screens');
  const importPath = isScreen ? '../contexts/ThemeContext' : '../contexts/ThemeContext';

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
    const fp = path.join(dir, file);
    let src = fs.readFileSync(fp, 'utf8');

    const hasCall = src.includes('useTheme()');
    const hasImport = src.includes("from '../contexts/ThemeContext'") ||
                      src.includes('from "../contexts/ThemeContext"');

    if (hasCall && !hasImport) {
      // Find the last import line and insert after it
      const lines = src.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^import\s+/.test(lines[i])) lastImportIdx = i;
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, `import { useTheme } from '${importPath}';`);
        fs.writeFileSync(fp, lines.join('\n'), 'utf8');
        console.log(`  FIXED import: ${file}`);
      } else {
        console.log(`  WARN no import line found: ${file}`);
      }
    }
  }
}

console.log('\nDone.');

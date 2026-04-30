/**
 * Auto-converts all screens and components from static StyleSheet to
 * makeStyles(theme) pattern so they respond to the ThemeContext toggle.
 *
 * Transformations per file:
 *  1. Add `import { useTheme } from '../contexts/ThemeContext';` if missing
 *  2. Remove static `import { theme } from '../styles/theme';`
 *  3. Rename `const styles = StyleSheet.create({` → `const makeStyles = (t: any) => StyleSheet.create({`
 *  4. Replace all `theme.colors.*` references inside the styles block with `t.colors.*`
 *  5. Replace hardcoded dark colours with `t.colors.*` tokens
 *  6. Inject `const { theme } = useTheme(); const styles = makeStyles(theme);`
 *     right after the first opening brace of the component/function body
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DIRS = [
  path.join(ROOT, 'src', 'screens'),
  path.join(ROOT, 'src', 'components'),
];

// Colour → token mapping (only colours that change between light and dark)
const COLOR_MAP = [
  // backgrounds
  [/#0A0A0A/g,               't.colors.background'],
  [/#0a0a0a/g,               't.colors.background'],
  [/"#0A0A0A"/g,             '"' + 't.colors.background' + '"'],  // handled by raw replace below
  // surfaces
  [/#1A1A1A/g,               't.colors.surface'],
  [/#1a1a1a/g,               't.colors.surface'],
  // surface variant / inputs
  [/#2A2A2A/g,               't.colors.inputBg'],
  [/#2a2a2a/g,               't.colors.inputBg'],
  // borders
  [/#333333/g,               't.colors.border'],
  // text
  [/"#FFFFFF"/g,             't.colors.text'],
  [/"#ffffff"/g,             't.colors.text'],
  ["'#FFFFFF'",              "'\" + \"t.colors.text\" + \"'"],   // handled below
  // secondary text  — leave #6B7280 / #9CA3AF as they mostly stay
  [/#B3B3B3/g,               't.colors.textSecondary'],
  [/#b3b3b3/g,               't.colors.textSecondary'],
];

// Simple string colour swaps inside StyleSheet blocks (using replaceAll)
const STR_COLOR_MAP = [
  ["'#0A0A0A'",  "t.colors.background"],
  ["'#0a0a0a'",  "t.colors.background"],
  ['"#0A0A0A"',  "t.colors.background"],
  ['"#0a0a0a"',  "t.colors.background"],
  ["'#1A1A1A'",  "t.colors.surface"],
  ["'#1a1a1a'",  "t.colors.surface"],
  ['"#1A1A1A"',  "t.colors.surface"],
  ['"#1a1a1a"',  "t.colors.surface"],
  ["'#2A2A2A'",  "t.colors.inputBg"],
  ['"#2A2A2A"',  "t.colors.inputBg"],
  ["'#333333'",  "t.colors.border"],
  ['"#333333"',  "t.colors.border"],
  ["'#FFFFFF'",  "t.colors.text"],
  ['"#FFFFFF"',  "t.colors.text"],
  ["'#ffffff'",  "t.colors.text"],
  ['"#ffffff"',  "t.colors.text"],
  ["'#B3B3B3'",  "t.colors.textSecondary"],
  ['"#B3B3B3"',  "t.colors.textSecondary"],
  // Also swap theme.colors references already in styles (from static import)
  ["theme.colors.background",  "t.colors.background"],
  ["theme.colors.surface",     "t.colors.surface"],
  ["theme.colors.text",        "t.colors.text"],
  ["theme.colors.textSecondary","t.colors.textSecondary"],
  ["theme.colors.primary",     "t.colors.primary"],
  ["theme.colors.border",      "t.colors.border"],
  ["theme.colors.error",       "t.colors.error"],
  ["theme.colors.success",     "t.colors.success"],
  ["theme.colors.gray",        "t.colors.gray"],
  ["theme.isDark",             "t.isDark"],
];

function getThemeImportPath(filePath) {
  const rel = path.relative(path.dirname(filePath), path.join(ROOT, 'src', 'contexts'));
  return rel.replace(/\\/g, '/') + '/ThemeContext';
}

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');

  // Skip already-converted files
  if (src.includes('const makeStyles')) {
    console.log(`  SKIP (already converted): ${path.basename(filePath)}`);
    return;
  }
  // Skip files with no StyleSheet
  if (!src.includes('StyleSheet.create')) {
    console.log(`  SKIP (no StyleSheet): ${path.basename(filePath)}`);
    return;
  }

  const importPath = getThemeImportPath(filePath);

  // 1. Add useTheme import if missing
  if (!src.includes('useTheme')) {
    // Insert after the last RN import line
    src = src.replace(
      /^(import\s+.*?from\s+['"]react-native['"];?\s*\n)/m,
      `$1import { useTheme } from '${importPath}';\n`
    );
  }

  // 2. Remove static theme import
  src = src.replace(/^import\s+\{[^}]*\btheme\b[^}]*\}\s+from\s+['"]\.\.\/styles\/theme['"];?\s*\n/m, '');

  // 3. Rename the StyleSheet declaration
  src = src.replace(
    /^(const styles\s*=\s*StyleSheet\.create\()/m,
    'const makeStyles = (t: any) => StyleSheet.create('
  );

  // 4. Replace colour tokens inside the styles block
  // Find the makeStyles block and apply colour substitutions only inside it
  const makeStylesIdx = src.indexOf('const makeStyles = (t: any) => StyleSheet.create(');
  if (makeStylesIdx !== -1) {
    const before = src.slice(0, makeStylesIdx);
    let stylesBlock = src.slice(makeStylesIdx);

    for (const [from, to] of STR_COLOR_MAP) {
      stylesBlock = stylesBlock.split(from).join(to);
    }
    src = before + stylesBlock;
  }

  // 5. Inject the hook call inside the component
  //    Strategy: find the first export default function / const Component = pattern,
  //    then insert after its opening `{`
  //    We look for the FIRST function-body opening brace after "export default"
  //    or a named component const arrow function.

  const alreadyHasUseTheme = /const\s+\{[^}]*theme[^}]*\}\s*=\s*useTheme\(\)/.test(src);

  if (!alreadyHasUseTheme) {
    // Try to inject after the first line of the component body
    // Pattern 1: export default function Name(...) {
    // Pattern 2: const Name = (...) => {
    // We insert `  const { theme } = useTheme();\n  const styles = makeStyles(theme);\n`
    // right before the FIRST `return (` inside the component

    const INJECT = '  const { theme } = useTheme();\n  const styles = makeStyles(theme);\n';

    // Find the first `return (` or `return(` that isn't in an arrow function one-liner
    const returnMatch = /\n(\s+)return\s*[\n(]/.exec(src);
    if (returnMatch) {
      const insertPos = returnMatch.index + 1; // +1 to skip the \n
      src = src.slice(0, insertPos) + INJECT + src.slice(insertPos);
    }
  } else {
    // useTheme already called, just add styles = makeStyles(theme) after the theme destructure
    if (!src.includes('const styles = makeStyles')) {
      src = src.replace(
        /(const\s+\{[^}]*theme[^}]*\}\s*=\s*useTheme\(\);?\s*\n)/,
        '$1  const styles = makeStyles(theme);\n'
      );
    }
  }

  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`  OK: ${path.basename(filePath)}`);
}

let total = 0, done = 0;
for (const dir of DIRS) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
  for (const file of files) {
    total++;
    try {
      transformFile(path.join(dir, file));
      done++;
    } catch (e) {
      console.error(`  ERROR: ${file}:`, e.message);
    }
  }
}

console.log(`\nDone: ${done}/${total} files processed.`);

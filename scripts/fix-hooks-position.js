/**
 * Fixes files where `const { theme } = useTheme()` was injected inside a
 * conditional block. Moves the two hook lines to right after the first
 * opening `{` of the component function body.
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  'src/components/EngagementNotificationSettings.tsx',
  'src/components/PriceBadge.tsx',
  'src/components/PurchaseStatus.tsx',
  'src/components/QuotaDebugPanel.tsx',
  'src/components/QuotaOverview.tsx',
  'src/components/UserProfilePopup.tsx',
  'src/screens/ChangeEmailScreen.tsx',
  'src/screens/ChangePasswordScreen.tsx',
  'src/screens/ChatRoomScreen.tsx',
  'src/screens/ChatRoomsScreen.tsx',
  'src/screens/ExtraPurchaseSuccessScreen.tsx',
  'src/screens/MapScreen.tsx',
  'src/screens/PostDetailScreen.tsx',
  'src/screens/ProfileScreen.tsx',
  'src/screens/SkillMatchingScreen.tsx',
  'src/screens/SubscriptionSuccessScreen.tsx',
  'src/screens/TicketCheckoutScreen.tsx',
  'src/screens/TicketSuccessScreen.tsx',
];

const ROOT = path.join(__dirname, '..');
const HOOK_LINE1 = '  const { theme } = useTheme();';
const HOOK_LINE2 = '  const styles = makeStyles(theme);';
const INJECT = HOOK_LINE1 + '\n' + HOOK_LINE2 + '\n';

for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  let src = fs.readFileSync(fp, 'utf8');

  // Remove existing misplaced injection (anywhere in the file)
  src = src.split(HOOK_LINE1 + '\n' + HOOK_LINE2 + '\n').join('');
  src = src.split(HOOK_LINE1 + '\n' + HOOK_LINE2).join('');

  // Find the first component function opening brace.
  // Pattern: look for `= ({` or `({ ` after function keyword or arrow, followed by `) {` or `) => {`
  // Simple heuristic: find the FIRST occurrence of `\n  const ` or `\n  let ` or `\n  //` that
  // comes after the component function declaration. We identify the component opening by
  // finding `export default function` or `const Name = (` at col 0, then its `{` on the same line
  // or next, then inject right after that `{\n`.

  // More reliable: inject right after the first `{` of the function body — which follows
  // a line starting with `const`, `function`, or `export` at column 0 that contains `(` and `)`.
  // Then find the next `{\n` on the same or following line.

  // Normalise to LF so endsWith works on Windows
  const hasCRLF = src.includes('\r\n');
  const normalised = src.replace(/\r\n/g, '\n');
  const lines = normalised.split('\n');
  let injected = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    // Match component declarations (arrow or regular function)
    const isDecl =
      /^(export default function\s+\w+|export function\s+\w+|const \w+ = |function \w+\s*\()/.test(trimmed) &&
      (line.endsWith('{') || (lines[i + 1] && lines[i + 1].trim() === '{'));

    if (isDecl) {
      const braceLineIdx = line.endsWith('{') ? i : i + 1;
      lines.splice(braceLineIdx + 1, 0, HOOK_LINE1, HOOK_LINE2);
      injected = true;
      break;
    }
  }

  // Fallback: inject after the very first `) {` or `) => {` pattern
  if (!injected) {
    for (let i = 0; i < lines.length; i++) {
      if (/\)\s*(=>\s*)?\{$/.test(lines[i])) {
        lines.splice(i + 1, 0, HOOK_LINE1, HOOK_LINE2);
        injected = true;
        break;
      }
    }
  }

  // Re-apply original line endings
  src = lines.join(hasCRLF ? '\r\n' : '\n');
  fs.writeFileSync(fp, src, 'utf8');
  console.log(injected ? `  FIXED: ${path.basename(fp)}` : `  WARN (no injection point): ${path.basename(fp)}`);
}

console.log('\nDone.');

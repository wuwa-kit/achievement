import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const commands: Record<string, string[][]> = {
  build: [['build', 'Wuwa.Desktop', '-c', 'Release']],
  test: [
    ['run', '--project', 'Wuwa.Export.Tests', '-c', 'Release', '--', '..'],
    ['run', '--project', 'Wuwa.Transfer.Tests', '-c', 'Release'],
    ['run', '--project', 'Wuwa.Desktop.Tests', '-c', 'Release'],
  ],
  publish: [
    ['publish', 'Wuwa.Desktop', '-c', 'Release', '--self-contained', 'true', '-o', 'artifacts/app-compact'],
    ['publish', 'Wuwa.Export', '-c', 'Release', '--self-contained', 'true', '-o', 'publish-compact'],
  ],
  'test-host': [['publish', 'Wuwa.Transfer.Tests', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '-o', 'artifacts/transfer-tests']],
}
const selected = commands[process.argv[2] ?? '']
if (!selected) throw new Error('Expected build, test, publish or test-host')
for (const args of selected) {
  const result = spawnSync('dotnet', args, { cwd, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
if (process.argv[2] === 'publish') {
  // Only the self-contained desktop EXE is required; symbols remain available locally.
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    'Compress-Archive -LiteralPath artifacts/app-compact/WuwaAchievementExport.exe -DestinationPath artifacts/wuwa-desktop-compact.zip -Force'],
    { cwd, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

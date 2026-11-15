import { execFileSync } from 'node:child_process'
import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'achievement-website', 'dist')
const branchPattern = /^page-\d+$/

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function git(args: string[], env = process.env) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim()
}

async function initialize() {
  const branch = `page-${Date.now()}`
  const cdnBase = `https://cdn.jsdelivr.net/gh/${requiredEnv('GITHUB_REPOSITORY')}@${branch}/`
  await appendFile(requiredEnv('GITHUB_ENV'), `PAGES_BRANCH=${branch}\nCDN_BASE=${cdnBase}\n`)
}

function deploymentBranch() {
  const branch = requiredEnv('PAGES_BRANCH')
  if (!branchPattern.test(branch)) throw new Error(`Invalid CDN branch: ${branch}`)
  return branch
}

async function publish() {
  const branch = deploymentBranch()
  const indexDir = await mkdtemp(join(tmpdir(), 'wuwa-pages-'))
  const env = {
    ...process.env,
    GIT_INDEX_FILE: join(indexDir, 'index'),
    GIT_AUTHOR_NAME: 'github-actions[bot]',
    GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'github-actions[bot]',
    GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
  }
  try {
    git(['read-tree', '--empty'], env)
    git([`--work-tree=${dist}`, 'add', '--all', '--force'], env)
    const tree = git(['write-tree'], env)
    const commit = git(['commit-tree', tree, '-m', `Build ${branch}`], env)
    git(['push', 'origin', `${commit}:refs/heads/${branch}`])
  } finally {
    await rm(indexDir, { recursive: true, force: true })
  }
}

function cleanup() {
  const branch = deploymentBranch()
  const refs = git(['ls-remote', '--heads', 'origin', 'refs/heads/page-*'])
  const previousBranches = Array.from(
    refs.matchAll(/\trefs\/heads\/(page-\d+)$/gm),
    (match) => match[1],
  )
    .filter((previous) => Number(previous.slice(5)) < Number(branch.slice(5)))
    .sort((a, b) => Number(b.slice(5)) - Number(a.slice(5)))
  const expired = previousBranches.slice(2)
  if (expired.length) git(['push', 'origin', '--delete', ...expired])
}

switch (process.argv[2]) {
  case 'init':
    await initialize()
    break
  case 'publish':
    await publish()
    break
  case 'cleanup':
    cleanup()
    break
  default:
    throw new Error('Usage: node scripts/deploy.ts <init|publish|cleanup>')
}

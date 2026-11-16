import { execFileSync } from 'node:child_process'
import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'achievement-website', 'dist')
const tagPrefix = '0.0.0-page.'
const tagPattern = /^0\.0\.0-page\.[1-9]\d*$/

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
  const tag = `${tagPrefix}${Date.now()}`
  const cdnBase = `https://cdn.jsdelivr.net/gh/${requiredEnv('GITHUB_REPOSITORY')}@${tag}/`
  await appendFile(
    requiredEnv('GITHUB_ENV'),
    `PAGES_TAG=${tag}\nCDN_BASE=${cdnBase}\n`,
  )
}

function deploymentTag() {
  const tag = requiredEnv('PAGES_TAG')
  if (!tagPattern.test(tag)) throw new Error(`Invalid CDN tag: ${tag}`)
  return tag
}

async function publish() {
  const tag = deploymentTag()
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
    const commit = git(['commit-tree', tree, '-m', `Build ${tag}`], env)
    git(['push', 'origin', `${commit}:refs/tags/${tag}`])
  } finally {
    await rm(indexDir, { recursive: true, force: true })
  }
}

function cleanup() {
  const tag = deploymentTag()
  const timestamp = (value: string) => Number(value.slice(tagPrefix.length))
  const refs = git([
    'ls-remote',
    '--tags',
    '--refs',
    'origin',
    `refs/tags/${tagPrefix}*`,
  ])
  const previousTags = refs
    .split('\n')
    .map((line) => line.split('\trefs/tags/')[1])
    .filter(
      (previous) =>
        previous &&
        tagPattern.test(previous) &&
        timestamp(previous) < timestamp(tag),
    )
    .sort((a, b) => timestamp(b) - timestamp(a))
  const expired = previousTags.slice(2)
  if (expired.length)
    git([
      'push',
      'origin',
      '--delete',
      ...expired.map((tag) => `refs/tags/${tag}`),
    ])
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

/**
 * Checks that the git working directory is clean, then creates a new build with
 * version number set to the tag of the current commit, and finally uploads the
 * build to a new draft release.
 */
import process from 'node:process'
import { spawnSync, execSync } from 'node:child_process'

function error(msg) {
  console.error('------- ERROR -------\n' + msg + '\n------- ERROR -------')
  process.exit(1)
}

// Check git status
if (execSync('git status --porcelain').toString().trim() !== '') {
  error(
    'Git working directory is not clean.\n' +
      'Please commit or stash any changes before drafting a release.',
  )
}

// Look up release tag
const tags = execSync('git tag --points-at HEAD').toString().trim().split('\n')
if (tags.length === 0 || tags[0] === '') {
  error(
    'No tag found for the current commit.\n' +
      'Please tag the current commit using `git tag -a <tag> -m ""`',
  )
}
if (tags.length > 1) {
  error(
    'Multiple tags found for the current commit:\n' +
      tags.map((tag) => `  - ${tag}`).join('\n') +
      '\n' +
      'Please ensure there is only one tag.',
  )
}
const tag = tags[0]
execSync('git push origin ' + tag, { stdio: 'ignore' })

// Build the project
console.log('Building project...')
execSync('npm run build', {
  env: { ...process.env, VITE_APP_VERSION: tag },
  stdio: 'inherit',
})

// Upload
const childProcess = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft'], {
  stdio: 'pipe',
})
const releaseNotFound = childProcess.stderr.toString().trim() === 'release not found'
if (childProcess.error && !releaseNotFound) {
  error('Could not look up release information from GitHub:\n' + childProcess.stderr.toString())
}

if (!releaseNotFound) {
  error(`A release with tag ${tag} already exists.`)
}

const url = execSync(
  [
    'gh release create',
    tag,
    'dist/*',
    '--draft',
    '--verify-tag',
    `--title "Nortek AD2CP Reader ${tag}"`,
    '--notes "TODO"',
  ].join(' '),
)
  .toString()
  .trim()
console.log('Created a new draft release:', url)

'use strict'

const hostedGitInfo = require('hosted-git-info')
const remoteOrigin = require('remote-origin-url')
const validRef = require('is-git-ref-name-valid')
const validBranch = require('is-git-branch-name-valid')
const gitdir = require('find-gitdir')
const find = require('find-file-up')
const path = require('path')
const fs = require('fs')

const kShell = Symbol('shell')
const kNut = Symbol('nut')
const kRaw = Symbol('raw')
const kFormat = Symbol('format')
const kStop = Symbol('stop')
const kDefaultBranch = Symbol('defaultBranch')
const formats = new Set(['shortcut', 'slug', 'https', 'ssh', 'sshurl', 'git'])
const noOptions = Object.seal({})

exports.fromUrl = function (url, options) {
  options = getOptions(options)
  return parse(strong(url, 'URL'), options)
}

exports.fromDir = function (cwd, options) {
  cwd = path.resolve(strong(cwd, 'Path'))
  options = getOptions(options)

  // Opt-in to reading parent directories
  const roam = !!options.roam
  const opt = { ...options, roam: false, optional: true, [kStop]: kStop }

  // Check directory by directory because a directory may have a gitdir and
  // also a parent directory with a package.json. The gitdir should then win.
  let candidate = cwd
  let previous
  let gitdir = null

  do {
    let result = exports.fromPkg(candidate, opt)

    // Stop at invalid URL
    if (result === kStop) break
    if (result != null) return result

    if (gitdir == null) {
      gitdir = getGitdir(candidate, opt.roam)
      result = parse(gitdir ? getRemoteOrigin(gitdir) : null, opt)

      // Stop at invalid URL
      if (result === kStop) break
      if (result != null) return result
    }

    previous = candidate
    candidate = path.dirname(candidate)
  } while (
    // eslint-disable-next-line no-unmodified-loop-condition
    roam && candidate !== previous
  )

  if (options.optional) {
    return null
  }

  throw new Error(`Unable to find git host in directory ${s(cwd)}`)
}

exports.fromPkg = function (pkg, options) {
  options = getOptions(options)

  if (typeof pkg === 'string') {
    pkg = findPkg(strong(pkg, 'Path'), options)
  }

  if (pkg != null && pkg.repository != null) {
    if (typeof pkg.repository === 'string') {
      const url = strong(pkg.repository, 'The repository in package.json')
      return parse(url, options)
    } else if (typeof pkg.repository === 'object') {
      const { type, url } = pkg.repository

      if (type != null && type !== 'git') {
        throw new Error(
          `The repository type in package.json is unsupported: ${s(type)}`
        )
      }

      return parse(strong(url, 'The repository url in package.json'), options)
    } else {
      const expected = 'a string or object'
      const actual = typeHint(pkg.repository)

      throw new TypeError(
        `The repository in package.json must be ${expected}, got ${actual}`
      )
    }
  }

  return parse(null, options)
}

exports.fromGit = function (cwd, options) {
  options = getOptions(options)

  const gitdir = getGitdir(cwd, !!options.roam)
  const url = gitdir ? getRemoteOrigin(gitdir) : null

  return parse(url, options)
}

function getGitdir (cwd, roam) {
  // TODO: fix this case in find-gitdir
  return path.basename(cwd) === '.git' ? cwd : gitdir.sync(cwd, roam)
}

function getRemoteOrigin (gitdir) {
  return remoteOrigin.sync({ cwd: gitdir, path: 'config' })
}

function getOptions (options) {
  return options != null ? options : noOptions
}

function parse (url, options) {
  if (!url) {
    if (options.optional) return null
    throw new Error('Unable to find git host')
  }

  // Note: has a semiglobal cache
  const xopts = { __cacheBuster: options }
  const nut = hostedGitInfo.fromUrl(url, xopts)

  if (!nut) {
    if (options.optional) return options[kStop] || null
    throw new Error(`Unable to parse git host URL ${s(url)}`)
  }

  if (nut[kShell] == null) {
    definePrivate(nut, kShell, new GitHost(url, nut, options))
  }

  return nut[kShell]
}

function getFormat (url, nut) {
  if (nut.default === 'shortcut' && url.startsWith(nut.user)) {
    return 'slug'
  } else if (nut.default === 'sshurl' && url.startsWith('git@')) {
    return 'ssh'
  } else if (nut.default === 'http') {
    return 'https'
  } else {
    return nut.default || 'ssh'
  }
}

class GitHost {
  constructor (url, nut, options) {
    definePrivate(this, kRaw, url)
    definePrivate(this, kNut, nut)
    definePrivate(this, kFormat, getFormat(url, nut))
    definePrivate(this, kDefaultBranch, options.defaultBranch
      ? assertDefaultBranch(options.defaultBranch)
      : 'main'
    )

    this.type = nut.type
    this.owner = nut.user
    this.name = nut.project
    this.committish = optionalCommittish(nut, options) || null
  }

  get raw () {
    return this[kRaw]
  }

  get format () {
    return this[kFormat]
  }

  get hostname () {
    return this[kNut].domain
  }

  file (path, opts) {
    path = normalizePath(path, 'File path')

    return this[kNut].file(path, {
      committish: requireCommittish(this, opts)
    })
  }

  shortcut (opts) {
    return this[kNut].shortcut({
      committish: optionalCommittish(this, opts)
    })
  }

  slug (opts) {
    const committish = optionalCommittish(this, opts)

    if (committish) {
      return `${this.owner}/${this.name}#${committish}`
    } else {
      return `${this.owner}/${this.name}`
    }
  }

  homepage () {
    return this[kNut].browse({ committish: '' })
  }

  browse (path, fragment, opts) {
    if (typeof path === 'object' && path !== null) {
      return this.browse(null, null, path)
    } else if (typeof fragment === 'object' && fragment !== null) {
      return this.browse(path, null, fragment)
    } else {
      path = path ? normalizePath(path, 'Browse path') : ''
      fragment = fragment ? strong(fragment, 'Browse fragment') : ''

      return this[kNut].browse(path, fragment, {
        committish: requireCommittish(this, opts)
      }).replace(/\/$/, '')
    }
  }

  bugs () {
    return this[kNut].bugs()
  }

  https (opts) {
    return this[kNut].https({
      noGitPlus: true,
      committish: optionalCommittish(this, opts)
    })
  }

  ssh (opts) {
    return this[kNut].ssh({
      committish: optionalCommittish(this, opts)
    })
  }

  sshurl (opts) {
    return this[kNut].sshurl({
      noGitPlus: true,
      committish: optionalCommittish(this, opts)
    })
  }

  git (opts) {
    return this.https(opts).replace(/^(git\+)?https:/, 'git:')
  }

  tarball (opts) {
    return this[kNut].tarball({
      committish: requireCommittish(this, opts)
    })
  }

  toString (opts) {
    const format = (opts && opts.format) || this.format

    if (!formats.has(format)) {
      const expected = Array.from(formats).map(s => JSON.stringify(s)).join(', ')
      const actual = typeHint(format)

      throw new Error('Format must be one of ' + expected + ', got ' + actual)
    }

    return this[format](opts)
  }
}

function requireCommittish (githost, options) {
  options = options || noOptions

  if (options.committish) {
    return assertCommittish(options.committish)
  } else if (githost.committish && options.committish !== false) {
    return githost.committish
  } else if (options.defaultBranch) {
    return assertDefaultBranch(options.defaultBranch)
  } else {
    return githost[kDefaultBranch]
  }
}

function optionalCommittish (githost, options) {
  options = options || noOptions

  if (options.committish !== undefined) {
    return options.committish ? assertCommittish(options.committish) : ''
  } else {
    return githost.committish || ''
  }
}

function assertCommittish (committish) {
  if (typeof committish !== 'string') {
    throw new TypeError('Committish must be a string, got ' + typeHint(committish))
  } else if (!validRef(committish, true)) {
    throw new TypeError('Committish must be a valid git reference name')
  }

  return committish
}

function assertDefaultBranch (branch) {
  if (typeof branch !== 'string') {
    throw new TypeError('Default branch must be a string, got ' + typeHint(branch))
  } else if (!validBranch(branch)) {
    throw new TypeError('Default branch must be a valid git branch name')
  }

  return branch
}

function findPkg (cwd, options) {
  const name = 'package.json'
  const fp = options.roam ? find.sync(name, cwd) : path.join(cwd, name)
  const json = fp ? tryRead(fp) : null

  return json ? JSON.parse(json) : null
}

function tryRead (fp) {
  try {
    return fs.readFileSync(fp, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

function normalizePath (path, name) {
  strong(path, name)

  if (path.includes('..')) {
    throw new Error(`${name} ${s(path)} is unsafe`)
  }

  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function definePrivate (obj, symbol, value) {
  Object.defineProperty(obj, symbol, { value, enumerable: false })
}

function strong (str, name) {
  if (typeof str !== 'string' || str === '') {
    throw new TypeError(
      `${name} must be a non-empty string, got ${typeHint(str)}`
    )
  }

  return str
}

function typeHint (value) {
  if (typeof value === 'undefined') {
    return 'undefined'
  } else {
    return `${typeof value} ${s(value)}`
  }
}

function s (str) {
  return JSON.stringify(str)
}

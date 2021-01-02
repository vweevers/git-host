'use strict'

const test = require('tape')
const tempy = require('tempy')
const fs = require('fs')
const path = require('path')
const Githost = require('.')

test('parse', function (t) {
  const urls = [
    ['slug', 'a/b', null],
    ['slug', 'a/b#c', null],

    ['shortcut', 'github:a/b', null],
    ['shortcut', 'github:a/b#c', null],

    ['https', 'https://github.com/a/b.git', null],
    ['https', 'https://github.com/a/b.git#c', null],
    ['https', 'https://github.com/a/b', 'https://github.com/a/b.git'],
    ['https', 'https://github.com/a/b#c', 'https://github.com/a/b.git#c'],
    ['https', 'http://github.com/a/b.git', 'https://github.com/a/b.git'],
    ['https', 'http://github.com/a/b.git#c', 'https://github.com/a/b.git#c'],

    ['ssh', 'git@github.com:a/b.git', null],
    ['ssh', 'git@github.com:a/b.git#c', null],

    ['sshurl', 'ssh://git@github.com/a/b.git', null],
    ['sshurl', 'ssh://git@github.com/a/b.git#c', null],
    ['sshurl', 'ssh://github.com/a/b.git', 'ssh://git@github.com/a/b.git'],
    ['sshurl', 'ssh://github.com/a/b.git#c', 'ssh://git@github.com/a/b.git#c'],
    ['sshurl', 'git+ssh://github.com/a/b.git', 'ssh://git@github.com/a/b.git'],
    ['sshurl', 'git+ssh://github.com/a/b.git#c', 'ssh://git@github.com/a/b.git#c'],

    ['git', 'git://github.com/a/b.git', null],
    ['git', 'git://github.com/a/b.git#c', null]
  ]

  const fns = [
    (url) => Githost.fromUrl(url),
    (url) => Githost.fromPkg({ repository: url }),
    (url) => Githost.fromPkg({ repository: { type: 'git', url } })
  ]

  for (const fn of fns) {
    for (const [format, url, normalized] of urls) {
      const hasCommittish = url.includes('#')
      const githost = fn(url)

      t.is(githost.type, 'github', 'type')
      t.is(githost.owner, 'a', 'owner')
      t.is(githost.name, 'b', 'name')
      t.is(githost.committish, hasCommittish ? 'c' : null, 'committish')
      t.is(githost.raw, url, 'raw')
      t.is(githost.format, format)
      t.is(githost.hostname, 'github.com')

      t.is(githost.toString(), normalized || url, 'toString()')
      t.is(githost.toString({ format }), normalized || url, 'toString()')
      t.is(githost.toString({ format: 'slug', committish: false }), 'a/b')
      t.is(githost.homepage(), 'https://github.com/a/b', 'homepage')
      t.is(githost.bugs(), 'https://github.com/a/b/issues', 'bugs')
      t.is(githost.browse(), hasCommittish ? 'https://github.com/a/b/tree/c' : 'https://github.com/a/b/tree/main', 'browse')
      t.is(githost.browse({ committish: 'main' }), 'https://github.com/a/b/tree/main', 'browse')
      t.is(githost.browse('README.md', { committish: 'main' }), 'https://github.com/a/b/tree/main/README.md', 'browse')
      t.is(githost.browse('README.md', '#usage', { committish: 'v1.0.0' }), 'https://github.com/a/b/tree/v1.0.0/README.md#usage', 'browse')
      t.is(githost.tarball({ committish: 'v1.0.0' }), 'https://codeload.github.com/a/b/tar.gz/v1.0.0', 'tarball')
      t.is(githost.file('lib/index.js', { committish: 'main' }), 'https://raw.githubusercontent.com/a/b/main/lib/index.js', 'file')

      t.is(githost.shortcut(), hasCommittish ? 'github:a/b#c' : 'github:a/b', 'shortcut')
      t.is(githost.shortcut({ committish: false }), 'github:a/b', 'shortcut')

      t.is(githost.slug(), hasCommittish ? 'a/b#c' : 'a/b', 'slug')
      t.is(githost.slug({ committish: false }), 'a/b', 'slug')
    }
  }

  t.throws(
    () => Githost.fromUrl(''),
    /^TypeError: URL must be a non-empty string, got string ""/
  )

  t.throws(
    () => Githost.fromUrl(),
    /^TypeError: URL must be a non-empty string, got undefined/
  )

  t.throws(
    () => Githost.fromUrl('invalid'),
    /^Error: Unable to parse git host URL "invalid"/
  )

  t.end()
})

test('ignore parse failure', function (t) {
  t.is(Githost.fromUrl('invalid', { optional: true }), null)
  t.end()
})

test('fromPkg(cwd)', function (t) {
  t.is(Githost.fromPkg('.').slug(), 'vweevers/find-githost')
  t.is(Githost.fromPkg('.github', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromPkg('does/not/exist', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromPkg('.', { committish: 'a' }).slug(), 'vweevers/find-githost#a')
  t.is(Githost.fromPkg('.github', { optional: true }), null)

  t.throws(
    () => Githost.fromPkg('does/not/exist'),
    /^Error: Unable to find git host/
  )

  t.throws(
    () => Githost.fromPkg('/'),
    /^Error: Unable to find git host/
  )

  t.end()
})

test('fromPkg(pkg)', function (t) {
  const pkg = require('./package.json')

  t.is(Githost.fromPkg(pkg).slug(), 'vweevers/find-githost')
  t.is(Githost.fromPkg(pkg, { committish: 'a' }).slug(), 'vweevers/find-githost#a')
  t.is(Githost.fromPkg({}, { optional: true }), null)
  t.is(Githost.fromPkg({ repository: 'a/b' }).slug(), 'a/b')
  t.is(Githost.fromPkg({ repository: { type: 'git', url: 'a/c#d' } }).slug(), 'a/c#d')

  t.throws(
    () => Githost.fromPkg(),
    /^Error: Unable to find git host/
  )

  t.throws(
    () => Githost.fromPkg({}),
    /^Error: Unable to find git host/
  )

  t.throws(
    () => Githost.fromPkg({ repository: 'invalid' }),
    /^Error: Unable to parse git host URL "invalid"/
  )

  t.throws(
    () => Githost.fromPkg({ repository: '' }),
    /^TypeError: The repository in package.json must be a non-empty string, got string ""/
  )

  t.throws(
    () => Githost.fromPkg({ repository: 123 }),
    /^TypeError: The repository in package.json must be a string or object, got number 123/
  )

  t.throws(
    () => Githost.fromPkg({ repository: { type: 'other', url: 'a/c#d' } }),
    /^Error: The repository type in package.json is unsupported: "other"/
  )

  t.end()
})

test('fromGit(cwd)', function (t) {
  t.is(Githost.fromGit('.').slug(), 'vweevers/find-githost')
  t.is(Githost.fromGit('.github', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromGit('does/not/exist', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromGit('.', { committish: 'a' }).slug(), 'vweevers/find-githost#a')
  t.is(Githost.fromGit('.github', { optional: true }), null)

  t.throws(
    () => Githost.fromGit('does/not/exist'),
    /^Error: Unable to find git host/
  )

  t.throws(
    () => Githost.fromGit('/'),
    /^Error: Unable to find git host/
  )

  const original = process.cwd()
  process.chdir('.github')
  t.is(Githost.fromGit('.', { optional: true }), null)
  t.is(Githost.fromGit('.', { roam: true }).slug(), 'vweevers/find-githost')
  process.chdir(original)

  t.end()
})

test('fromDir(cwd)', function (t) {
  t.is(Githost.fromDir('.').slug(), 'vweevers/find-githost')
  t.is(Githost.fromDir('.github', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromDir('does/not/exist', { roam: true }).slug(), 'vweevers/find-githost')
  t.is(Githost.fromDir('.', { committish: 'a' }).slug(), 'vweevers/find-githost#a')
  t.is(Githost.fromDir('.github', { optional: true }), null)
  t.is(Githost.fromDir('.git').slug(), 'vweevers/find-githost')

  t.throws(
    () => Githost.fromDir('does/not/exist'),
    /^Error: Unable to find git host/
  )

  t.throws(
    () => Githost.fromDir('/'),
    /^Error: Unable to find git host/
  )

  t.end()
})

test('fromDir() stops at invalid url in package.json', function (t) {
  const parent = tempy.directory()
  const child = path.join(parent, 'child')

  fs.mkdirSync(child)
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({ repository: 'valid/x' }))
  fs.writeFileSync(path.join(child, 'package.json'), JSON.stringify({ repository: 'invalid' }))

  t.is(Githost.fromDir(parent).slug(), 'valid/x')
  t.is(Githost.fromDir(child, { roam: true, optional: true }), null)
  t.end()
})

test('fromDir() stops at git dir', function (t) {
  const parent = tempy.directory()
  const child = path.join(parent, 'child')
  const parentGit = path.join(parent, '.git')
  const childGit = path.join(child, '.git')

  fs.mkdirSync(parentGit, { recursive: true })
  fs.mkdirSync(childGit, { recursive: true })

  writeConfig(parentGit, 'git@github.com:valid/x.git')

  t.is(Githost.fromDir(parent).slug(), 'valid/x')
  t.is(Githost.fromDir(child, { roam: true, optional: true }), null)

  fs.rmdirSync(childGit)

  t.is(Githost.fromDir(child, { roam: true }).slug(), 'valid/x')
  t.end()
})

test('fromDir() stops at invalid url in git config', function (t) {
  const parent = tempy.directory()
  const child = path.join(parent, 'child')
  const parentPkg = path.join(parent, 'package.json')
  const childGit = path.join(child, '.git')

  fs.writeFileSync(parentPkg, JSON.stringify({ repository: 'valid/x' }))
  fs.mkdirSync(childGit, { recursive: true })

  writeConfig(childGit, 'git@github.com:invalid.git')

  t.is(Githost.fromDir(parent).slug(), 'valid/x')
  t.is(Githost.fromDir(child, { roam: true, optional: true }), null)

  fs.unlinkSync(path.join(childGit, 'config'))
  fs.rmdirSync(childGit)

  t.is(Githost.fromDir(child, { roam: true }).slug(), 'valid/x')
  t.end()
})

test('fromGit() stops at git dir', function (t) {
  const parent = tempy.directory()
  const child = path.join(parent, 'child')
  const parentGit = path.join(parent, '.git')
  const childGit = path.join(child, '.git')

  fs.mkdirSync(parentGit, { recursive: true })
  fs.mkdirSync(childGit, { recursive: true })

  writeConfig(parentGit, 'git@github.com:valid/x.git')

  t.is(Githost.fromGit(parent).slug(), 'valid/x')
  t.is(Githost.fromGit(child, { roam: true, optional: true }), null)

  fs.rmdirSync(childGit)
  t.is(Githost.fromGit(child, { roam: true }).slug(), 'valid/x')

  t.end()
})

test('file()', function (t) {
  const g1 = Githost.fromUrl('a/b')
  const g2 = Githost.fromUrl('a/b#c')

  t.is(g1.file('foo'), 'https://raw.githubusercontent.com/a/b/main/foo')
  t.is(g1.file('/foo'), 'https://raw.githubusercontent.com/a/b/main/foo')
  t.is(g1.file('foo//bar\\baz'), 'https://raw.githubusercontent.com/a/b/main/foo/bar/baz')

  t.is(g1.file('foo', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g1.file('/foo', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g1.file('foo//bar\\baz', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo/bar/baz')

  t.is(g1.file('foo', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g1.file('/foo', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g1.file('foo//bar\\baz', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo/bar/baz')

  t.is(g2.file('foo'), 'https://raw.githubusercontent.com/a/b/c/foo')
  t.is(g2.file('/foo'), 'https://raw.githubusercontent.com/a/b/c/foo')
  t.is(g2.file('foo//bar\\baz'), 'https://raw.githubusercontent.com/a/b/c/foo/bar/baz')

  t.is(g2.file('foo', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/c/foo')
  t.is(g2.file('/foo', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/c/foo')
  t.is(g2.file('foo//bar\\baz', { defaultBranch: 'x' }), 'https://raw.githubusercontent.com/a/b/c/foo/bar/baz')

  t.is(g2.file('foo', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g2.file('/foo', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo')
  t.is(g2.file('foo//bar\\baz', { committish: 'x' }), 'https://raw.githubusercontent.com/a/b/x/foo/bar/baz')

  t.throws(
    () => g1.file(),
    /^TypeError: File path must be a non-empty string, got undefined/
  )

  t.throws(
    () => g1.file(''),
    /^TypeError: File path must be a non-empty string, got string ""/
  )

  t.throws(
    () => g1.file('../bar'),
    /^Error: File path "..\/bar" is unsafe/
  )

  t.end()
})

test('browse()', function (t) {
  const g1 = Githost.fromUrl('a/b')
  const g2 = Githost.fromUrl('a/b#c')

  t.is(g1.browse(), 'https://github.com/a/b/tree/main')
  t.is(g1.browse(''), 'https://github.com/a/b/tree/main')
  t.is(g1.browse('/'), 'https://github.com/a/b/tree/main')
  t.is(g1.browse('foo'), 'https://github.com/a/b/tree/main/foo')
  t.is(g1.browse('/foo'), 'https://github.com/a/b/tree/main/foo')
  t.is(g1.browse('foo//bar\\baz'), 'https://github.com/a/b/tree/main/foo/bar/baz')
  t.is(g1.browse('foo', 'bar'), 'https://github.com/a/b/tree/main/foo#bar')
  t.is(g1.browse('foo', '#bar'), 'https://github.com/a/b/tree/main/foo#bar')

  t.is(g1.browse('foo', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g1.browse('/foo', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g1.browse('foo//bar\\baz', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo/bar/baz')

  t.is(g1.browse('foo', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g1.browse('/foo', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g1.browse('foo//bar\\baz', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/x/foo/bar/baz')

  t.is(g2.browse('foo'), 'https://github.com/a/b/tree/c/foo')
  t.is(g2.browse('/foo'), 'https://github.com/a/b/tree/c/foo')
  t.is(g2.browse('foo//bar\\baz'), 'https://github.com/a/b/tree/c/foo/bar/baz')

  t.is(g2.browse('foo', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/c/foo')
  t.is(g2.browse('/foo', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/c/foo')
  t.is(g2.browse('foo//bar\\baz', { defaultBranch: 'x' }), 'https://github.com/a/b/tree/c/foo/bar/baz')

  t.is(g2.browse('foo', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g2.browse('/foo', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo')
  t.is(g2.browse('foo//bar\\baz', { committish: 'x' }), 'https://github.com/a/b/tree/x/foo/bar/baz')

  t.throws(
    () => g1.browse(123),
    /^TypeError: Browse path must be a non-empty string, got number 123/
  )

  t.throws(
    () => g1.browse('', 123),
    /^TypeError: Browse fragment must be a non-empty string, got number 123/
  )

  t.throws(
    () => g1.browse('../bar'),
    /^Error: Browse path "..\/bar" is unsafe/
  )

  t.end()
})

test('toString()', function (t) {
  t.is(Githost.fromUrl('a/b').toString(), 'a/b')
  t.is(Githost.fromUrl('a/b#c').toString(), 'a/b#c')
  t.is(Githost.fromUrl('github:a/b#c').toString(), 'github:a/b#c')
  t.is(Githost.fromUrl('gitlab:a/b#c').toString(), 'gitlab:a/b#c')

  t.is(Githost.fromUrl('a/b').toString({ format: 'shortcut' }), 'github:a/b')
  t.is(Githost.fromUrl('a/b#c').toString({ format: 'shortcut' }), 'github:a/b#c')
  t.is(Githost.fromUrl('github:a/b#c').toString({ format: 'slug' }), 'a/b#c')
  t.is(Githost.fromUrl('gitlab:a/b#c').toString({ format: 'slug' }), 'a/b#c')

  t.throws(
    () => Githost.fromUrl('a/b').toString({ format: 'nope' }),
    /^Error: Format must be one of "shortcut", "slug", "https", "ssh", "sshurl", "git", got string "nope"/
  )

  t.throws(
    () => Githost.fromUrl('a/b').toString({ format: 123 }),
    /^Error: Format must be one of "shortcut", "slug", "https", "ssh", "sshurl", "git", got number 123/
  )

  t.end()
})

test('validates committish', function (t) {
  t.throws(
    () => Githost.fromUrl('a/b', { committish: 123 }),
    /^TypeError: Committish must be a string, got number 123/
  )

  t.throws(
    () => Githost.fromUrl('a/b').toString({ committish: 123 }),
    /^TypeError: Committish must be a string, got number 123/
  )

  t.throws(
    () => Githost.fromUrl('a/b', { committish: '.dot' }),
    /^TypeError: Committish must be a valid git reference name/
  )

  t.throws(
    () => Githost.fromUrl('a/b').toString({ committish: '.dot' }),
    /^TypeError: Committish must be a valid git reference name/
  )

  t.end()
})

test('validates default branch', function (t) {
  t.throws(
    () => Githost.fromUrl('a/b', { defaultBranch: 123 }),
    /^TypeError: Default branch must be a string, got number 123/
  )

  t.throws(
    () => Githost.fromUrl('a/b').browse({ defaultBranch: 123 }),
    /^TypeError: Default branch must be a string, got number 123/
  )

  t.throws(
    () => Githost.fromUrl('a/b', { defaultBranch: '.dot' }),
    /^TypeError: Default branch must be a valid git branch name/
  )

  t.throws(
    () => Githost.fromUrl('a/b').browse({ defaultBranch: '.dot' }),
    /^TypeError: Default branch must be a valid git branch name/
  )

  t.end()
})

function writeConfig (gitdir, url) {
  const fp = path.join(gitdir, 'config')
  const lines = ['[remote "origin"]', `  url = ${url}`]

  fs.writeFileSync(fp, lines.join('\n'))
}

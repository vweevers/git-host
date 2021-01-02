# find-githost

**Get repository info from a directory, `package.json`, url, npm shorthand or git remote.** Backed by the same URL parser as npm. Supports GitHub, GitLab and BitBucket.

[![npm status](http://img.shields.io/npm/v/find-githost.svg)](https://www.npmjs.org/package/find-githost)
[![node](https://img.shields.io/node/v/find-githost.svg)](https://www.npmjs.org/package/find-githost)
![Test](https://github.com/vweevers/find-githost/workflows/Test/badge.svg?branch=main)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Table of Contents

<details><summary>Click to expand</summary>

- [Usage](#usage)
- [API](#api)
  - [Factories](#factories)
    - [`githost = Githost.fromUrl(url[, options])`](#githost--githostfromurlurl-options)
    - [`githost = Githost.fromDir(cwd[, options])`](#githost--githostfromdircwd-options)
    - [`githost = Githost.fromPkg(cwd[, options])`](#githost--githostfrompkgcwd-options)
    - [`githost = Githost.fromPkg(pkg[, options])`](#githost--githostfrompkgpkg-options)
    - [`githost = Githost.fromGit(cwd[, options])`](#githost--githostfromgitcwd-options)
  - [Properties](#properties)
    - [`githost.type`](#githosttype)
    - [`githost.owner`](#githostowner)
    - [`githost.name`](#githostname)
    - [`githost.committish`](#githostcommittish)
    - [`githost.format`](#githostformat)
    - [`githost.raw`](#githostraw)
    - [`githost.hostname`](#githosthostname)
  - [Methods](#methods)
    - [`githost.shortcut([options])`](#githostshortcutoptions)
    - [`githost.slug([options])`](#githostslugoptions)
    - [`githost.https([options])`](#githosthttpsoptions)
    - [`githost.ssh([options])`](#githostsshoptions)
    - [`githost.sshurl([options])`](#githostsshurloptions)
    - [`githost.git([options])`](#githostgitoptions)
    - [`githost.homepage()`](#githosthomepage)
    - [`githost.bugs()`](#githostbugs)
    - [`githost.browse([path][, fragment][, options])`](#githostbrowsepath-fragment-options)
    - [`githost.file(path[, options])`](#githostfilepath-options)
    - [`githost.tarball([options])`](#githosttarballoptions)
    - [`githost.toString([options])`](#githosttostringoptions)
- [Install](#install)
- [License](#license)

</details>

## Usage

Get info from `package.json` or git remote origin, whichever is found first:

```js
const Githost = require('find-githost')
const githost = Githost.fromDir('.')

console.log(githost.type)       // github
console.log(githost.owner)      // vweevers
console.log(githost.name)       // find-githost
console.log(githost.ssh())      // git@github.com:vweevers/find-githost.git
console.log(githost.https())    // https://github.com/vweevers/find-githost.git
console.log(githost.homepage()) // https://github.com/vweevers/find-githost
```

Get info from URL or npm shorthands:

```js
const githost = Githost.fromUrl('vweevers/find-githost#d6aeb7c')

console.log(githost.toString())
console.log(githost.browse('README.md'))
console.log(githost.browse('CHANGELOG.md', { committish: 'v1.0.0' }))
```

```
vweevers/find-githost#d6aeb7c
https://github.com/vweevers/find-githost/tree/d6aeb7c/README.md
https://github.com/vweevers/find-githost/tree/v1.0.0/CHANGELOG.md
```

## API

### Factories

#### `githost = Githost.fromUrl(url[, options])`

Get info from a URL or npm shortcut. Recognizes Git, SSH and HTTPS urls, as well as shortcuts (`github:vweevers/find-githost`) and for GitHub specifically, the shorter form `vweevers/find-githost`. Options:

- `committish` (string or boolean): if a string, override the committish of input. If `false`, strip committish.
- `defaultBranch` (string, default `main`): branch name to use for files and tarballs when committish is not present
- `optional` (boolean, default false): if no valid URL is found, return `null` instead of throwing an error.

The `committish` and `defaultBranch` options can also be set per method. See the documentation of methods below, which should also clarify when these options apply.

#### `githost = Githost.fromDir(cwd[, options])`

Get info from `package.json` or git remote origin in the `cwd` directory, whichever is found first.  Options:

- `roam` (boolean, default false): look in parent directories too
- Other options are passed on to `fromUrl()`.

#### `githost = Githost.fromPkg(cwd[, options])`

Get info from the [`repository`][repository] field of a `package.json` in the `cwd` directory. Options:

- `roam` (boolean, default false): look in parent directories too
- Other options are passed on to `fromUrl()`.

#### `githost = Githost.fromPkg(pkg[, options])`

Get info from the [`repository`][repository] field of a parsed `package.json` object. Options are passed on to `fromUrl()`.

#### `githost = Githost.fromGit(cwd[, options])`

Get info from git remote origin (taken from local git config). Options:

- `roam` (boolean, default false): look in parent directories too
- Other options are passed on to `fromUrl()`.

### Properties

#### `githost.type`

String, one of `github`, `gist`, `gitlab` or `bitbucket`.

#### `githost.owner`

String, repository owner.

#### `githost.name`

String, repository name.

#### `githost.committish`

String if committish is present, else `null`.

#### `githost.format`

String, original format of input URL, one of `shortcut`, `slug`, `https`, `ssh`, `sshurl` or `git`.

#### `githost.raw`

String, original input URL.

#### `githost.hostname`

String, domain of remote, e.g. `github.com` for type `github`.

### Methods

#### `githost.shortcut([options])`

Returns an npm-style shortcut in the form of `type:owner/name(#committish)`. Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.slug([options])`

Returns an npm-style shortcut for GitHub repositories in the form of `owner/name(#committish)`.  Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.https([options])`

Returns Git URL for HTTPS protocol in the form of `https://hostname/owner/name.git(#committish)`, for example `https://github.com/vweevers/find-githost.git`. Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.ssh([options])`

Returns Git URL for SSH protocol in the short form of `git@hostname:owner/name.git(#committish)`, for example `git@github.com:vweevers/find-githost.git`.  Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.sshurl([options])`

Returns Git URL for SSH protocol in the long form of `ssh://git@hostname/owner/name.git(#committish)`, for example `ssh://git@github.com/vweevers/find-githost.git`.  Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.git([options])`

Returns Git URL for Git protocol in the form of `git://hostname/owner/name.git(#committish)`, for example `git://github.com/vweevers/find-githost.git`.  Options:

- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

#### `githost.homepage()`

Returns HTTP(S) URL of homepage, for example `https://github.com/vweevers/find-githost`.

#### `githost.bugs()`

Returns HTTP(S) URL of issue tracker, for example `https://github.com/vweevers/find-githost/issues`.

#### `githost.browse([path][, fragment][, options])`

Returns HTTP(S) URL for browsing a file or directory. For example `https://github.com/vweevers/find-githost/tree/main/README.md#usage` given path `README.md` and fragment `#usage`. For the top-most directory, omit the `path` argument or use `/`. Options:

- `committish` (string or boolean): if a string, override committish. If `false`, use default branch.
- `defaultBranch` (string, default `main`): branch name to use when committish is not present.

#### `githost.file(path[, options])`

Returns HTTP(S) URL for the raw contents of `path`, for example `https://raw.githubusercontent.com/vweevers/find-githost/main/index.js` given path `index.js`. Options:

- `committish` (string or boolean): if a string, override committish. If `false`, use default branch.
- `defaultBranch` (string, default `main`): branch name to use when committish is not present.

#### `githost.tarball([options])`

Returns HTTP(S) tarball URL, for example `https://codeload.github.com/vweevers/find-githost/tar.gz/v1.0.0` given committish `v1.0.0`. Options:

- `committish` (string or boolean): if a string, override committish. If `false`, use default branch.
- `defaultBranch` (string, default `main`): branch name to use when committish is not present.

#### `githost.toString([options])`

Returns a string representation. Options:

- `format` (string, defaults to format of input): one of `shortcut`, `slug`, `https`, `ssh`, `sshurl`, `git`.
- `committish` (string or boolean): if a string, override committish. If `false`, strip committish.

## Install

With [npm](https://npmjs.org) do:

```
npm install find-githost
```

## License

[MIT](LICENSE) © Vincent Weevers

[repository]: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#repository

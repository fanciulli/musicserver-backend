---
name: test-dependabot-and-merge
description: >-
  Validate and land all open Dependabot pull requests together. Use when the
  user wants to check Dependabot PRs, combine them on a throwaway branch, run a
  clean install plus the test suite (with coverage), and—only if everything is
  green—squash-merge each Dependabot PR. Triggers include "test the dependabot
  PRs", "merge dependabot updates", "check and merge dependency bumps".
---

# Test Dependabot and Merge

Combine every open Dependabot pull request onto a single integration branch,
prove the combination builds and tests cleanly, and then squash-merge each PR.
Testing the bumps *together* catches cross-package incompatibilities that pass
on each isolated PR (for example, a `vitest` bump whose peer
`@vitest/coverage-v8` was left behind).

## When to use

- The user asks to test, validate, and/or merge open Dependabot PRs.
- Several Dependabot dependency-bump PRs are open against `main`.

## Procedure

### 1. Find the open Dependabot PRs

Use the GitHub tools to list open PRs authored by `app/dependabot`:

- `search_pull_requests` with `repo:<owner>/<repo> is:pr is:open author:app/dependabot`.

Record each PR number and its head branch (e.g. `dependabot/npm_and_yarn/<dep>-<version>`).
Note: Dependabot opens **pull requests**, not issues, even if the request says
"issues".

### 2. Build the integration branch

```bash
git fetch origin main <each-dependabot-head-branch>
git checkout -B <work-branch> origin/main      # start fresh from main
```

Merge every Dependabot head branch into the work branch:

```bash
git merge --no-edit origin/<dependabot-head-branch>
```

**Conflicts** almost always land in `package.json` / `package-lock.json`. Resolve
`package.json` by hand to keep the newest version of every bumped dependency, take
either side for `package-lock.json`, then let step 3 regenerate the lockfile to
match.

### 3. Clean install

There is no `npm clean` script in this repo, so "npm clean" means a clean
install: wipe `node_modules`, clear the cache, and reinstall so the lockfile is
regenerated from the resolved `package.json`.

```bash
rm -rf node_modules
npm cache clean --force
npm install
```

If `npm install` fails with an `ERESOLVE` peer-dependency conflict, a Dependabot
bump is incomplete (a package and its peer must move in lockstep — e.g.
`vitest` and `@vitest/coverage-v8` must share the exact same version). Confirm
with `npm view <pkg>@<version> peerDependencies` and, with the user's
agreement, align the lagging package to the matching version. Re-run
`npm install`.

### 4. Run the tests with coverage

```bash
npm run test:coverage
```

All test files and tests must pass and the coverage report must generate. If
anything fails, **stop**: do not merge any PR, report the failure, and let the
user decide.

### 5. Push the integration branch

Push only to the designated work branch (this environment forbids pushing to
`main` or to `dependabot/*` branches):

```bash
git push -u origin <work-branch>
```

### 6. Squash-merge each Dependabot PR

Only when steps 3–4 are fully green, merge every Dependabot PR with the **squash**
method:

- `merge_pull_request` with `merge_method: "squash"` for each PR number.

Earlier merges move `main`, so later PRs may report a conflict
(`mergeable_state: "dirty"`) or need recomputation (`"unknown"`). Since you
cannot push to `dependabot/*` branches directly, comment `@dependabot rebase`
on the conflicting PR and wait for it to become `clean`/`unstable`, then
squash-merge it.

### 7. Verify and finish

Confirm no open Dependabot PRs remain
(`search_pull_requests ... is:open author:app/dependabot` → `total_count: 0`)
and report the result.

## Notes

- The shared lockfile fix that makes the combined branch installable (e.g. the
  peer-version alignment) lives on the work branch. `main` only becomes
  installable from a fresh `npm install` once that work branch is merged too, so
  mention this to the user.
- Never merge a PR if the combined test run did not pass.

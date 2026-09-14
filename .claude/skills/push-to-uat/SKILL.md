---
name: push-to-uat
description: Push all changes to the UAT branch with automatic version increment
trigger: /push-to-uat
---

# Push to UAT Skill

Automates the process of committing and pushing changes to the `uat` branch with automatic version bumping.

## Workflow

1. **Verify branch**: Confirm we're on the `uat` branch. If not, switch to it.
2. **Increment version**: Bump the patch version in `package.json` (e.g., 3.12.1 → 3.12.2).
3. **Stage changes**: Add all modified files relevant to the current work.
4. **Commit**: Create a descriptive commit message following conventional commits format.
5. **Push**: Push to `origin uat`.

## Version Numbering

The version follows semantic versioning: `MAJOR.MINOR.PATCH`

- **Patch** (auto-incremented): Bug fixes, small changes, UAT iterations
- **Minor** (manual): New features, significant additions
- **Major** (manual): Breaking changes, major releases

Each push to UAT automatically increments the patch number. For minor or major version bumps, update `package.json` manually before running this skill.

Current version: **3.12.1**

## Commit Message Format

Use conventional commits:
- `feat(scope): description` for new features
- `fix(scope): description` for bug fixes
- `refactor(scope): description` for refactoring
- `docs(scope): description` for documentation
- `test(scope): description` for tests

Common scopes for UAT work:
- `uat` - UAT-specific features (badge, admin pages, etc.)
- `gate` - Maintenance gate / site gate features
- `booking` - Booking system changes
- `admin` - Admin panel features
- `dev2` - Dev2 panel features

## Safety

- Always verify the current branch before pushing
- Only push to `uat` branch, never to `main`
- Version is automatically tracked in package.json
- Stage files explicitly rather than using `git add .`
- Show git status before and after operations

## Example Usage

User types: `/push-to-uat`

Expected behavior:
1. Check current branch
2. Read current version from package.json
3. Increment patch version (3.12.1 → 3.12.2)
4. Update package.json with new version
5. Show changed files
6. Stage relevant changes including package.json
7. Commit with appropriate message and version number
8. Push to origin/uat
9. Confirm success with new version number


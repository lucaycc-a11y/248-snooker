---
name: push-to-uat
description: Push all changes to the UAT branch
trigger: /push-to-uat
---

# Push to UAT Skill

Automates the process of committing and pushing changes to the `uat` branch.

## Workflow

1. **Verify branch**: Confirm we're on the `uat` branch. If not, switch to it.
2. **Stage changes**: Add all modified files relevant to the current work.
3. **Commit**: Create a descriptive commit message following conventional commits format.
4. **Push**: Push to `origin uat`.

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

## Safety

- Always verify the current branch before pushing
- Only push to `uat` branch, never to `main`
- Stage files explicitly rather than using `git add .`
- Show git status before and after operations

## Example Usage

User types: `/push-to-uat`

Expected behavior:
1. Check current branch
2. Show changed files
3. Stage relevant changes
4. Commit with appropriate message
5. Push to origin/uat
6. Confirm success

---
name: Git Workflow
description: Use after completing any task that modifies files. Always commit and push when done.
---

# Git Workflow Skill

## After Every Task
When the user has approved the change, end with:
```bash
git add <specific files>
git commit -m "type: description"
git push
```
Prefer staging specific files over `git add .` to avoid committing unrelated changes.

## Commit Types
- feat: new feature
- fix: bug fix
- redesign: visual/layout changes
- refactor: code cleanup
- security: security improvements
- db: database schema changes

## Rules
- Never commit .env or .env.local
- Never commit API keys
- One logical change per commit
- Descriptive messages in English
- Only commit when the user asks; if unclear, ask first

## Deploy
- Push to main → auto-deploys to 248.formhk.com via Vercel
- Repo: github.com/lucaycc-a11y/248-snooker
- Check deployment at vercel.com/lucaycc-3022s-projects

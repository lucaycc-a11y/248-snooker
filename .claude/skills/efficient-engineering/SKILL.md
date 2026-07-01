---
name: efficient-engineering
description: Token-efficient session discipline. Use to minimize wasted context — avoid re-pasting large content, know when to compact/clear, and choose the right model for the task.
license: MIT
---

# Efficient Engineering

Every prior message and every tool result gets resent on every single turn
of a conversation. Bloat compounds — it doesn't just cost once.

## Context economy
- Prefer targeted reads (@file, specific line ranges, grep-first) over
  dumping whole files or whole diffs when only a section is relevant.
- Don't re-paste large content that's already in context — reference it.
- Never use a "copy for LLM" paste of an entire file when a snippet or
  @file reference would do.

## Session hygiene
- Run /compact after finishing a distinct phase of work — not reactively
  after noticing degraded responses. A healthy session compacts better
  than a degraded one.
- Run /clear when moving to a fully unrelated task, rather than letting
  it pile into the same long thread.
- Run /context if unsure what's consuming the window — check for files
  pulled in that are no longer needed.

## Model choice
- Haiku: simple questions, small edits, non-coding tasks.
- Sonnet: default for day-to-day implementation, refactors, tests, reviews.
- Opus: only for planning genuinely hard/ambiguous problems up front.

## Verification before declaring done
- State how a fix was verified (log checked, test run, actual output
  seen) — not just "should work now".

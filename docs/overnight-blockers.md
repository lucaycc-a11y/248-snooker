# Overnight Blockers

## Phase C - Agent Worktree Mapping Unknown

**Issue**: Cannot identify which agent worktree corresponds to which agent (B/C/D).

**Worktrees found**:
- prompt7-inbox
- prompt7-qa-harness
- 8 agent-a* worktrees with hash suffixes

**What's needed**: Mapping from agent label (B=points, C=inbox, D=home tiles) to worktree branch name.

**Impact**: Cannot merge agents D, B, C in Phase C until mapping is known.

**Workaround options**:
1. User provides mapping
2. Inspect each worktree's file changes to identify
3. Skip Phase C merge, continue with other phases

**Status**: Proceeding with wallet re-audit (Phase C.4) which doesn't require worktree merge.

---

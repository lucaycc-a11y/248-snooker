# Part F Investigation: Page Flicker Bug

## User Report
"Page flicker issue" — exact page/route not specified

## Common Causes of Page Flicker

### 1. useEffect Infinite Loop
```typescript
useEffect(() => {
  setState(newValue) // Triggers re-render
}, [state]) // Depends on state → infinite loop
```

### 2. Component State Fighting
- Parent and child both manage the same state
- Props change triggers state update triggers props change

### 3. Crash/Retry Loop
- Component crashes
- Error boundary catches it
- Component re-mounts
- Crashes again → flicker

### 4. Conditional Rendering with Async State
```typescript
if (!data) return <Loading />
return <Content data={data} />
// Data loads → re-render → flash
```

## Investigation Strategy

1. **Find the affected page** — likely in booking flow based on user context
2. **Check for useEffect dependencies** that could cause loops
3. **Look for state management issues** in ProfileCompletion or AuthCard
4. **Check error logs** for crash/retry patterns

## Need from User

The user said "page flicker" but didn't specify:
- Which page/route?
- When does it happen? (on load, after interaction, continuously?)
- What flickers? (whole page, specific component, loading states?)

Without this info, I should ask the user for the exact page/component where they see the flicker.

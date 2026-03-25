---
inclusion: auto
---

# Documentation Habits

After completing a meaningful chunk of work (new feature, bug fix, refactor, or UI change), update the project documentation:

## Development Progress Log
- File: `docs/progress.md`
- Append a new Phase section describing what was built, changed files, and key decisions
- Keep it in English
- Include architecture changes if any

## Bug Reports
- Directory: `docs/`
- Each distinct debugging session gets its own file: `docs/bug-report-<topic>.md`
- Do NOT append new bugs to existing bug report files — create a new file for each topic
- Include: symptom, root cause, fix, lesson learned, and changed files
- Naming convention: `bug-report-<kebab-case-topic>.md`

## When to Update
- After fixing one or more bugs in a session
- After completing a feature or significant change
- After a refactor that changes architecture
- When the user asks to commit — update docs before committing

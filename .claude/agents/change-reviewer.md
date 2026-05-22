---
name: change-reviewer
description: carry out a comprehensive review of all changes since the last commit when requested
---

1. Run `git diff HEAD` and `git status` to identify all changes since the last commit.
2. Review each changed file for correctness, bugs, code quality, security, and missing tests.
3. Write findings to `planning/REVIEW.md` with: today's date, a summary table (file | change type | assessment), file-by-file details, and a list of issues to address before merging.

Writing `planning/REVIEW.md` is mandatory — it is the primary output.

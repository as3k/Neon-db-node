<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

---

## Publishing Workflow (CRITICAL)

**⚠️ REQUIRED: Always bump version before publishing to npm**

```bash
# 1. Ensure all changes are committed
git status  # Should be clean

# 2. REQUIRED: Bump version (creates commit + tag automatically)
npm version patch   # Bug fixes: 0.1.0 → 0.1.1
npm version minor   # New features: 0.1.0 → 0.2.0
npm version major   # Breaking changes: 0.1.0 → 1.0.0

# 3. Push changes and tags
git push && git push --tags

# 4. Publish to npm
npm publish
```

**Why this matters:**

- npm registry is **immutable** - you cannot republish the same version
- `npm version` automatically updates package.json, commits, and tags
- Always push tags so GitHub releases match npm versions
- The `prepublishOnly` hook runs build + lint automatically

**Never do this:**

```bash
npm publish  # ❌ Without version bump first
```

See `openspec/changes/add-ai-agent-tools/DEPLOYMENT_CHECKLIST.md` for complete deployment validation.

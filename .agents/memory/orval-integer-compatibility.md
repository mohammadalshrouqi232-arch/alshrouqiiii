---
name: OpenAPI numeric compatibility
description: Compatibility note for OpenAPI code generation and the installed Zod runtime.
---

When the installed Orval output targets a Zod runtime without `z.int()`, prefer OpenAPI `number` for numeric API fields unless the generator/runtime versions are upgraded together.

**Why:** The generated API validators can compile with `zod.int()` while the workspace runtime exposes the older Zod API, causing the full library typecheck to fail after otherwise valid codegen.

**How to apply:** If generated validators report that `z.int` is missing, inspect the installed Zod version and either align the generator/runtime or use `number` in the contract for IDs and counts.
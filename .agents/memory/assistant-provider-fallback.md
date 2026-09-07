---
name: Assistant provider fallback
description: Why the Study Party assistant needs a provider-independent fallback
---

The Study Party assistant must return useful study guidance even when the configured model provider is unavailable or out of quota. Managed OpenAI provisioning is gated behind an account upgrade in this workspace, and the direct provider credential has returned quota errors.

**Why:** A provider error should not turn the core assistant interaction into a dead end for students.

**How to apply:** Keep provider calls optional, return a contextual study response on missing credentials, quota errors, and transient upstream failures, and avoid exposing provider details in the student-facing UI.
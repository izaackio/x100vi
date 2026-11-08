# First executable build: decisions and limits

This build implements the three authorised steps: app scaffolding, the deterministic deal engine and a usable manual owner workflow. The broader specification remains the target for source integration and release.

## Implemented choices

- **Next.js, React, TypeScript and PostgreSQL**, with a separate worker. Web mutations use authenticated Next.js server actions rather than adding a second REST API surface before external clients exist.
- **Operator-provisioned owner credentials through Auth.js**, with scrypt password hashing and eight-hour JWT sessions. No SMTP account is needed. Email delivery, email verification and recovery flows are not implemented yet; the provisioned email is an allowlisted identifier.
- **Minimal durable PostgreSQL jobs** rather than pg-boss for this bounded stored-evidence task. Jobs execute in one transaction with skip-locked claiming; process failures roll work back. External collectors will require independent per-source jobs, retries, budgets and terminal failure states before they are enabled.
- **Manual, user-reported evidence only** at the web boundary. The domain engine can evaluate source-observed fixtures for tests, but the UI/server action cannot elevate imported evidence to source-confirmed. Whole price/route records share one provenance envelope in this slice; field-specific adapter evidence and fee rules arrive with collectors.
- **Explicit Swedish amount formats and integer öre.** Unknown values remain null. Inclusive prices declare their scope, and the collection route includes an explicit travel allowance.
- **Text validation without AI.** Clear model/object exclusions and text contradictions produce rejection or review. Unknowns are conservative; text rules do not promise to understand every listing or establish physical condition.
- **Rechecks preserve evidence age.** A worker evaluation is not a source check. Update evidence after manually checking a page; source-specific observations will later be created only by qualified adapters.

## Deferred requirements

Live page retrieval, source API qualification, automatically following Fotosidan auction links, cross-source duplicate detection, source-level incremental collection, auctions' affordable-bid ceilings/reminders, fee-rule versioning, recurring monitoring, external alerts and deployment are not implemented. No scheduler or messaging integration is activated.

The source search links are conveniences, not verified collector endpoints. Individual URLs are restricted to known marketplace hosts and item-ID routes; no outbound URL fetching occurs in this slice. Future collectors must add redirect/DNS/SSRF protections before introducing any fetch capability.

Watch selection/settings, source filters, listing filters and imported evidence are persisted. Saving a watch schedules nothing. Search now lists selected sources as manual-required and re-evaluates retained records; manual imports never populate the source-confirmed Within budget tab. The separate below/at-or-above budget indicator still makes cost comparisons useful.

History is retained in PostgreSQL. Automatic retention, owner export/deletion UI, backup automation, an email-provider integration and a hosted URL remain deployment/release work; no claim is made that these operational requirements are complete.

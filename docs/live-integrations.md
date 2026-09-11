# Live integrations

## Discovery

Run discovery searches all three tracks. Tabs only filter the displayed results. SCOUT runs tracks sequentially to limit provider load, with four concurrent category-specific searches per track. Each calls You.com Search (`POST https://ydc-index.io/v1/search`, up to 20 web results) and passes public candidate metadata to You.com Research (`POST https://api.you.com/v1/research`). Research checks official terms and returns up to six structured opportunities per category. Search failure falls back to direct Research; individual category failures preserve successful results and produce a partial-result event.

The backend filters expired deadlines and unsafe links, removes tracking parameters and deduplicates official URLs. Results are leads, not verified eligibility. Null payouts are displayed as unpublished; no data is invented to reach a target count. Repeated discovery does not replace an attested claim's source requirements. No private documents, mailbox content or assumed purchase history enter discovery.

## Gmail drafts through One

For this single-owner, loopback-only workspace, `ONE_SECRET` and `ONE_GMAIL_CONNECTION_KEY` are stored in ignored `.env.local`. Restart the web process after changing them. Settings reports configuration, not a continuous provider health check.

An explicitly requested Gmail draft requires an attested claim and an unchanged packet fingerprint. The server calls a fixed draft endpoint through One with the Create Draft action ID; caller input cannot select the method, action, connection or path. The recipient is empty and attachments are not uploaded automatically. The user reviews the draft in Gmail, adds the verified administrator address and reviewed evidence, and sends it themselves. There is no application send endpoint or inbox scan. A successful draft ID prevents repeat creation for the same claim. On ambiguous network failure, check Gmail before retrying: the upstream API does not offer transactional idempotency here.

This connection is for the local workspace owner. Before public or multi-user deployment, replace environment-level mailbox selection with authenticated per-user One AuthKit connections and server-side ownership validation. The loopback restriction must remain until this is implemented.

Live validation created one recipient-free draft titled “CLAIMANT connection test — unsent draft”; no email was sent.

Sources:
- https://www.withone.ai/docs/api-reference/passthrough/passthrough
- One official CLI package `@withone/cli@1.56.1` (required `x-one-action-id` header)
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
- https://you.com/docs/api-reference/search/v1-search

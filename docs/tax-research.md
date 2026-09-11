# Tax research extension

This extends the TDD's source-backed SCOUT pattern; tax research was not a complete tax-advice workflow in the supplied documents. The platform research document explicitly separates source-cited reasoning from legal advice. This panel follows that boundary.

Each claim has a state selector (50 states plus DC), tax year, explicit research action, and a prominent informational-only disclaimer. Two live You.com Research requests retrieve federal and selected-state findings. Each finding includes named authority, applicable period or uncertainty, and government source links. Federal retrieval is restricted to IRS, US Code, Congress and eCFR domains. State research requests the selected jurisdiction's enacted laws and revenue guidance; returned links must be .gov or state.xx.us. That domain check establishes a government domain, not semantic correctness or personal applicability.

Only the public opportunity description, state and year are shared. No receipt, signature, mailbox data, taxpayer ID or income is sent. Sources are research evidence, not instructions. Findings with no accepted government citation are omitted. Jurisdiction failures remain visible and never become a taxability conclusion.

Research does not change eligibility, packet hashes, signatures, payouts or draft content. It does not calculate taxes or submit returns. The response includes retrieval time, missing facts and an explicit disclaimer. Reports are currently held in the panel for the current visit, not stored as durable legal records. State selection does not infer residency. Production expansion should add durable report provenance, source-content verification and tax-professional review.

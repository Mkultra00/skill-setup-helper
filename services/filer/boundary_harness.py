"""Fixed synthetic email/administrator scenario. Never contacts a real administrator."""
from email.message import EmailMessage
import hashlib
import json


def prepare(claims, confirmed, expected_hash, actual_hash):
    if len(claims) != 1:
        raise ValueError("bulk request denied")
    if not confirmed or expected_hash != actual_hash:
        raise ValueError("attestation gate denied")
    draft = EmailMessage()
    draft["From"] = "claimant@example.test"
    draft["To"] = "administrator@example.test"
    draft["Reply-To"] = "claimant@example.test"
    draft["Subject"] = "Individual claim draft"
    draft.set_content("Synthetic attested packet. Awaiting the user's send action.")
    return draft


def run():
    fingerprint = hashlib.sha256(b"synthetic evidence").hexdigest()
    draft = prepare(["one"], True, fingerprint, fingerprint)
    checks = []
    def rejects(name, operation):
        try:
            operation()
            checks.append({"name": name, "passed": False})
        except ValueError:
            checks.append({"name": name, "passed": True})
    checks.append({"name": "Happy path creates an individual draft, never sends it", "passed": draft["To"] == "administrator@example.test"})
    checks.append({"name": "Draft preserves the claimant's direct correspondence address", "passed": draft["From"] == draft["Reply-To"] == "claimant@example.test"})
    rejects("Bulk request fails closed", lambda: prepare(["one", "two"], True, fingerprint, fingerprint))
    rejects("Unsigned packet fails closed", lambda: prepare(["one"], False, fingerprint, fingerprint))
    rejects("Changed evidence invalidates attestation", lambda: prepare(["one"], True, fingerprint, "changed"))
    checks.append({"name": "No bulk correspondence headers", "passed": not any(draft[h] for h in ["Bcc", "List-ID", "List-Unsubscribe"])})
    return checks


if __name__ == "__main__":
    print(json.dumps({"checks": run()}))

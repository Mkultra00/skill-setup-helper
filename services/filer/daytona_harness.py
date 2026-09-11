"""Retain a named demo sandbox, including code and results, for dashboard inspection."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams


def run():
    client = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))
    name = "claimant-demo-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    sandbox = client.create(CreateSandboxFromSnapshotParams(
        name=name, language="python", ephemeral=False, auto_stop_interval=5,
        auto_pause_interval=0, auto_delete_interval=-1, ttl_minutes=0,
        network_block_all=True, labels={"app": "claimant", "purpose": "demo-safety-checks"},
    ), timeout=60)
    code = Path(__file__).with_name("boundary_harness.py").read_text()
    runner = f'''import json, runpy
from pathlib import Path
folder = Path.home() / "claimant-demo"
folder.mkdir(exist_ok=True)
(folder / "boundary_harness.py").write_text({code!r})
module = runpy.run_path(str(folder / "boundary_harness.py"))
payload = {{"checks": module["run"]()}}
(folder / "results.json").write_text(json.dumps(payload, indent=2))
(folder / "README.txt").write_text("CLAIMANT synthetic safety tests. No real claims or email submissions. Run: python boundary_harness.py. Results: results.json. This sandbox is retained for demo inspection.")
print(json.dumps({{**payload, "artifactPath": str(folder)}}))
'''
    result = sandbox.process.code_run(runner, timeout=60)
    if result.exit_code != 0:
        raise RuntimeError(f"Tests failed to execute. Retained sandbox for inspection: {sandbox.id}")
    payload = json.loads(result.result.strip().splitlines()[-1])
    return {"mode": "daytona", "sandboxId": sandbox.id, "sandboxName": name,
            "retained": True, "artifactPath": payload["artifactPath"], "checks": payload["checks"]}


if __name__ == "__main__":
    print(json.dumps(run()))

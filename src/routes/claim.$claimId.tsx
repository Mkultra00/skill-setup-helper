import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/claimant/workspace";
export const Route = createFileRoute("/claim/$claimId")({ component: ClaimRoute });
function ClaimRoute() {
  const { claimId } = Route.useParams();
  return <WorkspaceApp initialClaimId={claimId} />;
}

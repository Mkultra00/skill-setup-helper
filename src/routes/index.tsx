import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/claimant/workspace";
export const Route = createFileRoute("/")({ component: WorkspaceApp });

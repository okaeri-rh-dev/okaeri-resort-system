import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const Route = createFileRoute("/$_")({
  component: NotFoundPage,
});

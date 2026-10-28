import { Button, Callout } from "@/components/patterns";

export function LoadErrorCallout({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Callout tone="danger" title={title}>
      <p>Check your connection, then try again.</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </Callout>
  );
}

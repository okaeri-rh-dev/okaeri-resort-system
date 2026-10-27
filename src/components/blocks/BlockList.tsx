import { StatusBadge } from "@/components/patterns";
import type { Block } from "@/hooks/useBlocks";
import { blockNightsLabel, blockPhase } from "@/lib/blocks";

interface BlockListProps {
  blocks: Block[];
  today: string;
  cabinName: (unitId: string) => string;
  onOpen: (block: Block) => void;
  empty: string;
}

const phaseBadges = {
  running: <StatusBadge tone="warning">Now</StatusBadge>,
  upcoming: <StatusBadge tone="info">Upcoming</StatusBadge>,
  over: <StatusBadge tone="neutral">Over</StatusBadge>,
};

export function BlockList({ blocks, today, cabinName, onOpen, empty }: BlockListProps) {
  if (blocks.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;

  return (
    <ul className="bg-card divide-y rounded-lg border">
      {blocks.map((block) => (
        <li key={block.blackout_id}>
          <button
            type="button"
            onClick={() => onOpen(block)}
            className="hover:bg-accent focus-visible:ring-ring coarse:min-h-11 flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="medium:w-64 w-full font-medium tabular-nums">
              {blockNightsLabel(block.start_date, block.end_date)}
            </span>
            <span className="medium:w-32 min-w-0 truncate">
              {block.unit_id === null ? <WholeResortBadge /> : cabinName(block.unit_id)}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{block.reason}</span>
            {phaseBadges[blockPhase(block, today)]}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function WholeResortBadge() {
  return <StatusBadge tone="danger">Whole resort</StatusBadge>;
}

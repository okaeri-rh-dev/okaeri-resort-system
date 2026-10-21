import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";

import { contactChannelIcons } from "@/components/contact-channels/contact-channel-icons";
import {
  ActionMenu,
  Button,
  DataTable,
  ListCard,
  ListCardRow,
  StatusBadge,
  TableEmptyState,
  TableSkeleton,
  type ActionMenuAction,
} from "@/components/patterns";
import {
  useContactChannels,
  useReorderContactChannel,
  useSetContactChannelActive,
  type ContactChannel,
} from "@/hooks/useContactChannels";
import {
  contactChannelKindNames,
  toDisplayValue,
  toKindLabel,
  type MoveDirection,
} from "@/lib/contact-channel";

interface ContactChannelsTableProps {
  onEditChannel: (channel: ContactChannel) => void;
}

function ChannelStatus({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusBadge tone="success">Shown</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Hidden</StatusBadge>
  );
}

function KindName({ channel }: { channel: ContactChannel }) {
  const name = contactChannelKindNames[channel.kind];
  const Icon = contactChannelIcons[channel.kind];
  return (
    <span className="flex items-center gap-2 font-medium">
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      {name}
    </span>
  );
}

interface MoveButtonsProps {
  channel: ContactChannel;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onMove: (direction: MoveDirection) => void;
}

function MoveButtons({ channel, canMoveUp, canMoveDown, disabled, onMove }: MoveButtonsProps) {
  const kindLabel = toKindLabel(channel);
  const moves = [
    { direction: "up", Icon: ArrowUp, allowed: canMoveUp },
    { direction: "down", Icon: ArrowDown, allowed: canMoveDown },
  ] as const;

  return (
    <span className="inline-flex gap-1">
      {moves.map(({ direction, Icon, allowed }) =>
        allowed ? (
          <Button
            key={direction}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Move ${kindLabel} ${direction}`}
            disabled={disabled}
            onClick={() => onMove(direction)}
          >
            <Icon aria-hidden="true" />
          </Button>
        ) : (
          <span
            key={direction}
            className="coarse:min-h-11 coarse:min-w-11 size-8"
            aria-hidden="true"
          />
        )
      )}
    </span>
  );
}

export function ContactChannelsTable({ onEditChannel }: ContactChannelsTableProps) {
  const { data: channels = [], isLoading, isError, refetch } = useContactChannels();
  const setActive = useSetContactChannelActive();
  const reorder = useReorderContactChannel();

  const moveButtons = (channel: ContactChannel, index: number) => (
    <MoveButtons
      channel={channel}
      canMoveUp={index > 0}
      canMoveDown={index < channels.length - 1}
      disabled={reorder.isPending}
      onMove={(direction) => reorder.mutate({ channel, direction })}
    />
  );

  const rowActions = (channel: ContactChannel): ActionMenuAction[] => [
    { label: "Edit", onClick: () => onEditChannel(channel) },
    channel.is_active
      ? { label: "Hide", onClick: () => setActive.mutate({ id: channel.id, isActive: false }) }
      : { label: "Show", onClick: () => setActive.mutate({ id: channel.id, isActive: true }) },
  ];

  const actionsLabel = (channel: ContactChannel) =>
    `Actions for ${toKindLabel(channel)} ${toDisplayValue(channel)}`;

  const columns: ColumnDef<ContactChannel>[] = [
    {
      id: "kind",
      header: "Kind",
      cell: ({ row }) => <KindName channel={row.original} />,
    },
    {
      id: "label",
      header: "Label",
      cell: ({ row }) => row.original.label ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => <span className="wrap-break-word">{toDisplayValue(row.original)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <ChannelStatus isActive={row.original.is_active} />,
    },
    {
      id: "order",
      header: "Order",
      meta: { align: "right" },
      cell: ({ row }) => moveButtons(row.original, row.index),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { pinned: true },
      cell: ({ row }) => (
        <ActionMenu label={actionsLabel(row.original)} actions={rowActions(row.original)} />
      ),
    },
  ];

  const table = useReactTable({
    data: channels,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (channel) => channel.id,
  });

  if (isLoading) {
    return <TableSkeleton rows={4} columns={6} label="Loading contact channels" />;
  }

  if (isError) {
    return (
      <TableEmptyState
        variant="error"
        title="Could not load contact channels"
        description="Check your connection, then try again."
        action={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <DataTable
      table={table}
      label="Contact channels"
      renderCard={(row) => {
        const channel = row.original;
        return (
          <ListCard>
            <div className="flex items-start justify-between gap-2">
              <KindName channel={channel} />
              <ActionMenu label={actionsLabel(channel)} actions={rowActions(channel)} />
            </div>
            <ListCardRow
              label="Value"
              value={<span className="wrap-break-word">{toDisplayValue(channel)}</span>}
            />
            {channel.label && <ListCardRow label="Label" value={channel.label} />}
            <ListCardRow label="Status" value={<ChannelStatus isActive={channel.is_active} />} />
            <ListCardRow label="Order" value={moveButtons(channel, row.index)} />
          </ListCard>
        );
      }}
      emptyState={
        <TableEmptyState
          title="No contact channels yet"
          description="Add a phone number, email or page so guests can reach you."
        />
      }
    />
  );
}

import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import {
  contactChannelKinds,
  toDisplayValue,
  toKindLabel,
} from "@/components/contact-channels/contact-channel";
import {
  ActionMenu,
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
  useSetContactChannelActive,
  type ContactChannel,
} from "@/hooks/useContactChannels";

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
  const { name, Icon } = contactChannelKinds[channel.kind];
  return (
    <span className="flex items-center gap-2 font-medium">
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      {name}
    </span>
  );
}

export function ContactChannelsTable({ onEditChannel }: ContactChannelsTableProps) {
  const { data: channels = [], isLoading, isError, refetch } = useContactChannels();
  const setActive = useSetContactChannelActive();

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
      accessorKey: "display_order",
      header: "Order",
      meta: { align: "right" },
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
            <ListCardRow label="Order" value={channel.display_order} />
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

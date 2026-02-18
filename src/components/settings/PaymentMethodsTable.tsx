import { useState } from "react";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Banknote,
  Building2,
  CreditCard,
  Edit,
  Eye,
  EyeOff,
  MoreHorizontal,
  RefreshCcw,
  Smartphone,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeletePaymentMethod,
  usePaymentMethods,
  useReactivatePaymentMethod,
} from "@/hooks/usePaymentMethods";
import { cn } from "@/lib/utils";
import type { PaymentMethodConfig, PaymentMethodType } from "@/types";

// Icon mapping
const METHOD_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone,
  Building2,
  CreditCard,
  Wallet,
  Banknote,
};

const METHOD_TYPE_BADGES: Record<
  PaymentMethodType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  "e-wallet": { label: "E-Wallet", variant: "secondary" },
  "bank-transfer": { label: "Bank Transfer", variant: "default" },
  cash: { label: "Cash", variant: "outline" },
  other: { label: "Other", variant: "outline" },
};

interface PaymentMethodsTableProps {
  onEditMethod?: (method: PaymentMethodConfig) => void;
}

export function PaymentMethodsTable({ onEditMethod }: PaymentMethodsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "display_order", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: methods = [], isLoading, isError, refetch } = usePaymentMethods();
  const deactivate = useDeletePaymentMethod();
  const reactivate = useReactivatePaymentMethod();

  const columns: ColumnDef<PaymentMethodConfig>[] = [
    {
      accessorKey: "display_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Payment Method
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const method = row.original;
        const Icon = METHOD_TYPE_ICONS[method.icon_name] || CreditCard;

        return (
          <div className="flex items-center gap-3">
            <div className={cn("bg-muted flex h-9 w-9 items-center justify-center rounded-lg")}>
              <Icon className={cn("h-5 w-5", method.icon_color)} />
            </div>
            <div>
              <div className="font-medium">{method.display_name}</div>
              <div className="text-muted-foreground text-xs">{method.provider_name}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "method_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("method_type") as PaymentMethodType;
        const badge = METHOD_TYPE_BADGES[type] || METHOD_TYPE_BADGES.other;
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      accessorKey: "account_number",
      header: "Account Number",
      cell: ({ row }) => {
        const number = row.getValue("account_number") as string | null;
        return number ? (
          <span className="font-mono text-sm">{number}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      },
    },
    {
      id: "qr_code",
      header: "QR Code",
      cell: ({ row }) => {
        const method = row.original;
        return method.qr_code_url ? (
          <img
            src={method.qr_code_url}
            alt={`${method.display_name} QR`}
            className="h-10 w-10 rounded border object-contain"
          />
        ) : (
          <span className="text-muted-foreground text-xs">None</span>
        );
      },
    },
    {
      accessorKey: "display_order",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Order
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.getValue("display_order")}</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        return isActive ? (
          <Badge variant="default" className="bg-green-600">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const method = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEditMethod?.(method)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {method.is_active ? (
                <DropdownMenuItem
                  onClick={() => deactivate.mutate(method.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <EyeOff className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => reactivate.mutate(method.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: methods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load payment methods</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search payment methods..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cn(!row.original.is_active && "opacity-50")}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No payment methods configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

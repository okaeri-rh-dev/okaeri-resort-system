import * as React from "react";

import { ChevronRight, Home, MoreHorizontal } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { isObject } from "@/lib/type-guards";
// import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
    className?: string;
  }
>(({ className, separator: _separator, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    className={cn(
      "flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-400",
      className
    )}
    {...props}
  />
));
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol"> & {
    className?: string;
  }
>(({ className, ...props }, ref) => (
  <ol ref={ref} className={cn("flex items-center gap-1", className)} {...props} />
));
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li"> & {
    className?: string;
  }
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("flex items-center gap-1", className)} {...props} />
));
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    className?: string;
    asChild?: boolean;
  }
>(({ className, asChild, ...props }, ref) => {
  if (asChild) {
    return (
      <span
        ref={ref as React.RefObject<HTMLSpanElement>}
        className={cn(
          "hover:text-ocean-600 dark:hover:text-ocean-400 focus-visible:ring-ocean-500 -mx-1 -my-0.5 rounded-sm px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          className
        )}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(isObject(props) ? (props as any) : {})}
      />
    );
  }

  return (
    <a
      ref={ref}
      className={cn(
        "hover:text-ocean-600 dark:hover:text-ocean-400 focus-visible:ring-ocean-500 -mx-1 -my-0.5 rounded-sm px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span"> & {
    className?: string;
  }
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-medium text-gray-900 dark:text-gray-100", className)}
    {...props}
  />
));
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li"> & {
    className?: string;
    children?: React.ReactNode;
  }
>(({ className, children, ...props }, ref) => (
  <li
    ref={ref}
    role="presentation"
    aria-hidden="true"
    className={cn("flex items-center", className)}
    {...props}
  >
    {children ?? <ChevronRight className="h-4 w-4" />}
  </li>
));
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span"> & {
    className?: string;
  }
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
));
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";

// Auto-generating breadcrumb component for resort pages
const ResortBreadcrumb = () => {
  const location = { pathname: window.location.pathname };
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const getPageTitle = (segment: string, index: number, segments: string[]) => {
    const titleMap: Record<string, string> = {
      dashboard: "Dashboard",
      bookings: "Bookings",
      expenses: "Expenses",
      properties: "Properties",
      reports: "Reports",
      team: "Team",
      settings: "Settings",
      project: "Resort Settings",
    };

    // Handle dynamic segments (e.g., IDs)
    if (!titleMap[segment] && index > 0) {
      const prevSegment = segments[index - 1];
      if (prevSegment === "bookings") return `Booking #${segment}`;
      if (prevSegment === "expenses") return `Expense #${segment}`;
      if (prevSegment === "properties") return `Property #${segment}`;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    return titleMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const getBreadcrumbPath = (index: number) => {
    return `/${pathSegments.slice(0, index + 1).join("/")}`;
  };

  if (pathSegments.length <= 1) return null;

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={ROUTES.dashboard} className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Dashboard</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathSegments.length > 3 && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
          </>
        )}

        {pathSegments
          .slice(pathSegments.length > 3 ? -2 : 0)
          .map((segment: unknown, index: number, visibleSegments: unknown[]) => {
            const actualIndex = pathSegments.length > 3 ? pathSegments.length - 2 + index : index;
            const isLast = index === visibleSegments.length - 1;
            const path = getBreadcrumbPath(actualIndex);
            const title = getPageTitle(String(segment), actualIndex, pathSegments);

            return (
              <React.Fragment key={actualIndex}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={path}>{title}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  ResortBreadcrumb,
};

// UI Component Exports for Okaeri Resort Management System
// This file provides a centralized export for all UI components

export { Button, buttonVariants, type ButtonProps } from "./button";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatsCard,
  FeatureCard,
  cardVariants,
  type CardProps,
} from "./card";

export {
  Input,
  CurrencyInput,
  SearchInput,
  PhoneInput,
  inputVariants,
  type InputProps,
} from "./input";

export {
  Label,
  FieldLabel,
  SectionLabel,
  FormGroup,
  labelVariants,
  type LabelProps,
} from "./label";

export { RequiredIndicator, type RequiredIndicatorProps } from "./required-indicator";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  ResortBreadcrumb,
} from "./breadcrumb";

// Error Boundary Components
export {
  ErrorBoundary,
  RouteErrorBoundary,
  RetryError,
  OfflineError,
  OfflineIndicator,
  OfflineToast,
  withErrorBoundary,
  useRouteError,
  useRetry,
  useOnlineStatus,
  useOfflineData,
} from "../error";

// Loading Components
export {
  SkeletonLoader,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  FormSkeleton,
  PropertyDetailSkeleton,
  ListSkeleton,
  NavigationSkeleton,
  SuspenseFallback,
  PageSuspenseFallback,
  ComponentSuspenseFallback,
  ModalSuspenseFallback,
  DashboardSuspenseFallback,
  FormSuspenseFallback,
  TableSuspenseFallback,
  ProgressBar,
  PageLoadProgress,
  FormProgress,
  ModalProgress,
  ProgressProvider,
  withSuspense,
  useProgress,
  useAutoProgress,
  useAsyncProgress,
} from "../loading";

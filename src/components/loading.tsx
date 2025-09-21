export interface LoadingProps {
  message?: string;
  className?: string;
}

export function Loading({ message = "Loading...", className }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center p-4 ${className || ""}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      <span className="ml-2">{message}</span>
    </div>
  );
}

export default Loading;

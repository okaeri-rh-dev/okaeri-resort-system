export interface ErrorProps {
  message?: string;
  className?: string;
}

export function Error({ message = "An error occurred", className }: ErrorProps) {
  return (
    <div className={`p-4 text-red-600 ${className || ""}`}>
      <p>{message}</p>
    </div>
  );
}

export default Error;

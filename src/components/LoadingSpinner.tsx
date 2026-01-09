type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[3px]",
  lg: "h-9 w-9 border-[3px]",
};

export default function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-solid border-stone-300 border-t-stone-700 ${
        SIZE_CLASSES[size]
      } ${className}`.trim()}
    />
  );
}

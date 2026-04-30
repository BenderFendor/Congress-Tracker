export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" }
  return (
    <div className="flex items-center justify-center p-16">
      <div className={`${sizes[size]} border-4 border-accent border-t-transparent rounded-full animate-spin`} />
    </div>
  )
}

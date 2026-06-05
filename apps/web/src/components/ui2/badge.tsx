import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "artivus-badge inline-flex items-center transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-[var(--artivus-border-subtle)] text-[var(--artivus-text-muted)]",
        accent:
          "border-[var(--artivus-accent-purple)] text-[var(--artivus-accent-purple)] bg-[rgba(139,92,246,0.1)]",
        success:
          "border-[var(--artivus-success)] text-[#4ade80]",
        warning:
          "border-[rgba(234,179,8,0.5)] text-[#eab308]",
        error:
          "border-[rgba(239,68,68,0.5)] text-[#ef4444]",
      },
      size: {
        default: "px-3 py-1.5 text-[10px]",
        sm: "px-2.5 py-1 text-[9px]",
        lg: "px-4 py-2 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

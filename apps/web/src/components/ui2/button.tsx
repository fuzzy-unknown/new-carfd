import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "artivus-btn group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap outline-none select-none",
  {
    variants: {
      variant: {
        default:
          "px-6 py-4 bg-transparent border border-[var(--artivus-border-hover)] text-[var(--artivus-text-primary)]",
        outline:
          "px-5 py-3 bg-transparent border border-[var(--artivus-border-subtle)] text-[var(--artivus-text-secondary)] hover:border-[var(--artivus-border-hover)] hover:text-[var(--artivus-text-primary)]",
        ghost:
          "px-5 py-3 bg-transparent border-transparent text-[var(--artivus-text-secondary)] hover:bg-[rgba(139,92,246,0.1)] hover:text-[var(--artivus-accent-purple)]",
        link: "text-[var(--artivus-accent-purple)] underline-offset-4 hover:underline px-0 py-0",
      },
      size: {
        default: "text-[11px] tracking-[4px] uppercase font-medium h-11",
        sm: "text-[10px] tracking-[3px] uppercase font-medium h-9 px-5",
        lg: "text-[12px] tracking-[5px] uppercase font-medium h-13 px-8",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

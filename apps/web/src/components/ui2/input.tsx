import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="artivus-input-wrapper relative">
        <input
          type={type}
          className={cn(
            "artivus-input flex h-11 w-full rounded-md bg-transparent px-3 py-4 text-sm text-[var(--artivus-text-primary)] ring-offset-background placeholder:text-[var(--artivus-text-muted)] placeholder:italic focus-visible:border-[var(--artivus-accent-purple)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-300",
            className
          )}
          ref={ref}
          {...props}
        />
        <div className="artivus-input-line"></div>
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }

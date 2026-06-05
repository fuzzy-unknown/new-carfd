import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <div className="artivus-input-wrapper relative">
      <textarea
        className={cn(
          "artivus-input flex min-h-[120px] w-full rounded-md bg-transparent px-3 py-4 text-sm text-[var(--artivus-text-primary)] ring-offset-background placeholder:text-[var(--artivus-text-muted)] placeholder:italic focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
      <div className="artivus-input-line"></div>
    </div>
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

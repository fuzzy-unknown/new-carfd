import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <label className="artivus-checkbox inline-flex items-center cursor-pointer select-none">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "artivus-checkbox-input peer",
        className
      )}
      {...props}
    >
      <div className="artivus-checkbox-box">
        <CheckboxPrimitive.Indicator>
          <Check className="h-3 w-3 text-[var(--artivus-bg-primary)]" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </div>
    </CheckboxPrimitive.Root>
  </label>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

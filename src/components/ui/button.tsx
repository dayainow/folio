import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Folio 버튼 토큰
 * - 최소 터치 타겟 44×44
 * - primary: slate-900 / secondary: slate-100+slate-900 / danger: red-600
 * - radius: rounded-lg · shadow: shadow-sm · focus: 2px solid ring
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap",
    "shadow-sm transition-all outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
    "dark:focus-visible:ring-slate-100 dark:focus-visible:ring-offset-background",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale disabled:shadow-none",
    "aria-invalid:border-red-600 aria-invalid:ring-2 aria-invalid:ring-red-600/30",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
        outline:
          "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 aria-expanded:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 aria-expanded:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        ghost:
          "shadow-none text-slate-900 hover:bg-slate-100 aria-expanded:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600 dark:bg-red-600 dark:hover:bg-red-500",
        link: "shadow-none text-slate-900 underline-offset-4 hover:underline dark:text-slate-100",
      },
      size: {
        default: "h-11 min-h-11 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-11 min-h-11 gap-2 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-11 min-h-11 gap-2 px-3 text-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "h-12 min-h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11 min-h-11 min-w-11",
        "icon-xs": "size-11 min-h-11 min-w-11 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-11 min-h-11 min-w-11",
        "icon-lg": "size-12 min-h-12 min-w-12",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

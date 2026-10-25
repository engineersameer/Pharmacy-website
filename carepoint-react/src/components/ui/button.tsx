import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Pill buttons in the CarePoint style. For links, use buttonVariants() on an <a>.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-semibold whitespace-nowrap select-none transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-luxe outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "shine bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-glow",
        ghost:
          "bg-glass text-foreground border-glass-border backdrop-blur-md hover:border-primary hover:text-primary",
        outline:
          "border-input bg-transparent text-foreground hover:border-primary hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[50px] px-[26px] text-[0.98rem]",
        sm: "h-11 px-5 text-[0.92rem]",
        icon: "size-11 rounded-xl border-glass-border bg-glass text-foreground hover:border-primary hover:text-primary",
        "icon-round": "size-11 border-glass-border bg-glass text-foreground hover:border-primary hover:text-primary hover:shadow-glow",
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

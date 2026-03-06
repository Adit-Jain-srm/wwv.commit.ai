import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-sky-600 text-slate-50 hover:bg-sky-500 shadow-sm shadow-sky-900/40",
        subtle:
          "bg-slate-800/70 text-slate-100 hover:bg-slate-700/80 border border-slate-700/80",
        outline:
          "border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-100",
        ghost:
          "hover:bg-slate-800/70 hover:text-slate-100 text-slate-300 border border-transparent",
        destructive:
          "bg-red-600 text-slate-50 hover:bg-red-500 shadow-sm shadow-red-900/40"
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 rounded-sm px-2.5 text-xs",
        lg: "h-10 rounded-md px-4",
        icon: "h-8 w-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";


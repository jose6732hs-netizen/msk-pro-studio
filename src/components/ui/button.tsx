import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:bg-primary-foreground dark:text-primary dark:hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-900/80",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-50",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-slate-800 dark:hover:text-slate-50",
        link: "text-primary underline-offset-4 hover:underline dark:text-slate-200",
        "outline-dark": "border border-slate-600 bg-slate-900 text-slate-100 shadow-sm hover:bg-slate-800 hover:text-white dark:border-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  themeToggle?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, themeToggle = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const toggleClasses = themeToggle ? "rounded-full aspect-square p-0" : "";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), toggleClasses)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
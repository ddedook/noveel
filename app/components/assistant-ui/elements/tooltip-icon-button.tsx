"use client";

import { type ComponentPropsWithRef, forwardRef } from "react";

import { Button, Tooltip } from "@heroui/react";
import { cn } from "@/app/lib/utils";

export type TooltipIconButtonProps = Omit<
  ComponentPropsWithRef<typeof Button>,
  "children"
> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
};

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
  return (
    <Tooltip delay={0}>
      <Button
        variant="ghost"
        isIconOnly
        {...rest}
        className={cn(
          "aui-button-icon size-6 p-1 transition-transform active:scale-[0.96]",
          className,
        )}
        ref={ref}
      >
        {children}
        <span className="aui-sr-only sr-only">{tooltip}</span>
      </Button>
      <Tooltip.Content placement={side}>{tooltip}</Tooltip.Content>
    </Tooltip>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";

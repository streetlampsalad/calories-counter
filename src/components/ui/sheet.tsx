"use client";

import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";

// Every sheet in the app comes up from the bottom, so this is a bottom sheet. It is built on the
// Drawer, which adds dragging it down to close it (spec 015): a drag past the threshold, or a quick
// flick, closes it exactly as a tap on the backdrop does, through `onOpenChange`. A drag that
// starts inside something scrolled scrolls it first, and only moves the sheet from the top.

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        // Fades out as the sheet is dragged away.
        "fixed inset-0 z-50 min-h-dvh bg-black/10 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-150 data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "bottom",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  /** Kept for the callers that name it; sheets only come from the bottom. */
  side?: "bottom";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Viewport
        data-slot="sheet-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            // Follows the finger by --drawer-swipe-movement-y, and leaves downwards, faster for a
            // harder flick. data-[side=bottom]:h-auto is replaceable by a caller's own height.
            "relative flex w-full touch-auto flex-col gap-4 overscroll-contain border-t bg-popover bg-clip-padding text-popover-foreground text-sm shadow-lg outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*300ms)] data-swiping:select-none data-swiping:duration-0 data-[side=bottom]:h-auto data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close
              data-slot="sheet-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-3 right-3"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetPrimitive.Viewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

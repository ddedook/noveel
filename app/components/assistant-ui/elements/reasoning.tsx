"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { Disclosure } from "@heroui/react";
import { cn } from "@/app/lib/utils";

export const ANIMATION_DURATION = 200;

const ReasoningPreviewContext = createContext(false);

const reasoningVariants = cva("aui-reasoning-root mb-1 w-full", {
  variants: {
    variant: {
      outline: "rounded-lg border px-3 py-2",
      ghost: "",
      muted: "bg-default/50 rounded-lg px-3 py-2",
    },
  },
  defaultVariants: {
    variant: "outline",
  },
});

export type ReasoningRootProps = Omit<
  React.ComponentProps<typeof Disclosure>,
  "isExpanded" | "onExpandedChange" | "defaultExpanded" | "children"
> &
  VariantProps<typeof reasoningVariants> & {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    /**
     * Whether the reasoning is currently streaming. While `true` the
     * disclosure is held open with a bottom-pinned live preview; when
     * streaming ends it returns to `defaultOpen`, and the first manual
     * toggle takes over the open/close state permanently. The live preview
     * keeps following the newest tokens while the disclosure is open during
     * streaming, even after a manual toggle, and pauses while the reader is
     * scrolled up.
     */
    streaming?: boolean;
    /** Called right before the disclosure animates, on toggle and on streaming transitions. */
    onAnimationStart?: () => void;
  };

function ReasoningRoot({
  className,
  variant,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  streaming,
  onAnimationStart,
  children,
  ...props
}: ReasoningRootProps) {
  const initialOpenRef = useRef(defaultOpen);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled
    ? controlledOpen
    : (userOpen ?? (streaming || initialOpenRef.current));
  const isPreview = streaming === true && isOpen;

  const prevStreamingRef = useRef(streaming);
  useLayoutEffect(() => {
    if (prevStreamingRef.current === streaming) return;
    prevStreamingRef.current = streaming;
    // A streaming transition only animates the panel when the resting state
    // is collapsed; with `defaultOpen` the disclosure stays open across it.
    if (!isControlled && userOpen === null && !initialOpenRef.current) {
      onAnimationStart?.();
    }
  }, [streaming, isControlled, userOpen, onAnimationStart]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onAnimationStart?.();
      if (!isControlled) {
        setUserOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [onAnimationStart, isControlled, controlledOnOpenChange],
  );

  return (
    <Disclosure
      data-slot="reasoning-root"
      data-variant={variant}
      isExpanded={isOpen}
      onExpandedChange={handleOpenChange}
      className={cn(
        "group/reasoning-root",
        reasoningVariants({ variant, className }),
      )}
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      <ReasoningPreviewContext.Provider value={isPreview}>
        {children}
      </ReasoningPreviewContext.Provider>
    </Disclosure>
  );
}

function ReasoningFade({
  side = "bottom",
  className,
  ...props
}: React.ComponentProps<"div"> & { side?: "top" | "bottom" }) {
  if (side === "top") {
    return (
      <div
        data-slot="reasoning-fade"
        className={cn(
          "aui-reasoning-fade pointer-events-none absolute inset-x-0 top-0 z-10 h-8",
          "bg-[linear-gradient(to_bottom,var(--color-background),transparent)]",
          "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--default)_50%,var(--background)),transparent)]",
          "fade-in-0 animate-in",
          "animation-duration-(--animation-duration)",
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <div
      data-slot="reasoning-fade"
      className={cn(
        "aui-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8",
        "bg-[linear-gradient(to_top,var(--color-background),transparent)]",
        "group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_top,color-mix(in_oklab,var(--default)_50%,var(--background)),transparent)]",
        "fade-in-0 animate-in",
        "animation-duration-(--animation-duration)",
        className,
      )}
      {...props}
    />
  );
}

function ReasoningTrigger({
  active,
  duration,
  className,
  ...props
}: React.ComponentProps<typeof Disclosure.Trigger> & {
  active?: boolean;
  duration?: number;
}) {
  const durationText = duration ? ` (${duration}s)` : "";

  return (
    <Disclosure.Heading>
      <Disclosure.Trigger
        data-slot="reasoning-trigger"
        className={cn(
          "aui-reasoning-trigger group/trigger text-muted hover:text-foreground flex max-w-[75%] origin-left items-center gap-2 py-1 text-xs transition-[color,transform] active:scale-[0.96]",
          className,
        )}
        {...props}
      >
        <BrainIcon
          data-slot="reasoning-trigger-icon"
          className="aui-reasoning-trigger-icon size-4 shrink-0"
        />
        <span
          data-slot="reasoning-trigger-label"
          className={cn(
            "aui-reasoning-trigger-label-wrapper inline-block leading-none tabular-nums",
            active && "shimmer motion-reduce:animate-none",
          )}
        >
          Think{durationText}
        </span>
        <ChevronDownIcon
          data-slot="reasoning-trigger-chevron"
          className={cn(
            "aui-reasoning-trigger-chevron mt-0.5 size-4 shrink-0",
            "transition-transform duration-(--animation-duration) ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            "group-data-[expanded=true]/trigger:rotate-180",
          )}
        />
      </Disclosure.Trigger>
    </Disclosure.Heading>
  );
}

function ReasoningContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Disclosure.Content>) {
  const isPreview = useContext(ReasoningPreviewContext);

  return (
    <Disclosure.Content
      data-slot="reasoning-content"
      className={cn(
        "aui-reasoning-content group/disclosure-content text-muted relative overflow-hidden text-xs outline-none",
        "data-[expanded=false]:pointer-events-none",
        className,
      )}
      {...props}
    >
      <ReasoningFade side="top" />
      {children}
      {isPreview ? <ReasoningFade /> : null}
    </Disclosure.Content>
  );
}

function ReasoningText({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const isPreview = useContext(ReasoningPreviewContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPreview) return;
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    let pinned = true;
    let lastScrollTop = scrollEl.scrollTop;
    let lastScrollHeight = scrollEl.scrollHeight;
    const isAtBottom = () =>
      Math.abs(
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight,
      ) <= 1 || scrollEl.scrollHeight <= scrollEl.clientHeight;

    const pin = () => {
      if (!pinned) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    };
    // A pin's own scroll event can arrive after new content grew the scroll
    // height and read as "not at bottom"; only an upward move at unchanged
    // scroll height is user intent.
    const onScroll = () => {
      if (isAtBottom()) {
        pinned = true;
      } else if (
        scrollEl.scrollTop < lastScrollTop &&
        scrollEl.scrollHeight === lastScrollHeight
      ) {
        pinned = false;
      }
      lastScrollTop = scrollEl.scrollTop;
      lastScrollHeight = scrollEl.scrollHeight;
    };

    pin();
    scrollEl.addEventListener("scroll", onScroll);
    const observer = new ResizeObserver(pin);
    observer.observe(contentEl);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [isPreview]);

  return (
    <div
      ref={scrollRef}
      data-slot="reasoning-text"
      className={cn(
        "aui-reasoning-text relative z-0 max-h-64 overflow-y-auto ps-6 pt-1 pb-1 leading-relaxed text-pretty",
        "transform-gpu transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)]",
        "motion-reduce:animate-none",
        "group-data-[expanded=true]/disclosure-content:animate-in",
        "group-data-[expanded=false]/disclosure-content:animate-out",
        "group-data-[expanded=true]/disclosure-content:fade-in-0",
        "group-data-[expanded=false]/disclosure-content:fade-out-0",
        "group-data-[expanded=true]/disclosure-content:slide-in-from-top-4",
        "group-data-[expanded=false]/disclosure-content:slide-out-to-top-4",
        "group-data-[expanded=true]/disclosure-content:blur-in-[2px]",
        "group-data-[expanded=false]/disclosure-content:blur-out-[2px]",
        "group-data-[expanded=true]/disclosure-content:animation-duration-(--animation-duration)",
        "group-data-[expanded=false]/disclosure-content:animation-duration-(--animation-duration)",
        className,
      )}
      {...props}
    >
      <div ref={contentRef} className="aui-reasoning-text-content space-y-2">
        {children}
      </div>
    </div>
  );
}

export {
  ReasoningRoot,
  ReasoningTrigger,
  ReasoningContent,
  ReasoningText,
  ReasoningFade,
  reasoningVariants,
};

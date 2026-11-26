import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
}: {
  items: readonly TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
}) {
  const [internalVal, setInternalVal] = useState(defaultValue || items[0]?.value || "");
  const activeVal = value ?? internalVal;
  const listRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const handleValueChange = (next: string) => {
    setInternalVal(next);
    onValueChange?.(next);
  };

  useLayoutEffect(() => {
    const activeEl = triggerRefs.current[activeVal];
    const listEl = listRef.current;
    if (activeEl && listEl) {
      setIndicator({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeVal, items]);

  useEffect(() => {
    const onResize = () => {
      const activeEl = triggerRefs.current[activeVal];
      if (activeEl) {
        setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeVal]);

  return (
    <TabsPrimitive.Root
      value={activeVal}
      onValueChange={handleValueChange}
      activationMode="automatic"
      className="w-full"
    >
      <div className="relative border-b border-[var(--pg-line)]">
        <TabsPrimitive.List
          ref={listRef}
          className="flex items-center gap-1 overflow-x-auto"
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.value}
              ref={(el) => {
                triggerRefs.current[item.value] = el;
              }}
              value={item.value}
              className="relative h-10 px-4 pg-label-md text-[var(--pg-text-muted)] data-[state=active]:text-[var(--pg-primary)] hover:text-[var(--pg-text)] transition-colors duration-120 whitespace-nowrap cursor-pointer bg-transparent"
            >
              {item.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-[2px] bg-[var(--pg-primary)] [transition:transform_var(--pg-motion-view-change)] motion-reduce:transition-none pointer-events-none"
          style={{
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      </div>

      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="pt-5 outline-none data-[state=active]:[animation:pg-surface-enter_var(--pg-motion-surface-enter)]"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-[95] rounded-[4px] bg-[var(--pg-raised)] text-[var(--pg-text)] border border-[var(--pg-line)] px-2 py-1.5 pg-body-sm"
          style={{ boxShadow: "var(--pg-overlay-shadow)" }}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

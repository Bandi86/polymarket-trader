"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
  bodyClassName?: string;
  headerRight?: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  icon,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  className = "",
  bodyClassName = "",
  headerRight,
}: CollapsiblePanelProps) {
  const [localIsOpen, setLocalIsOpen] = useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : localIsOpen;

  const handleToggle = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    }
    if (!isControlled) {
      setLocalIsOpen(!localIsOpen);
    }
  };

  return (
    <div
      className={`border border-white/8 rounded-2xl bg-white/3 backdrop-blur-xl overflow-hidden ${className}`}
    >
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 cursor-pointer select-none hover:bg-white/5 transition-colors focus:outline-none bg-transparent border-0 text-left"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-zinc-400">{icon}</div>}
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        </div>

        <div className="flex items-center gap-3">
          {headerRight && (
            <div onPointerDown={(e) => e.stopPropagation()} className="cursor-default">
              {headerRight}
            </div>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-zinc-400"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className={`px-4 pt-0 pb-4 ${bodyClassName}`}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

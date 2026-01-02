import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type DropdownButtonVariant = "primary" | "warning" | "danger";

export type DropdownButtonAction = {
  label: string;
  iconClassName?: string;
  variant?: DropdownButtonVariant;
  disabled?: boolean;
  onClick: () => void;
};

export function DropdownButton({
  label,
  variant = "primary",
  primaryIconClassName = "fas fa-plus",
  dropdownIconClassName = "fas fa-chevron-down",
  primaryDisabled = false,
  dropdownDisabled,
  onPrimaryClick,
  secondaryActions,
  title,
  menuWidthClassName = "w-64"
}: {
  label: string;
  variant?: DropdownButtonVariant;
  primaryIconClassName?: string;
  dropdownIconClassName?: string;
  primaryDisabled?: boolean;
  dropdownDisabled?: boolean;
  onPrimaryClick: () => void;
  secondaryActions: DropdownButtonAction[];
  title?: string;
  menuWidthClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const autoId = useId();
  const menuId = useMemo(() => `dropdownbutton-${autoId}`, [autoId]);

  const secondaryEnabled = secondaryActions.some((a) => !a.disabled);
  const dropdownIsDisabled = dropdownDisabled ?? (primaryDisabled || !secondaryEnabled);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasSecondary = secondaryActions.length > 0;

  useEffect(() => {
    if (!open) return;
    if (!hasSecondary || dropdownIsDisabled) setOpen(false);
  }, [dropdownIsDisabled, hasSecondary, open]);

  const buttonClassName =
    variant === "primary"
      ? "bg-blue-600 hover:bg-blue-700 text-white"
      : variant === "warning"
        ? "bg-yellow-600 hover:bg-yellow-700 text-white"
        : "bg-red-600 hover:bg-red-700 text-white";

  const dividerClassName =
    variant === "primary"
      ? "border-blue-500/50"
      : variant === "warning"
        ? "border-yellow-500/50"
        : "border-red-500/50";

  const actionClassName = (v: DropdownButtonVariant | undefined) =>
    v === "danger"
      ? "text-red-200 hover:bg-red-900/30"
      : v === "warning"
        ? "text-yellow-200 hover:bg-yellow-900/20"
        : v === "primary"
          ? "text-blue-200 hover:bg-blue-900/25"
          : "text-gray-200 hover:bg-gray-700";

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <div className="inline-flex rounded-lg overflow-hidden shadow-sm">
        <button
          type="button"
          className={[
            "px-4 py-2 transition-colors text-sm font-medium disabled:opacity-60 flex items-center space-x-2",
            buttonClassName
          ].join(" ")}
          disabled={primaryDisabled}
          onClick={onPrimaryClick}
          title={title ?? label}
        >
          {primaryIconClassName ? <i className={primaryIconClassName}></i> : null}
          <span>{label}</span>
        </button>
        {hasSecondary ? (
          <button
            type="button"
            className={[
              "px-3 py-2 transition-colors text-sm font-medium disabled:opacity-60 border-l",
              buttonClassName,
              dividerClassName
            ].join(" ")}
            disabled={dropdownIsDisabled}
            onClick={() => setOpen((v) => !v)}
            title="More actions"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
          >
            <i className={dropdownIconClassName + " text-xs opacity-90"}></i>
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={[
            "absolute right-0 top-full mt-2",
            menuWidthClassName,
            "bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
          ].join(" ")}
        >
          {secondaryActions.map((a, idx) => (
            <button
              key={`${a.label}-${idx}`}
              role="menuitem"
              className={[
                "w-full text-left px-4 py-3 text-sm transition-colors flex items-center space-x-3 disabled:opacity-60",
                actionClassName(a.variant)
              ].join(" ")}
              disabled={a.disabled}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              title={a.label}
            >
              {a.iconClassName ? <i className={a.iconClassName + " text-xs"}></i> : null}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}



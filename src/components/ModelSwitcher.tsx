import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store/store";
import { MODELS, getModel } from "../lib/models";
import { PROVIDERS } from "../lib/providers";
import { CheckIcon, ChevronDownIcon } from "./Icons";

/** Dropdown for picking the active model, grouped by provider. */
export function ModelSwitcher() {
  const modelId = useStore((s) => s.modelId);
  const setModel = useStore((s) => s.setModel);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(modelId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="model-switch" ref={ref}>
      <button className="model-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="model-dot" />
        {current.label}
        <ChevronDownIcon size={13} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="model-menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
          >
            {PROVIDERS.map((provider) => {
              const models = MODELS.filter((m) => m.providerId === provider.id);
              if (models.length === 0) return null;
              return (
                <div key={provider.id}>
                  <div className="model-group-label">{provider.label}</div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      className={`model-option ${m.id === modelId ? "active" : ""}`}
                      onClick={() => {
                        setModel(m.id);
                        setOpen(false);
                      }}
                    >
                      <div className="model-option-text">
                        <div className="model-option-label">
                          {m.label}
                          {m.vision && <span className="vision-tag">vision</span>}
                        </div>
                        <div className="model-option-blurb">{m.blurb}</div>
                      </div>
                      {m.id === modelId && <CheckIcon size={15} />}
                    </button>
                  ))}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

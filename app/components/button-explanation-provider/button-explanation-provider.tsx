import { useState, useEffect, useCallback } from "react";
import { Info } from "lucide-react";
import { BUTTON_EXPLANATIONS, type ButtonExplanation } from "~/data/button-explanations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog/dialog";
import styles from "./button-explanation-provider.module.css";

interface ButtonExplanationProviderProps {
  children: React.ReactNode;
}

/**
 * Global provider that intercepts right-clicks on elements tagged with
 * `data-explanation-id` and shows a descriptive popup dialog.
 *
 * Mount once near the root of your app.  Any button or element can opt in
 * by setting  data-explanation-id="<key>"  where <key> maps to an entry in
 * app/data/button-explanations.ts.
 *
 * If the element has no registered explanation, the native context menu
 * is left untouched.
 */
export function ButtonExplanationProvider({ children }: ButtonExplanationProviderProps) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<ButtonExplanation | null>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Walk up from the click target to find the nearest element that carries
    // a data-explanation-id attribute (handles clicks on icons inside buttons).
    const tagged = target.closest("[data-explanation-id]") as HTMLElement | null;
    if (!tagged) return;

    const id = tagged.dataset.explanationId;
    if (!id) return;

    const found = BUTTON_EXPLANATIONS[id];
    if (!found) return; // Registered key missing — fall through to native menu

    e.preventDefault();
    setExplanation(found);
    setOpen(true);
  }, []);

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [handleContextMenu]);

  return (
    <>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader className={styles.header}>
            <div className={styles.iconRow}>
              <span className={styles.iconBadge}>
                <Info size={20} />
              </span>
              <DialogTitle className={styles.title}>{explanation?.title}</DialogTitle>
            </div>
            <DialogDescription className={styles.description}>
              {explanation?.description}
            </DialogDescription>
          </DialogHeader>

          <p className={styles.hint}>
            Right-click any highlighted button to see its explanation.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

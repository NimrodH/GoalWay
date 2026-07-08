/**
 * Central registry for button explanations.
 *
 * HOW TO ADD A NEW EXPLANATION
 * ─────────────────────────────
 * 1. Add a new entry to BUTTON_EXPLANATIONS below with a unique key.
 * 2. Set  data-explanation-id="<your-key>"  on the button element in JSX,
 *    OR pass  explanationId="<your-key>"  to the <Button> UI component.
 * 3. Right-clicking the button will show the explanation in a popup dialog.
 *    If the button has no entry here, right-click does nothing (native menu shows).
 */

export interface ButtonExplanation {
  title: string;
  description: string;
}

export const BUTTON_EXPLANATIONS: Record<string, ButtonExplanation> = {
  // ── Admin › Instructions page ─────────────────────────────────────────────

  "admin-delete-instruction": {
    title: "Delete Instruction",
    description:
      "Permanently removes the selected instruction from the database. This action cannot be undone. The instruction must not currently be referenced by any mission — the button is disabled while it is in use.",
  },

  "admin-replace-instruction-in-missions": {
    title: "Replace In All Missions",
    description:
      "Opens a dialog where you choose a replacement instruction. Every mission that currently references the selected instruction will be updated to point to the replacement instead. Useful when retiring an old instruction in favour of a newer version.",
  },

  "admin-duplicate-instruction": {
    title: "Duplicate Instruction (⎘)",
    description:
      "Creates an exact copy of the selected instruction — including all content steps, images, and annotations — and assigns it a new unique ID. Use this as a safe starting point for a variation without modifying the original.",
  },

  "admin-add-new-instruction": {
    title: "Add New Instruction",
    description:
      "Creates a new blank instruction and immediately selects it for editing. Fill in the title and content steps, then press Save to persist it to the database.",
  },
};

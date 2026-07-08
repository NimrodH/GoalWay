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

  // ── Instructions With Images page ──────────────────────────────────────────

  "iwi-select-image": {
    title: "Select Image",
    description:
      "Finalizes the selection of the current image. If you arrived here from the Admin editing screen, this will take you back and insert the image into your instruction step.",
  },

  "iwi-open-library": {
    title: "Open Library",
    description:
      "Opens the full image library browser where you can search, filter, and select from all images uploaded to the system.",
  },

  "iwi-cancel-return": {
    title: "Cancel & Return",
    description:
      "Aborts the image selection process and returns you to the Admin instruction editor without making any changes.",
  },

  "iwi-toggle-rename": {
    title: "Rename Image",
    description:
      "Toggles the rename interface. Renaming an image will update the file name in storage and automatically update all instructions that reference this image URL to prevent broken links.",
  },

  "iwi-toggle-replace": {
    title: "Replace Image",
    description:
      "Toggles the replacement tools. You can upload a new version or pick a different library image to replace the current one across multiple instructions at once.",
  },

  "iwi-toggle-keywords": {
    title: "Edit Keywords & Categories",
    description:
      "Toggles the metadata editor. Use this to assign the image to a specific Software, Module, Screen, or Item, and add searchable keywords for easier discovery in the library.",
  },

  "iwi-nav-prev": {
    title: "Previous Image",
    description:
      "Navigates to the previous image in the current filtered set. Useful for quickly browsing through similar screenshots.",
  },

  "iwi-nav-next": {
    title: "Next Image",
    description:
      "Navigates to the next image in the current filtered set.",
  },

  "iwi-confirm-rename": {
    title: "Confirm Rename",
    description:
      "Executes the renaming process. This involves moving the file in Supabase Storage and performing a batch update on all instructions that use this image.",
  },

  "iwi-save-keywords": {
    title: "Save Metadata",
    description:
      "Persists the category and keyword changes to the database. These changes affect how the image appears in searches and filters.",
  },

  "iwi-paste-clipboard": {
    title: "Paste from Clipboard",
    description:
      "Reads an image from your system clipboard and uploads it immediately. This is the fastest way to add new screenshots directly from tools like Snagit or Windows Snipping Tool.",
  },

  "iwi-execute-replace": {
    title: "Execute Batch Replace",
    description:
      "Replaces the current image with the new one in all instructions you have selected in the list below. This is a powerful tool for updating recurring UI elements across many steps.",
  },

  "iwi-delete-image": {
    title: "Delete Image",
    description:
      "Permanently deletes the image from storage. This button is only enabled if the image is NOT currently used by any instructions. If it is used, you must replace it everywhere first.",
  },

  "iwi-library-select": {
    title: "Select & Load",
    description:
      "Closes the library and loads the selected image into the main viewer for editing or replacement.",
  },

  "iwi-library-delete-selected": {
    title: "Delete Selected Images",
    description:
      "Permanently removes all selected images from storage. Use with caution as this action cannot be undone.",
  },
};

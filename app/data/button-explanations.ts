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

  // ── Admin › Mission Editing page ───────────────────────────────────────────

  "admin-mission-save-db": {
    title: "Save to Database",
    description:
      "Persists all changes made to the mission — including title, description, and the sequence of instructions — to the database. If you have made changes to the instruction list order, this is where you lock them in.",
  },

  "admin-mission-delete": {
    title: "Delete Mission",
    description:
      "Permanently removes the mission from the system. This action cannot be undone. All instruction sequences within this mission will be lost, although the individual instructions themselves remain in the library.",
  },

  "admin-mission-duplicate": {
    title: "Duplicate Mission",
    description:
      "Creates a new mission with the exact same title, description, and instruction sequence. The new mission will be assigned a unique ID, allowing you to branch off from a template or existing flow.",
  },

  "admin-mission-create-new": {
    title: "Create New Mission",
    description:
      "Resets the form to create a fresh mission. You will be assigned a new unique ID after saving.",
  },

  "admin-mission-drawio": {
    title: "Import Draw.io",
    description:
      "Allows you to import a flowchart exported from Draw.io (in XML format). The system will attempt to parse the nodes and edges to automatically generate an instruction sequence with IF/ELSE logic based on the diagram.",
  },

  "admin-mission-export": {
    title: "Export Mission Bundle",
    description:
      "Downloads a single JSON file containing the mission data and the full content of every instruction referenced within it. This bundle can be imported into another environment (e.g. from Staging to Production) to perfectly replicate the mission.",
  },

  "admin-mission-import": {
    title: "Import Mission Bundle",
    description:
      "Uploads a mission bundle JSON file. This will overwrite the mission and all its constituent instructions in the current database using the IDs provided in the file. Use with caution.",
  },

  "admin-mission-filter-clear": {
    title: "Clear Mission Filters",
    description:
      "Resets all mission search filters (Name, Description, Organization) to show the full list of available missions.",
  },

  "admin-mission-select-last": {
    title: "Select Last Mission",
    description:
      "Quickly jumps back to the mission you were most recently editing in this session. Useful for navigating back and forth between instructions and missions.",
  },

  "admin-mission-available-edit": {
    title: "Edit Selected Instruction",
    description:
      "Opens the currently selected available instruction in the Instruction Editor. This allows you to tweak the content of a step without losing your place in the mission editor.",
  },

  "admin-mission-available-clear": {
    title: "Clear Instruction Filter",
    description:
      "Resets the search box in the Available Instructions list, showing all instructions in the library.",
  },

  "admin-mission-remove": {
    title: "Remove from Mission (← Del)",
    description:
      "Removes the selected instruction or logic block from the mission sequence. The instruction itself remains in the library; it is only disconnected from this specific mission.",
  },

  "admin-mission-add": {
    title: "Add to Mission (Add →)",
    description:
      "Appends the selected instructions from the library to the mission sequence. If an instruction is already in the sequence, it will be added again with a suffix (e.g. #2) to allow for repeating steps.",
  },

  "admin-mission-link": {
    title: "Link to Real ID",
    description:
      "Replaces a temporary placeholder entry (T1, T2...) with a real instruction ID from the library. This is useful when you have sketched out a flow with placeholders and are now ready to map them to actual content.",
  },

  "admin-mission-add-if": {
    title: "Add IF Condition",
    description:
      "Inserts a conditional IF block into the sequence. You can use this to create branching paths in the mission based on user choices or system states.",
  },

  "admin-mission-add-endif": {
    title: "Add END-IF Marker",
    description:
      "Closes the currently open IF block. Every IF must eventually have a matching END-IF to ensure the flow remains logical.",
  },

  "admin-mission-add-else": {
    title: "Add ELSE Branch",
    description:
      "Inserts an alternative path into an IF block. Instructions between the IF and ELSE are executed if the condition is true; instructions between ELSE and END-IF are executed if the condition is false.",
  },

  "admin-mission-add-comment": {
    title: "Add Comment",
    description:
      "Inserts a non-executable comment into the mission sequence. These comments are visible to end-users in the mission view and help provide additional context or guidance between instruction steps.",
  },

  "admin-mission-add-new-instruction": {
    title: "Add New Instruction",
    description:
      "Creates a temporary instruction placeholder and adds it to the sequence. You can later 'Edit' this to turn it into a real database record.",
  },

  "admin-mission-move-up": {
    title: "Move Up (↑)",
    description:
      "Shifts the selected instruction or logic block one position earlier in the mission sequence.",
  },

  "admin-mission-move-down": {
    title: "Move Down (↓)",
    description:
      "Shifts the selected instruction or logic block one position later in the mission sequence.",
  },

  "admin-mission-view-json": {
    title: "View Instruction JSON",
    description:
      "Opens a raw JSON editor for the selected instruction. Power users can use this to quickly fix metadata or complex data structures without using the full UI.",
  },

  "admin-mission-edit-instruction": {
    title: "Edit Instruction Details",
    description:
      "Navigates to the Instruction Editor for the selected step. If the step is a 'Link' to another mission, this provides options to either edit the link itself or navigate to the target mission.",
  },

  "admin-mission-rename-local": {
    title: "Rename (Local Override)",
    description:
      "Allows you to set a custom title for this specific occurrence of the instruction within this mission. The original instruction title in the library remains unchanged.",
  },

  "admin-mission-fix-duplicates": {
    title: "Fix Duplicate IDs",
    description:
      "Scans the current JSON representation of the mission and automatically assigns #2, #3 suffixes to any duplicate instruction IDs to ensure the sequence is valid.",
  },
  "admin-mission-apply-json": {
    title: "Apply JSON Changes",
    description:
      "Parses the text in the JSON editor and updates the form fields above. This is a local update only — you must still click 'Save to Database' to persist these changes.",
  },

  "admin-mission-translate-switch": {
    title: "Translate & Switch Language",
    description:
      "Uses AI to translate the mission title and description into the target language, then switches the editor view to that language. This allows you to quickly localise your mission content.",
  },

  "admin-mission-status": {
    title: "Mission Status / Visibility",
    description:
      "Controls the visibility of this mission. 'Hide' effectively archives the mission, removing it from all user lists but preserving its data. 'For all' publishes it to all active organizations. Specific organization options allow for targeted deployment to subset of users.",
  },

  "admin-mission-is-example": {
    title: "Example Flag",
    description:
      "Toggles the 'Example' status. Example missions are often highlighted or separated in the user interface to distinguish between real operational tasks and training/reference material.",
  },

  "admin-mission-add-note": {
    title: "Add Admin Note",
    description:
      "Opens a text area to add a persistent administrative note to this mission. These notes are only visible to other admins in this editor and are useful for tracking mission changes, pending tasks, or technical quirks.",
  },

  "admin-mission-edit-note": {
    title: "Edit Admin Note",
    description:
      "Allows you to modify an existing admin note. Use this to update progress or clarify earlier comments.",
  },

  "admin-mission-delete-note": {
    title: "Delete Admin Note",
    description:
      "Permanently removes the admin note from this mission record.",
  },

  // ── Admin › User Management page ───────────────────────────────────────────

  "user-mgmt-delete-org": {
    title: "Delete Organization",
    description:
      "Permanently removes the organization from the system. This will NOT delete users, but any users assigned to this organization will become 'Pending' again and lose access to organization-specific missions. This action cannot be undone.",
  },

  "user-mgmt-add-org": {
    title: "Add Organization",
    description:
      "Creates a new organization. If you leave the Slug field empty, one will be automatically generated based on the name (e.g., 'My Org' becomes 'my-org'). Organizations are used to group users and control mission access.",
  },

  "user-mgmt-assign-user": {
    title: "Assign to Organization",
    description:
      "Finalizes the registration of a new user by assigning them to an organization. Once assigned, the user will move out of the 'Pending' list and will be able to see missions shared with their organization.",
  },

  "user-mgmt-clear-filters": {
    title: "Clear Matrix Filters",
    description:
      "Resets all search criteria (Name, Description, Organization) in the Mission Access Matrix to show the full list of active missions.",
  },

  "user-mgmt-save-access": {
    title: "Save Access Settings",
    description:
      "Persists the 'Example' (Public) status and the specific organization access list for this mission. These changes take effect immediately for all users.",
  },

  "user-mgmt-org-multiselect": {
    title: "Manage Organization Access",
    description:
      "Opens a dropdown to toggle access for specific organizations. 'None' means the mission is only visible to Admins; selecting multiple organizations allows for shared access across different teams.",
  },

  // ── Admin › Instruction Editor ─────────────────────────────────────────────

  "admin-instruction-save": {
    title: "Save Instruction",
    description:
      "Persists all changes — title, description, and the full sequence of text/image steps — to the database. If you have pending image uploads, they will be processed before the final record is saved.",
  },

  "admin-instruction-add-text": {
    title: "Add Text Block",
    description:
      "Inserts a new text area into the instruction. Use this for descriptive steps, warnings, or conceptual explanations that don't require a visual aid.",
  },

  "admin-instruction-add-image": {
    title: "Add Image Block",
    description:
      "Inserts a new image placeholder. You can then upload a file, paste from your clipboard, or pick an existing screenshot from the system library.",
  },

  "admin-instruction-copy-json": {
    title: "Copy Block (JSON)",
    description:
      "Serializes the currently selected content block (including its text, image URL, and annotations) into a JSON string and copies it to your clipboard. Useful for duplicating complex steps across different instructions.",
  },

  "admin-instruction-paste-json": {
    title: "Paste Block (JSON)",
    description:
      "Reads a content block JSON from your clipboard and inserts it into the current instruction. This will perfectly replicate the text, image, and all annotations from the source block.",
  },

  "admin-instruction-move-up": {
    title: "Move Block Up",
    description:
      "Shifts the selected text or image block one position higher in the instruction sequence.",
  },

  "admin-instruction-move-down": {
    title: "Move Block Down",
    description:
      "Shifts the selected text or image block one position lower in the instruction sequence.",
  },

  "admin-instruction-remove-block": {
    title: "Remove Block",
    description:
      "Permanently removes the selected content block from this instruction. If the block contains an image URL, the image remains in the library; only this reference is deleted.",
  },

  "admin-instruction-library": {
    title: "Open Library",
    description:
      "Opens the global image library. You can search by software, module, or keyword to find and reuse an existing screenshot instead of uploading a duplicate.",
  },

  "admin-instruction-paste-clipboard": {
    title: "Paste from Clipboard",
    description:
      "Directly uploads an image currently held in your system clipboard. This is the fastest way to move screenshots from your capture tool into the editor.",
  },

  "admin-instruction-annotate": {
    title: "Annotate Image",
    description:
      "Opens the Annotation Editor for this image. You can draw numbered rectangles (hotspots) to highlight specific UI elements mentioned in your text description.",
  },

  "admin-instruction-view-usage": {
    title: "View Image Usage",
    description:
      "Opens a list of all instructions that currently use this specific image URL. This helps you understand the impact of replacing or deleting an image.",
  },

  "admin-instruction-save-metadata": {
    title: "Save Metadata",
    description:
      "Updates the categorization (Software, Module, Screen) and keywords for this image in the library. This doesn't affect the current instruction but makes the image easier for others to find later.",
  },

  "admin-instruction-translate": {
    title: "Translate & Switch",
    description:
      "Uses AI to translate the title, description, and all text blocks into the target language, then switches the editor view. Always review AI translations for technical accuracy.",
  },

  "admin-instruction-change-image": {
    title: "Change Image",
    description:
      "Toggles the image replacement panel. From here you can upload a new file from your device, paste an image directly from your clipboard, or pick an alternative screenshot from the global image library. The current image URL will be overwritten once you confirm the new source.",
  },
};

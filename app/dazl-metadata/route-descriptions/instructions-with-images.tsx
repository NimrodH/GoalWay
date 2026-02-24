export default (
  <>
    <p>
      <strong>Instructions with Images</strong> - A specialized view that displays instructions
      filtered by a specific image and provides bulk image replacement functionality.
    </p>
    <p>
      When an admin clicks the "🔍 View Instructions with This Image" button in the admin panel for a
      specific image, they are navigated to this page with that image displayed at the top and a
      list of all instructions that use that image in their explanation.
    </p>
    <p>
      <strong>Data Source:</strong>
    </p>
    <ul>
      <li>Fetches live instruction data from Supabase database via getAllInstructions() service</li>
      <li>Uses real-time data from the "instructions" table (data_en and data_he columns)</li>
    </ul>
    <p>
      <strong>Query Parameters:</strong>
    </p>
    <ul>
      <li>
        <code>imageUrl</code> - The URL of the image to filter instructions by. When provided, only
        instructions containing this exact image in their explanation array are shown.
      </li>
    </ul>
    <p>
      <strong>Features:</strong>
    </p>
    <ul>
      <li>Displays a featured image at the top (from query parameter or default)</li>
      <li>Shows filtered list of instructions that use the specified image</li>
      <li>Displays instruction count in subtitle when filtering is active</li>
      <li>Shows empty state message when no instructions match the filter</li>
      <li>Image replacement interface with multiple input methods (URL, upload, clipboard, library)</li>
      <li>Bulk update selected instructions with a new image</li>
      <li>Requires authentication for image replacement operations</li>
    </ul>
    <p>
      <strong>Selection Functionality:</strong>
    </p>
    <ul>
      <li>Each instruction has a checkbox for individual selection</li>
      <li>Click anywhere on an instruction row to toggle its selection</li>
      <li>Selected instructions are highlighted with accent color background</li>
      <li>Header displays a "Select All" / "Deselect All" checkbox with indeterminate state support</li>
      <li>Selection counter shows how many instructions are currently selected ("X selected")</li>
      <li>Visual feedback: selected items have accent background, hover states work on all items</li>
    </ul>
    <p>
      <strong>Image Replacement Workflow:</strong>
    </p>
    <ol>
      <li>Select one or more instructions using the checkboxes</li>
      <li>Provide a new image using one of these methods:
        <ul>
          <li>Enter a direct URL in the "New Image URL" field</li>
          <li>Click "📚 Select from Library" to browse existing uploaded images</li>
          <li>Click "📋 Paste from Clipboard" to use a copied image from clipboard</li>
          <li>Use the file input to upload a new image file</li>
        </ul>
      </li>
      <li>If you uploaded or pasted an image, click "Upload to Supabase" to store it</li>
      <li>Click "Replace Image in X Selected Instruction(s)" button</li>
      <li>Confirm the replacement in the confirmation dialog</li>
      <li>The page reloads automatically after successful replacement</li>
    </ol>
    <p>
      <strong>Image Replacement Logic:</strong>
    </p>
    <ul>
      <li>Server action authenticates using Supabase access token from session</li>
      <li>Fetches all selected instructions from database</li>
      <li>Iterates through explanation arrays in both data_en and data_he columns</li>
      <li>Replaces image items where content matches the old URL with the new URL</li>
      <li>Updates the updated_at timestamp for modified instructions</li>
      <li>Returns count of successfully updated instructions</li>
    </ul>
    <p>
      <strong>Security:</strong>
    </p>
    <ul>
      <li>Authentication required via useAuth hook (Supabase Auth)</li>
      <li>Access token validated server-side before database modifications</li>
      <li>Confirmation dialog prevents accidental replacements</li>
      <li>Warning displayed when user is not authenticated</li>
    </ul>
    <p>
      <strong>Technical Details:</strong>
    </p>
    <ul>
      <li>Uses React Router v7 useFetcher for async form submissions</li>
      <li>State management with useState and Set for efficient ID tracking</li>
      <li>Image upload via uploadImage() helper (Supabase Storage)</li>
      <li>Image library via listAllImages() helper</li>
      <li>Clipboard API for paste functionality with fallback error handling</li>
      <li>Responsive design with mobile-optimized layouts</li>
    </ul>
  </>
);

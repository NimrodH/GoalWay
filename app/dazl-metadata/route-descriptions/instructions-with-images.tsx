export default (
  <>
    <p>
      <strong>Instructions with Images</strong> - A specialized view that displays instructions
      filtered by a specific image.
    </p>
    <p>
      When an admin clicks the "View Instructions with This Image" button in the admin panel for a
      specific image, they are navigated to this page with that image displayed at the top and a
      list of all instructions that use that image in their explanation.
    </p>
    <p>
      <strong>Data Source:</strong>
    </p>
    <ul>
      <li>Fetches live instruction data from Supabase database via getAllInstructions() service</li>
      <li>Uses real-time data from the "instructions" table (data_en column)</li>
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
      <li>Uses the same checkbox list styling as the admin panel for consistency</li>
    </ul>
  </>
);

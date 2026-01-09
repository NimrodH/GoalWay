# Supabase Storage Setup Instructions

You're getting a security error because the storage bucket needs RLS (Row Level Security) policies configured. Here's how to fix it:

## Steps to Configure Storage in Supabase Dashboard

1. **Go to your Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Create/Configure the Storage Bucket**
   - Click on "Storage" in the left sidebar
   - If "mission-images" bucket doesn't exist, click "New bucket"
     - Name: `mission-images`
     - Public bucket: ✅ **Check this box**
     - Click "Create bucket"
   - If it already exists, click on it and make sure "Public bucket" is enabled

3. **Set Up Storage Policies**
   - Click on the "mission-images" bucket
   - Click on "Policies" tab
   - Click "New Policy"
   
   **Policy 1: Allow Public Read**
   - Policy name: `Public Access`
   - Allowed operation: `SELECT`
   - Target roles: `public`
   - USING expression: `true`
   - Click "Save"
   
   **Policy 2: Allow Authenticated Upload**
   - Click "New Policy" again
   - Policy name: `Authenticated users can upload`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - WITH CHECK expression: `true`
   - Click "Save"
   
   **Policy 3: Allow Authenticated Update**
   - Click "New Policy" again
   - Policy name: `Authenticated users can update`
   - Allowed operation: `UPDATE`
   - Target roles: `authenticated`
   - USING expression: `true`
   - Click "Save"
   
   **Policy 4: Allow Authenticated Delete**
   - Click "New Policy" again
   - Policy name: `Authenticated users can delete`
   - Allowed operation: `DELETE`
   - Target roles: `authenticated`
   - USING expression: `true`
   - Click "Save"

4. **Test the Upload**
   - Go back to your admin page
   - Try uploading an image again
   - It should work now!

## Quick Setup (Alternative)

If you want to allow all operations without authentication (less secure but simpler):

1. Go to Storage → mission-images → Policies
2. Click "New Policy" → "Create a custom policy"
3. Policy name: `Allow all operations`
4. Allowed operations: SELECT, INSERT, UPDATE, DELETE all checked
5. Target roles: `public`
6. USING expression: `true`
7. WITH CHECK expression: `true`
8. Click "Save"

This will allow anyone to upload/read/delete files, which is fine for a 
demo but not recommended for production.
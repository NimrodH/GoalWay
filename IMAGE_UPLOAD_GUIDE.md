# Image Upload Functionality Guide

## Overview

The admin panel now supports uploading images to Supabase Storage. This feature is available in both the "New Mission" and "Edit Mission" tabs.

## Features

1. **Image Preview**: When you select an image file, you'll see a live preview
2. **Upload to Supabase**: Click the "Upload Image to Supabase" button to upload the image
3. **Get Public URL**: After upload, you'll receive the public URL that can be used in your mission data
4. **Auto-save with Mission**: When you save a mission, any uploaded image URL will be included in the mission data

## How to Use

### Step 1: Create or Edit a Mission

1. Navigate to the Admin Panel (`/admin`)
2. Sign in with your credentials
3. Go to either "New Mission" or "Edit Mission" tab

### Step 2: Upload an Image

1. Fill in the mission details (ID, Title, Description)
2. In the "Mission Image (Optional)" section:
   - Click "Choose File" and select an image from your disk
   - You'll see a preview of the selected image
   - Click "Upload Image to Supabase" button
   - Wait for the upload to complete
   - You'll see a success alert with the image URL

### Step 3: Save the Mission

1. The uploaded image URL will be automatically included when you click "Save to Database"
2. The mission data saved to Supabase will include an `imageUrl` field

## Supabase Storage Bucket

- **Bucket Name**: `mission-images`
- **Public Access**: Yes (images are publicly accessible)
- **File Size Limit**: 5MB
- **Allowed Types**: JPEG, PNG, GIF, WebP
- **Folder Structure**: Images are organized in `/missions/` folder

## Image URLs

After upload, images will be accessible at:
```
https://<your-project-id>.supabase.co/storage/v1/object/public/mission-images/missions/<timestamp>-<random-id>.<ext>
```

## Technical Details

- Images are uploaded using the Supabase Storage API
- Upload happens client-side using the authenticated session
- Files are named with timestamp and random ID to prevent conflicts
- The `uploadImage` function is located in `app/lib/image-upload.ts`

## Notes

- You can upload images from your local disk through the file input
- The image upload is optional - missions can be saved without images
- Uploaded images are stored permanently in Supabase Storage
- To delete images, you'll need to use the Supabase Dashboard or create a delete function

# DeepL Translation Setup

This application uses DeepL API for translating content between English and Hebrew.

## Getting a DeepL API Key

1. Go to [DeepL API website](https://www.deepl.com/pro-api)
2. Sign up for a DeepL API account
3. Choose a plan:
   - **Free Plan**: 500,000 characters/month (good for testing)
   - **Pro Plans**: Higher usage limits
4. After signing up, you'll receive an API key

## Setting Up the API Key

Add your DeepL API key to the `.env` file:

```env
DEEPL_API_KEY=your-api-key-here
```

**Note**: DeepL offers two different API endpoints:
- Free API: `https://api-free.deepl.com/v2/translate`
- Pro API: `https://api.deepl.com/v2/translate`

This application is configured to use the **Free API** endpoint by default. If you have a Pro account, you can update the endpoint in `app/lib/translate.ts`.

## Using Translation in Admin Panel

Once the API key is configured:

1. Go to the Admin panel at `/admin`
2. Navigate to "Edit Instruction" or "Edit Mission" tabs
3. Select an item to edit
4. Fill in the fields in one language (e.g., English)
5. Click the **"🌐 Translate to Hebrew"** (or **"Translate to English"**) button
6. The system will:
   - Translate all text fields (title, description, instruction texts)
   - Switch to the target language view
   - Populate the fields with translated content
   - Update the JSON preview

## Supported Languages

DeepL supports Hebrew (added in 2024) with the following capabilities:
- Translate **from** Hebrew to 32+ languages
- Translate **to** Hebrew from 32+ languages

## Troubleshooting

If translation fails, check:
- ✅ API key is correctly set in `.env` file
- ✅ You have remaining quota on your DeepL account
- ✅ The text fields are not empty
- ✅ Your internet connection is working

Error messages will appear in alerts to help diagnose issues.

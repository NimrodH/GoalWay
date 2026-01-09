export interface TranslateTextRequest {
  text: string;
  sourceLang: 'en' | 'he';
  targetLang: 'en' | 'he';
}

export interface TranslateTextResponse {
  translatedText: string;
  error?: string;
}

export async function translateText(
  text: string,
  sourceLang: 'en' | 'he',
  targetLang: 'en' | 'he'
): Promise<TranslateTextResponse> {
  if (!text.trim()) {
    return { translatedText: '', error: 'Empty text provided' };
  }

  try {
    const deeplApiKey = process.env.DEEPL_API_KEY;
    
    if (!deeplApiKey) {
      return { 
        translatedText: '', 
        error: 'DeepL API key not configured. Please set DEEPL_API_KEY environment variable.' 
      };
    }

    // DeepL uses 'HE' for Hebrew (uppercase)
    const sourceCode = sourceLang === 'he' ? 'HE' : 'EN';
    const targetCode = targetLang === 'he' ? 'HE' : 'EN';

    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('source_lang', sourceCode);
    formData.append('target_lang', targetCode);

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        translatedText: '', 
        error: `DeepL API error (${response.status}): ${errorText.substring(0, 200)}` 
      };
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        translatedText: '',
        error: `Invalid API response. Received: ${responseText.substring(0, 100)}...`
      };
    }
    
    if (data.translations && data.translations.length > 0) {
      return { translatedText: data.translations[0].text };
    }

    return { translatedText: '', error: 'No translation received from DeepL' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { translatedText: '', error: `Translation failed: ${errorMessage}` };
  }
}

export async function translateMultipleTexts(
  texts: string[],
  sourceLang: 'en' | 'he',
  targetLang: 'en' | 'he'
): Promise<{ translations: string[]; error?: string }> {
  try {
    const results = await Promise.all(
      texts.map(text => translateText(text, sourceLang, targetLang))
    );

    const firstError = results.find(r => r.error);
    if (firstError?.error) {
      return { translations: [], error: firstError.error };
    }

    return { translations: results.map(r => r.translatedText) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { translations: [], error: `Batch translation failed: ${errorMessage}` };
  }
}

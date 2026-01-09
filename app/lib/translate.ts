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

  const deeplApiKey = process.env.DEEPL_API_KEY;
  
  if (!deeplApiKey) {
    const error = 'DeepL API key not configured. Please set DEEPL_API_KEY environment variable.';
    console.error('[DEEPL ERROR]', error);
    return { translatedText: '', error };
  }

  // DeepL uses 'HE' for Hebrew (uppercase)
  const sourceCode = sourceLang === 'he' ? 'HE' : 'EN';
  const targetCode = targetLang === 'he' ? 'HE' : 'EN';

  const formData = new URLSearchParams();
  formData.append('text', text);
  formData.append('source_lang', sourceCode);
  formData.append('target_lang', targetCode);

  // Determine API endpoint based on key type
  // Free API keys end with ':fx', Pro keys don't
  const isFreeAccount = deeplApiKey.endsWith(':fx');
  const apiEndpoint = isFreeAccount 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const requestInfo = {
    endpoint: apiEndpoint,
    accountType: isFreeAccount ? 'free' : 'pro',
    sourceLang: sourceCode,
    targetLang: targetCode,
    textLength: text.length,
    apiKeyPrefix: deeplApiKey.substring(0, 8) + '...',
    apiKeySuffix: deeplApiKey.substring(deeplApiKey.length - 5)
  };
  console.log('[DEEPL REQUEST]', requestInfo);

  let response: Response;
  try {
    response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });
  } catch (fetchError) {
    const error = `Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
    console.error('[DEEPL FETCH ERROR]', error);
    return { translatedText: '', error };
  }

  console.log('[DEEPL RESPONSE STATUS]', {
    status: response.status,
    statusText: response.statusText,
  });

  let responseText: string;
  try {
    responseText = await response.text();
  } catch (textError) {
    const error = `Failed to read response: ${textError instanceof Error ? textError.message : String(textError)}`;
    console.error('[DEEPL RESPONSE READ ERROR]', error);
    return { translatedText: '', error };
  }

  console.log('[DEEPL RESPONSE BODY]', responseText.substring(0, 500));

  if (!response.ok) {
    const error = `DeepL API error (${response.status} ${response.statusText}): ${responseText.substring(0, 300)}`;
    console.error('[DEEPL API ERROR]', error);
    return { translatedText: '', error };
  }

  // Check if response is JSON before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    let error = `DeepL API returned non-JSON response (content-type: ${contentType || 'unknown'}). `;
    
    // Provide more specific guidance based on response
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      error += `The API returned an HTML page instead of JSON. This typically means:\n`;
      error += `1. The API key is invalid or expired\n`;
      error += `2. The API endpoint is incorrect (Free vs Pro)\n`;
      error += `3. The API key doesn't have proper permissions\n\n`;
      error += `Current endpoint: ${apiEndpoint} (${isFreeAccount ? 'Free' : 'Pro'} account detected)\n`;
      error += `Please verify your DEEPL_API_KEY in the .env file.`;
    } else {
      error += `Status: ${response.status}. Response: ${responseText.substring(0, 200)}`;
    }
    
    console.error('[DEEPL INVALID RESPONSE TYPE]', error);
    return { translatedText: '', error };
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    // This should rarely happen if the content-type check above works correctly
    const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
    const error = `Failed to parse API response as JSON (${errorMsg}). Response preview: ${responseText.substring(0, 200)}`;
    console.error('[DEEPL JSON PARSE ERROR]', error);
    return { translatedText: '', error };
  }

  console.log('[DEEPL PARSED DATA]', data);
  
  if (data.translations && data.translations.length > 0) {
    console.log('[DEEPL SUCCESS]', 'Translation successful');
    return { translatedText: data.translations[0].text };
  }

  const error = 'No translation received from DeepL';
  console.error('[DEEPL NO TRANSLATION]', error, data);
  return { translatedText: '', error };
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

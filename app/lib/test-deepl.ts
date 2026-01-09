/**
 * Simple DeepL API test utility
 */

export async function testDeepLConnection() {
  const apiKey = process.env.DEEPL_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'DEEPL_API_KEY environment variable is not set',
      details: 'Please add DEEPL_API_KEY to your .env file'
    };
  }

  // Determine the correct API endpoint based on the key type
  const isFreeKey = apiKey.endsWith(':fx');
  const baseUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2';

  try {
    const response = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: ['Hello, world!'],
        target_lang: 'HE',
        source_lang: 'EN'
      })
    });

    const responseText = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // Not JSON - probably an error page
      return {
        success: false,
        error: 'DeepL API returned HTML instead of JSON',
        details: `Status: ${response.status}, Response preview: ${responseText.substring(0, 500)}`,
        responsePreview: responseText.substring(0, 500),
        statusCode: response.status,
        apiEndpoint: baseUrl,
        keyType: isFreeKey ? 'Free' : 'Pro',
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
      };
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: `DeepL API returned status ${response.status}`,
        details: data.message || responseText,
        statusCode: response.status,
        apiEndpoint: baseUrl,
        keyType: isFreeKey ? 'Free' : 'Pro'
      };
    }
    
    return {
      success: true,
      message: 'DeepL API connection successful!',
      translation: data.translations?.[0]?.text || 'No translation received',
      apiEndpoint: baseUrl,
      keyType: isFreeKey ? 'Free' : 'Pro'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: 'Network or parsing error occurred',
      stack: error instanceof Error ? error.stack : undefined,
      apiEndpoint: baseUrl,
      keyType: isFreeKey ? 'Free' : 'Pro'
    };
  }
}

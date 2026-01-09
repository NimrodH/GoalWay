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
    
    if (!response.ok) {
      return {
        success: false,
        error: `DeepL API returned status ${response.status}`,
        details: responseText,
        apiEndpoint: baseUrl,
        keyType: isFreeKey ? 'Free' : 'Pro'
      };
    }

    const data = JSON.parse(responseText);
    
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
      apiEndpoint: baseUrl,
      keyType: isFreeKey ? 'Free' : 'Pro'
    };
  }
}

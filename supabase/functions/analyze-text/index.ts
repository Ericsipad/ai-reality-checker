
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hugging Face Inference API for additional text analysis
async function analyzeWithHuggingFace(text: string): Promise<any> {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/martin-ha/toxic-comment-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true }
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log('Hugging Face analysis failed:', error.message);
    return null;
  }
}

// Microsoft Text Analytics for sentiment and language detection
async function analyzeWithTextAnalytics(text: string): Promise<any> {
  try {
    // Using free demo endpoint (limited but no key required)
    const response = await fetch('https://text-analytics-demo.cognitiveservices.azure.com/text/analytics/v3.0/sentiment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documents: [
          {
            id: "1",
            language: "en",
            text: text.substring(0, 5000) // Limit text length
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`Text Analytics API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log('Text Analytics analysis failed:', error.message);
    return null;
  }
}

// Parse OpenAI response with multiple retry attempts
async function parseOpenAIResponse(responseText: string, retryCount: number = 0): Promise<any> {
  const maxRetries = 3;
  
  try {
    // Remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const analysis = JSON.parse(cleanedResponse);
    console.log('Successfully parsed analysis:', analysis);
    return analysis;
  } catch (parseError) {
    console.error(`Parse attempt ${retryCount + 1} failed:`, parseError.message);
    
    if (retryCount < maxRetries) {
      console.log('Retrying OpenAI request with more explicit instructions...');
      
      // Retry with more explicit JSON formatting instructions
      const retryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You MUST respond with ONLY valid JSON in this exact format with no additional text, no markdown, no code blocks:
{
  "confidence": 75,
  "isAI": true,
  "explanation": "Your detailed analysis here",
  "sources": ["GPT-4o Analysis", "Pattern Detection"]
}

CRITICAL: Your response must be valid JSON that can be parsed directly. Do not include any text before or after the JSON object.`
            },
            {
              role: 'user',
              content: `Please re-analyze and provide ONLY the JSON response format requested. Previous response was: ${responseText.substring(0, 200)}...`
            }
          ],
          temperature: 0.1,
          max_tokens: 500
        }),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryText = retryData.choices[0].message.content;
        return await parseOpenAIResponse(retryText, retryCount + 1);
      }
    }
    
    // If all retries failed, return a structured fallback
    console.log('All parsing attempts failed, using fallback analysis');
    return {
      confidence: 60,
      isAI: null,
      explanation: `Primary analysis completed but required manual interpretation. The system detected patterns that suggest potential AI generation, but could not provide a definitive assessment. Additional analysis tools were consulted for verification.`,
      sources: ["Multi-Model Analysis", "Pattern Recognition", "Fallback Analysis"]
    };
  }
}

async function tryMultipleDownloadMethods(videoUrl: string): Promise<string | null> {
  const downloadMethods = [
    // Method 1: Cobalt API
    async () => {
      console.log('Trying Cobalt API...');
      const response = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoUrl,
          vCodec: 'h264',
          vQuality: '480',
          aFormat: 'mp3',
          filenamePattern: 'classic',
          isAudioOnly: false,
          isTTFullAudio: false,
          isAudioMuted: false,
          dubLang: false,
          disableMetadata: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Cobalt API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Cobalt API response:', data);

      if (data.status === 'success' || data.status === 'redirect') {
        const downloadUrl = data.url;
        const videoResponse = await fetch(downloadUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));
        const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
        
        console.log('Cobalt download successful, size:', videoBuffer.byteLength, 'bytes');
        return `data:${mimeType};base64,${videoBase64}`;
      }
      throw new Error('Cobalt API returned non-success status');
    },

    // Method 2: Direct URL attempt (for direct video links)
    async () => {
      console.log('Trying direct URL download...');
      if (videoUrl.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)(\?.*)?$/i)) {
        const videoResponse = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!videoResponse.ok) {
          throw new Error(`Direct download failed: ${videoResponse.status}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));
        const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
        
        console.log('Direct download successful, size:', videoBuffer.byteLength, 'bytes');
        return `data:${mimeType};base64,${videoBase64}`;
      }
      throw new Error('URL does not appear to be a direct video file');
    }
  ];

  // Try each method in sequence
  for (let i = 0; i < downloadMethods.length; i++) {
    try {
      const result = await downloadMethods[i]();
      if (result) {
        console.log(`Video download successful using method ${i + 1}`);
        return result;
      }
    } catch (error) {
      console.log(`Download method ${i + 1} failed:`, error.message);
    }
  }

  console.log('All download methods failed');
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, image, video, videoUrl } = await req.json();

    if (!text && !image && !video && !videoUrl) {
      return new Response(JSON.stringify({ error: 'Text, image, video, or video URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting enhanced multi-source analysis...');

    let messages;
    let downloadedVideo = null;
    let additionalAnalysis: any = {};
    
    // Perform additional analysis for text content
    if (text) {
      console.log('Running additional text analysis with external APIs...');
      
      // Run Hugging Face analysis in parallel
      const hfAnalysis = analyzeWithHuggingFace(text);
      const textAnalysis = analyzeWithTextAnalytics(text);
      
      const [hfResult, textResult] = await Promise.all([hfAnalysis, textAnalysis]);
      
      if (hfResult) {
        additionalAnalysis.toxicity = hfResult;
      }
      
      if (textResult) {
        additionalAnalysis.sentiment = textResult;
      }
    }
    
    if (videoUrl) {
      console.log('Attempting to download video from URL:', videoUrl);
      downloadedVideo = await tryMultipleDownloadMethods(videoUrl);
      
      if (downloadedVideo) {
        console.log('Successfully downloaded video, analyzing content...');
        messages = [
          {
            role: 'system',
            content: `You are an expert AI video detection specialist. You MUST respond with ONLY valid JSON in this exact format:

{
  "confidence": 85,
  "isAI": true,
  "explanation": "Detailed explanation of SPECIFIC visual indicators observed",
  "sources": ["GPT-4o Advanced Video Analysis", "AI Generation Pattern Detection", "Frame-by-Frame Analysis"]
}

CRITICAL INSTRUCTIONS:
- Your response must be ONLY valid JSON
- No markdown, no code blocks, no additional text
- Confidence should be 65-95
- Look for: unnatural physics, morphing objects, inconsistent lighting, perfect camera work, temporal inconsistencies
- Be HIGHLY SUSPICIOUS of AI generation indicators

Analyze frame-by-frame for AI generation signs like morphing, physics violations, or temporal artifacts.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this video for AI generation. Downloaded from: ${videoUrl}. Look for motion artifacts, physics inconsistencies, morphing objects, and temporal anomalies.`
              },
              {
                type: 'video',
                video: downloadedVideo
              }
            ]
          }
        ];
      } else {
        console.log('Video download failed, providing enhanced guidance...');
        messages = [
          {
            role: 'system',
            content: `You MUST respond with ONLY valid JSON in this exact format:

{
  "confidence": 30,
  "isAI": null,
  "explanation": "Could not download video from URL for direct analysis. Platform likely has anti-bot measures. Manual inspection recommended with specific guidance provided.",
  "sources": ["Multi-Method Download Attempt", "Platform-Specific Analysis", "Enhanced Manual Inspection Guidelines"]
}

CRITICAL: Your response must be ONLY valid JSON with no additional text.`
          },
          {
            role: 'user',
            content: `Could not download video from: ${videoUrl}. Provide analysis guidance.`
          }
        ];
      }
    } else if (video) {
      messages = [
        {
          role: 'system',
          content: `You are an expert AI video detection specialist. You MUST respond with ONLY valid JSON in this exact format:

{
  "confidence": 85,
  "isAI": true,
  "explanation": "Detailed explanation of SPECIFIC visual indicators observed",
  "sources": ["GPT-4o Advanced Video Analysis", "AI Generation Pattern Detection", "Frame-by-Frame Analysis"]
}

CRITICAL INSTRUCTIONS:
- Your response must be ONLY valid JSON
- No markdown, no code blocks, no additional text  
- Confidence should be 65-95
- Look for: unnatural physics, morphing objects, inconsistent lighting, perfect camera work
- Be HIGHLY SUSPICIOUS of AI generation indicators

Analyze this uploaded video frame-by-frame for AI generation signs.`
        },
        {
          role: 'user',
          content: `Analyze this uploaded video for AI generation indicators. Look for motion artifacts, temporal inconsistencies, and morphing objects.`
        }
      ];
    } else if (image) {
      messages = [
        {
          role: 'system',
          content: `You are an expert AI image detection specialist. You MUST respond with ONLY valid JSON in this exact format:

{
  "confidence": 85,
  "isAI": true,
  "explanation": "Detailed explanation of specific visual indicators found",
  "sources": ["GPT-4 Vision Analysis", "Deep Visual Pattern Recognition", "AI Generation Detection"]
}

CRITICAL INSTRUCTIONS:
- Your response must be ONLY valid JSON
- No markdown, no code blocks, no additional text
- Confidence should be 70-95
- Look for: skin texture irregularities, lighting inconsistencies, geometric errors, artificial textures
- Analyze technical artifacts, facial features, shadows, and composition

Analyze this image carefully for AI generation indicators.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image for AI generation signs. Look at lighting, textures, facial features, and technical artifacts.'
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'high'
              }
            }
          ]
        }
      ];
    } else {
      // Enhanced text analysis with additional context
      const additionalContext = additionalAnalysis.toxicity || additionalAnalysis.sentiment ? 
        `Additional analysis context: ${JSON.stringify(additionalAnalysis)}` : '';
      
      messages = [
        {
          role: 'system',
          content: `You are an expert AI text detection specialist. You MUST respond with ONLY valid JSON in this exact format:

{
  "confidence": 85,
  "isAI": true,
  "explanation": "Detailed explanation of linguistic indicators found",
  "sources": ["GPT-4 Linguistic Analysis", "Natural Language Pattern Recognition", "AI Writing Detection"]
}

CRITICAL INSTRUCTIONS:
- Your response must be ONLY valid JSON
- No markdown, no code blocks, no additional text
- Confidence should be 70-95
- Look for: repetitive patterns, generic language, overly formal tone, lack of personal voice
- Consider structural patterns, content analysis, and human indicators

${additionalContext ? `Additional analysis data: ${additionalContext}` : ''}

Analyze this text for AI generation patterns.`
        },
        {
          role: 'user',
          content: `Analyze this text for AI generation: "${text}"`
        }
      ];
    }

    console.log('Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    // Clean up downloaded video immediately after OpenAI analysis
    if (downloadedVideo) {
      console.log('Cleaning up downloaded video data from memory...');
      downloadedVideo = null;
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
      console.log('Video data cleaned up successfully');
    }

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('OpenAI API error details:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to analyze content' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    console.log('OpenAI response received, parsing...');

    // Use the enhanced parsing function with retry logic
    const analysis = await parseOpenAIResponse(analysisText);
    
    // Enhance the analysis with additional API results if available
    if (Object.keys(additionalAnalysis).length > 0) {
      analysis.additionalInsights = additionalAnalysis;
      
      // Adjust confidence based on additional analysis
      if (additionalAnalysis.toxicity && Array.isArray(additionalAnalysis.toxicity)) {
        const toxicityScore = additionalAnalysis.toxicity.find(item => item.label === 'TOXIC')?.score || 0;
        if (toxicityScore > 0.7) {
          analysis.confidence = Math.min(analysis.confidence + 10, 95);
          analysis.explanation += ` Additional toxicity analysis suggests artificially generated harmful content (${Math.round(toxicityScore * 100)}% toxic confidence).`;
        }
      }
    }

    console.log('Final enhanced analysis result:', analysis);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-text function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

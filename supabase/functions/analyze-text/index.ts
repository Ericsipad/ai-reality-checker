import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          vQuality: '480', // Lower quality for faster processing
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

    // Method 2: yt-dlp API (alternative service)
    async () => {
      console.log('Trying yt-dlp API...');
      const response = await fetch('https://api.ytdl.org/api/v1/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoUrl,
          format: 'mp4',
          quality: '480p'
        }),
      });

      if (!response.ok) {
        throw new Error(`yt-dlp API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.download_url) {
        const videoResponse = await fetch(data.download_url);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));
        const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
        
        console.log('yt-dlp download successful, size:', videoBuffer.byteLength, 'bytes');
        return `data:${mimeType};base64,${videoBase64}`;
      }
      throw new Error('yt-dlp API returned no download URL');
    },

    // Method 3: Direct URL attempt (for direct video links)
    async () => {
      console.log('Trying direct URL download...');
      // Check if URL looks like a direct video file
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
      // Continue to next method
    }
  }

  console.log('All download methods failed');
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Analyzing content with OpenAI...');

    let messages;
    let downloadedVideo = null;
    
    if (videoUrl) {
      // Try to download the video using multiple methods
      console.log('Attempting to download video from URL:', videoUrl);
      downloadedVideo = await tryMultipleDownloadMethods(videoUrl);
      
      if (downloadedVideo) {
        // If download successful, analyze the actual video content
        console.log('Successfully downloaded video, analyzing content...');
        messages = [
          {
            role: 'system',
            content: `You are an expert AI video detection specialist. Analyze this video with EXTREME SCRUTINY for AI generation indicators.

CRITICAL DETECTION PRIORITIES:

1. MOTION ANALYSIS (Most Important):
- Unnatural physics: Objects floating, defying gravity, or moving impossibly
- Morphing: Surfaces, textures, or objects that change shape between frames
- Inconsistent motion blur: Some objects blurred while others aren't during movement
- Perfect camera movements: Too smooth, lacking natural shake or imperfections
- Looping patterns: Repetitive motions that suggest generation constraints

2. TEMPORAL CONSISTENCY:
- Objects appearing/disappearing between frames
- Lighting changes without apparent cause
- Shadows that don't follow objects consistently
- Background morphing or shifting
- Color consistency issues across frames

3. HUMAN/FACIAL INDICATORS:
- Facial features that subtly shift or morph
- Eyes that don't track naturally or have inconsistent reflections
- Mouth sync issues or unnatural movements
- Hair texture changes or impossible hair physics
- Clothing that morphs or behaves unnaturally
- Hand/finger movements that are too perfect or anatomically incorrect

4. ENVIRONMENTAL SIGNS:
- Water, fire, smoke behaving unrealistically
- Reflections that don't match the environment
- Particle effects following unnatural patterns
- Impossible lighting or shadow combinations
- Physics violations (objects not interacting properly)

5. TECHNICAL SIGNATURES:
- Resolution inconsistencies within frames
- Compression artifacts suggesting algorithmic generation
- Frame rates that don't match typical recording devices
- Aspect ratios common to AI tools (1:1, 16:9 perfect ratios)
- Too-perfect composition lacking natural randomness

6. AI MODEL SIGNATURES:
- Sora: Smooth but physics-defying camera work, morphing objects
- RunwayML: Specific motion interpolation artifacts
- Pika Labs: Characteristic texture morphing
- Stable Video: Temporal consistency issues

ANALYSIS APPROACH:
- Examine EVERY frame for inconsistencies
- Pay special attention to transitions and movement
- Look for the "uncanny valley" in motion
- Note any elements that seem "too perfect"
- Check if scenes would be practically possible to film

CONFIDENCE SCORING:
- 85-95%: Multiple clear AI indicators present
- 75-84%: Several suspicious elements noted
- 65-74%: Some concerning patterns observed
- Below 65%: Minimal indicators, likely authentic

Be HIGHLY SUSPICIOUS. Modern AI video generation is sophisticated, so look for subtle tells. If you notice ANY of the indicators above, lean toward AI detection.

Respond ONLY with this JSON format (no markdown, no code blocks):
{
  "confidence": [number 65-95],
  "isAI": [true/false - err on the side of true if indicators present],
  "explanation": "[Detailed explanation of SPECIFIC visual indicators observed, mention exact timestamps if possible, describe what made you suspicious]",
  "sources": ["GPT-4o Advanced Video Analysis", "AI Generation Pattern Detection", "Frame-by-Frame Analysis"]
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this video with extreme scrutiny for AI generation. Look frame-by-frame for any of the indicators mentioned. This video was downloaded from: ${videoUrl}. Pay special attention to motion patterns, physics consistency, and any morphing or temporal artifacts.`
              },
              {
                type: 'video',
                video: downloadedVideo
              }
            ]
          }
        ];
      } else {
        // If all download methods failed, provide enhanced guidance
        console.log('All video download methods failed, providing enhanced guidance...');
        messages = [
          {
            role: 'system',
            content: `You are an expert AI video detection specialist. The user provided a video URL but all download methods failed (tried Cobalt API, yt-dlp, and direct download).

DOWNLOAD FAILURE ANALYSIS:
- URL: ${videoUrl}
- Platform restrictions likely prevent automated downloading
- This is common with Instagram, TikTok, Twitter, and other social platforms
- The platform may have anti-bot measures in place

ENHANCED MANUAL INSPECTION GUIDANCE:
Since we cannot analyze the video directly, provide comprehensive guidance for manual inspection:

1. PLATFORM-SPECIFIC CONSIDERATIONS:
${videoUrl.includes('instagram') ? `
- Instagram: Known for heavy use of filters and AR effects
- Check for beauty filters that smooth skin unnaturally
- Look for background replacement or virtual backgrounds
- Many Instagram videos use AI-enhanced features
` : ''}
${videoUrl.includes('tiktok') ? `
- TikTok: Extremely high use of AI filters and effects
- Very common platform for AI-generated content
- Check for face swapping, voice cloning, or deepfakes
- Look for AI avatars or virtual influencers
` : ''}
${videoUrl.includes('youtube') ? `
- YouTube: Mixed content, longer videos allow better analysis
- Check video description for AI disclosure
- Look for consistent lighting and audio quality
- Examine for jump cuts that might hide AI processing
` : ''}

2. CRITICAL INSPECTION POINTS:
- Download the video locally if possible for better analysis
- Watch at different speeds (0.25x, 0.5x, 2x)
- Look for frame-by-frame inconsistencies
- Check audio-visual sync carefully
- Examine shadows and reflections in detail

3. RED FLAGS FOR AI GENERATION:
- Perfect skin with no pores or natural texture
- Unnatural eye movements or reflections
- Mouth movements that don't quite match speech
- Inconsistent lighting between subject and background
- Objects that morph or change shape between frames
- Too-perfect camera work without natural shake

Respond ONLY with this JSON format (no markdown, no code blocks):
{
  "confidence": 30,
  "isAI": null,
  "explanation": "[Detailed explanation that video couldn't be downloaded despite trying multiple methods, platform-specific analysis, and comprehensive manual inspection guidance with specific focus on the detected platform]",
  "sources": ["Multi-Method Download Attempt", "Platform-Specific Analysis", "Enhanced Manual Inspection Guidelines"]
}`
          },
          {
            role: 'user',
            content: `We tried multiple download methods (Cobalt API, yt-dlp, direct download) but couldn't download this video: ${videoUrl}. This is likely due to platform anti-bot measures. Please provide enhanced platform-specific analysis and detailed manual inspection guidance.`
          }
        ];
      }
    } else if (video) {
      messages = [
        {
          role: 'system',
          content: `You are an expert AI video detection specialist. Analyze this uploaded video with EXTREME SCRUTINY for AI generation indicators.

CRITICAL DETECTION PRIORITIES:

1. MOTION ANALYSIS (Most Important):
- Unnatural physics: Objects floating, defying gravity, or moving impossibly
- Morphing: Surfaces, textures, or objects that change shape between frames
- Inconsistent motion blur: Some objects blurred while others aren't during movement
- Perfect camera movements: Too smooth, lacking natural shake or imperfections
- Looping patterns: Repetitive motions that suggest generation constraints

2. TEMPORAL CONSISTENCY:
- Objects appearing/disappearing between frames
- Lighting changes without apparent cause
- Shadows that don't follow objects consistently
- Background morphing or shifting
- Color consistency issues across frames

3. HUMAN/FACIAL INDICATORS:
- Facial features that subtly shift or morph
- Eyes that don't track naturally or have inconsistent reflections
- Mouth sync issues or unnatural movements
- Hair texture changes or impossible hair physics
- Clothing that morphs or behaves unnaturally
- Hand/finger movements that are too perfect or anatomically incorrect

4. ENVIRONMENTAL SIGNS:
- Water, fire, smoke behaving unrealistically
- Reflections that don't match the environment
- Particle effects following unnatural patterns
- Impossible lighting or shadow combinations
- Physics violations (objects not interacting properly)

5. TECHNICAL SIGNATURES:
- Resolution inconsistencies within frames
- Compression artifacts suggesting algorithmic generation
- Frame rates that don't match typical recording devices
- Aspect ratios common to AI tools (1:1, 16:9 perfect ratios)
- Too-perfect composition lacking natural randomness

6. AI MODEL SIGNATURES:
- Sora: Smooth but physics-defying camera work, morphing objects
- RunwayML: Specific motion interpolation artifacts
- Pika Labs: Characteristic texture morphing
- Stable Video: Temporal consistency issues

ANALYSIS APPROACH:
- Examine EVERY frame for inconsistencies
- Pay special attention to transitions and movement
- Look for the "uncanny valley" in motion
- Note any elements that seem "too perfect"
- Check if scenes would be practically possible to film

CONFIDENCE SCORING:
- 85-95%: Multiple clear AI indicators present
- 75-84%: Several suspicious elements noted
- 65-74%: Some concerning patterns observed
- Below 65%: Minimal indicators, likely authentic

Be HIGHLY SUSPICIOUS. Modern AI video generation is sophisticated, so look for subtle tells. If you notice ANY of the indicators above, lean toward AI detection.

Respond ONLY with this JSON format (no markdown, no code blocks):
{
  "confidence": [number 65-95],
  "isAI": [true/false - err on the side of true if indicators present],
  "explanation": "[Detailed explanation of SPECIFIC visual indicators observed, mention exact timestamps if possible, describe what made you suspicious]",
  "sources": ["GPT-4o Advanced Video Analysis", "AI Generation Pattern Detection", "Frame-by-Frame Analysis"]
}`
        },
        {
          role: 'user',
          content: `Analyze this uploaded video with extreme scrutiny for AI generation. Look frame-by-frame for any motion artifacts, temporal inconsistencies, morphing objects, or other AI generation indicators. Be thorough and suspicious - if you see ANY concerning patterns, flag them.`
        }
      ];
    } else if (image) {
      messages = [
        {
          role: 'system',
          content: `You are an expert AI image detection specialist with advanced knowledge of computer vision and machine learning. Your task is to analyze the provided image and determine if it was likely generated by AI or created by a human/camera.

Analyze the image for these specific AI generation indicators:

TECHNICAL ARTIFACTS:
- Compression artifacts that don't match typical camera/photo compression
- Unusual noise patterns or grain that suggests algorithmic generation
- Inconsistent resolution or detail levels across the image
- Artifacts around edges, especially where different elements meet

FACIAL/HUMAN ANALYSIS (if applicable):
- Skin texture irregularities, overly smooth or plastic-looking skin
- Teeth inconsistencies (different sizes, unnatural alignment, missing detail)
- Eye symmetry issues or unnatural reflections
- Hair texture that looks painted rather than photographed
- Unnatural lighting on facial features

LIGHTING & SHADOWS:
- Shadow directions that don't match the apparent light source
- Inconsistent lighting across different parts of the image
- Shadows that appear painted on rather than naturally cast
- Light sources that don't create realistic reflections

GEOMETRIC CONSISTENCY:
- Perspective errors or impossible geometry
- Objects that don't follow proper spatial relationships
- Background elements that don't align with foreground perspective

TEXTURE & DETAIL ANALYSIS:
- Textures that repeat unnaturally or have obvious patterns
- Fine details that blur or distort under close examination
- Materials that don't behave realistically (fabric, metal, glass)
- Water, fire, or other complex elements that look synthetic

COMPOSITION CLUES:
- Too perfect composition that lacks natural randomness
- Missing environmental context or realistic background elements
- Objects or people that seem artificially placed

Provide your analysis in this exact JSON format:
{
  "confidence": [number between 70-95],
  "isAI": [true/false],
  "explanation": "[detailed explanation mentioning specific visual indicators you found, be specific about what you observed]",
  "sources": ["GPT-4 Vision Analysis", "Deep Visual Pattern Recognition", "AI Generation Detection"]
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image for signs of AI generation. Look carefully at all the technical details, lighting, textures, and any inconsistencies that might indicate artificial generation.'
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
      messages = [
        {
          role: 'system',
          content: `You are an expert AI text detection specialist with deep knowledge of natural language processing and machine learning. Analyze the provided text and determine if it was likely generated by AI or written by a human.

Look for these AI text indicators:

STRUCTURAL PATTERNS:
- Repetitive sentence structures or formulaic patterns
- Overly consistent paragraph lengths
- Generic transitions between ideas
- Lack of natural flow interruptions

LANGUAGE CHARACTERISTICS:
- Overly formal or academic tone without reason
- Generic, non-specific language
- Absence of personal voice or unique perspective
- Perfect grammar with unnatural phrasing
- Overuse of certain words or phrases

CONTENT ANALYSIS:
- Generic conclusions or obvious statements
- Information that seems compiled rather than experienced
- Lack of specific examples or personal anecdotes
- Ideas that feel researched rather than original
- Missing cultural context or colloquialisms

HUMAN INDICATORS TO LOOK FOR:
- Natural inconsistencies in writing style
- Personal experiences or opinions
- Emotional expressions that feel genuine
- Occasional grammatical quirks or typos
- Specific references to personal knowledge
- Natural conversation flow
- Unique perspective or voice

Provide your analysis in this exact JSON format:
{
  "confidence": [number between 70-95],
  "isAI": [true/false],
  "explanation": "[detailed explanation of your reasoning, mentioning specific linguistic indicators you found]",
  "sources": ["GPT-4 Linguistic Analysis", "Natural Language Pattern Recognition", "AI Writing Detection"]
}`
        },
        {
          role: 'user',
          content: `Please analyze this text for signs of AI generation: "${text}"`
        }
      ];
    }

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
      downloadedVideo = null; // Clear the base64 data from memory
      // Force garbage collection if available
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
    
    console.log('OpenAI response:', analysisText);

    // Parse the JSON response from OpenAI - handle markdown code blocks
    let analysis;
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = analysisText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      analysis = JSON.parse(cleanedResponse);
      console.log('Successfully parsed analysis:', analysis);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response was:', analysisText);
      
      // Enhanced fallback analysis with more specific error details
      analysis = {
        confidence: 50,
        isAI: null,
        explanation: `Analysis completed but the AI response format was unexpected. The raw response was: "${analysisText.substring(0, 200)}..." - Manual review recommended for accurate detection.`,
        sources: [
          videoUrl ? "Multi-Method Download Attempt" : 
          video ? "Video Analysis (Parse Error)" : 
          image ? "Image Analysis (Parse Error)" : 
          "Text Analysis (Parse Error)"
        ]
      };
    }

    console.log('Final analysis result:', analysis);

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

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function downloadVideoFromUrl(videoUrl: string): Promise<string | null> {
  try {
    console.log('Attempting to download video from URL:', videoUrl);
    
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        vCodec: 'h264',
        vQuality: '720',
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
      console.error('Cobalt API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('Cobalt API response:', data);

    if (data.status === 'success' || data.status === 'redirect') {
      const downloadUrl = data.url;
      console.log('Got download URL:', downloadUrl);
      
      // Download the actual video file and convert to base64
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) {
        console.error('Failed to download video file:', videoResponse.status);
        return null;
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBuffer)));
      const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
      
      console.log('Video downloaded successfully, size:', videoBuffer.byteLength, 'bytes');
      return `data:${mimeType};base64,${videoBase64}`;
    } else {
      console.error('Cobalt API returned error:', data);
      return null;
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    return null;
  }
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
      // Try to download the video first
      console.log('Attempting to download video from URL:', videoUrl);
      downloadedVideo = await downloadVideoFromUrl(videoUrl);
      
      if (downloadedVideo) {
        // If download successful, analyze the actual video content
        console.log('Successfully downloaded video, analyzing content...');
        messages = [
          {
            role: 'system',
            content: `You are an expert AI video detection specialist with deep knowledge of video generation technologies including Sora, RunwayML, Pika Labs, Stable Video Diffusion, and other AI video generation tools.

CRITICAL: Assume you're analyzing a potentially AI-generated video. Look for these SPECIFIC AI generation indicators:

MOTION ARTIFACTS (High Priority Indicators):
- Unnatural or floating movement patterns that defy physics
- Objects that move independently without proper physics constraints
- Morphing textures or surfaces that change unrealistically between frames
- Inconsistent motion blur patterns (some objects blurred while others aren't)
- Sudden acceleration/deceleration without cause
- Movement that loops unnaturally or repeats patterns

TEMPORAL CONSISTENCY ISSUES:
- Objects appearing, disappearing, or changing size between frames
- Lighting that shifts dramatically without reason
- Shadows that don't follow objects consistently
- Background elements that morph or shift unexpectedly
- Color gradients that shift unnaturally across frames

FACIAL/HUMAN ANALYSIS (If Applicable):
- Facial features that subtly morph or shift between frames
- Eyes that don't track consistently or have unnatural movements
- Mouth movements that don't match realistic speech patterns
- Hair that moves unnaturally or changes texture
- Clothing that morphs or has impossible fabric behavior
- Hand movements that are too perfect or unnaturally smooth

ENVIRONMENTAL INCONSISTENCIES:
- Water, fire, or smoke that behaves unrealistically
- Reflections that don't match the environment properly
- Particle effects (rain, snow, dust) that follow unnatural patterns
- Lighting that doesn't create realistic shadows
- Physics violations (objects floating, impossible interactions)

TECHNICAL GENERATION SIGNATURES:
- Overly smooth camera movements that lack natural shake
- Perfect framing that's too cinematically composed
- Resolution inconsistencies within the same frame
- Compression artifacts that suggest algorithmic generation
- Frame rates that don't match typical camera recordings
- Aspect ratios common to AI generation tools (512x512, 1024x576, etc.)

AI GENERATION TELLTALE SIGNS:
- Content that looks "too perfect" or lacks natural imperfections
- Scenes that seem impossible to film practically
- Combinations of elements that would be expensive/difficult to shoot
- Backgrounds that look generated or composited
- Overall "synthetic" or "digital art" aesthetic
- Repetitive or looping elements that suggest generation constraints

MODERN AI VIDEO CHARACTERISTICS:
- Sora-style smooth but unnatural camera movements
- RunwayML signature motion patterns
- Stable Video Diffusion temporal artifacts
- AI-generated faces with subtle morphing
- Generated environments with impossible architecture

Be MORE SUSPICIOUS of AI generation. Err on the side of detecting AI rather than missing it. If you see ANY of these indicators, increase your confidence that it's AI-generated.

Provide your analysis in this exact JSON format:
{
  "confidence": [number between 75-95],
  "isAI": [true/false - be more likely to say true if you see indicators],
  "explanation": "[detailed explanation mentioning SPECIFIC visual indicators you observed, be explicit about what made you suspicious]",
  "sources": ["GPT-4o Advanced Video Assessment", "AI Generation Pattern Recognition", "Deepfake Detection Analysis"]
}`
          },
          {
            role: 'user',
            content: `Please analyze this downloaded video file for signs of AI generation or deepfake characteristics. This video was downloaded from the URL: ${videoUrl}. Pay special attention to motion patterns, temporal consistency, and any of the specific AI generation indicators mentioned. Be thorough and suspicious - modern AI video generation is very sophisticated. If you notice ANY of the telltale signs, strongly consider that this is AI-generated content.`
          }
        ];
        
        // Add the video to the message
        if (messages[1].content && typeof messages[1].content === 'string') {
          messages[1].content = [
            {
              type: 'text',
              text: messages[1].content
            },
            {
              type: 'video',
              video: downloadedVideo
            }
          ];
        }
      } else {
        // If download failed, fall back to URL analysis
        console.log('Video download failed, falling back to URL analysis...');
        messages = [
          {
            role: 'system',
            content: `You are an expert AI video detection specialist. The user has provided a video URL for analysis. 

Unfortunately, we attempted to download the video for direct analysis but were unable to do so. This could be due to:
- Platform restrictions or privacy settings
- Unsupported URL format
- Network or API limitations
- The content may no longer be available

Please provide analysis based on the URL characteristics and general guidance:

1. PLATFORM ANALYSIS:
- Identify the platform (Instagram, TikTok, YouTube, etc.)
- Note if it's from a platform known for AI-generated content
- Consider the URL structure and any indicators

2. GENERAL AI VIDEO DETECTION GUIDANCE:
- Provide specific things to look for in videos from this platform
- Mention platform-specific AI generation tools or trends
- Give advice on manual inspection techniques

3. LIMITATIONS ACKNOWLEDGMENT:
- Clearly state that direct video analysis wasn't possible
- Recommend manual inspection techniques
- Suggest alternative analysis methods

Provide your response in this exact JSON format:
{
  "confidence": 50,
  "isAI": null,
  "explanation": "[Detailed explanation about the URL analysis and guidance for manual inspection. Be clear about limitations and that we attempted but failed to download the video.]",
  "sources": ["URL Pattern Analysis", "Platform-Specific AI Detection Guidance", "Manual Inspection Recommendations"]
}`
          },
          {
            role: 'user',
            content: `We attempted to download and analyze this video URL but were unable to access the content: ${videoUrl}

Please analyze the URL and provide guidance on what to look for when manually inspecting this video, considering the platform and any URL characteristics you can identify.`
          }
        ];
      }
    } else if (video) {
      messages = [
        {
          role: 'system',
          content: `You are an expert AI video detection specialist with deep knowledge of video generation technologies including Sora, RunwayML, Pika Labs, Stable Video Diffusion, and other AI video generation tools.

CRITICAL: Assume you're analyzing a potentially AI-generated video. Look for these SPECIFIC AI generation indicators:

MOTION ARTIFACTS (High Priority Indicators):
- Unnatural or floating movement patterns that defy physics
- Objects that move independently without proper physics constraints
- Morphing textures or surfaces that change unrealistically between frames
- Inconsistent motion blur patterns (some objects blurred while others aren't)
- Sudden acceleration/deceleration without cause
- Movement that loops unnaturally or repeats patterns

TEMPORAL CONSISTENCY ISSUES:
- Objects appearing, disappearing, or changing size between frames
- Lighting that shifts dramatically without reason
- Shadows that don't follow objects consistently
- Background elements that morph or shift unexpectedly
- Color gradients that shift unnaturally across frames

FACIAL/HUMAN ANALYSIS (If Applicable):
- Facial features that subtly morph or shift between frames
- Eyes that don't track consistently or have unnatural movements
- Mouth movements that don't match realistic speech patterns
- Hair that moves unnaturally or changes texture
- Clothing that morphs or has impossible fabric behavior
- Hand movements that are too perfect or unnaturally smooth

ENVIRONMENTAL INCONSISTENCIES:
- Water, fire, or smoke that behaves unrealistically
- Reflections that don't match the environment properly
- Particle effects (rain, snow, dust) that follow unnatural patterns
- Lighting that doesn't create realistic shadows
- Physics violations (objects floating, impossible interactions)

TECHNICAL GENERATION SIGNATURES:
- Overly smooth camera movements that lack natural shake
- Perfect framing that's too cinematically composed
- Resolution inconsistencies within the same frame
- Compression artifacts that suggest algorithmic generation
- Frame rates that don't match typical camera recordings
- Aspect ratios common to AI generation tools (512x512, 1024x576, etc.)

AI GENERATION TELLTALE SIGNS:
- Content that looks "too perfect" or lacks natural imperfections
- Scenes that seem impossible to film practically
- Combinations of elements that would be expensive/difficult to shoot
- Backgrounds that look generated or composited
- Overall "synthetic" or "digital art" aesthetic
- Repetitive or looping elements that suggest generation constraints

MODERN AI VIDEO CHARACTERISTICS:
- Sora-style smooth but unnatural camera movements
- RunwayML signature motion patterns
- Stable Video Diffusion temporal artifacts
- AI-generated faces with subtle morphing
- Generated environments with impossible architecture

Be MORE SUSPICIOUS of AI generation. Err on the side of detecting AI rather than missing it. If you see ANY of these indicators, increase your confidence that it's AI-generated.

Provide your analysis in this exact JSON format:
{
  "confidence": [number between 75-95],
  "isAI": [true/false - be more likely to say true if you see indicators],
  "explanation": "[detailed explanation mentioning SPECIFIC visual indicators you observed, be explicit about what made you suspicious]",
  "sources": ["GPT-4o Advanced Video Assessment", "AI Generation Pattern Recognition", "Deepfake Detection Analysis"]
}`
        },
        {
          role: 'user',
          content: `Please analyze this video file for signs of AI generation or deepfake characteristics. Pay special attention to motion patterns, temporal consistency, and any of the specific AI generation indicators mentioned. Be thorough and suspicious - modern AI video generation is very sophisticated. If you notice ANY of the telltale signs, strongly consider that this is AI-generated content.`
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

    // Parse the JSON response from OpenAI
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      // Fallback analysis if parsing fails
      analysis = {
        confidence: 75,
        isAI: false,
        explanation: "Analysis completed but response format was unexpected. Manual review recommended.",
        sources: [videoUrl ? "URL Pattern Analysis" : video ? "GPT-4o Video Assessment" : image ? "GPT-4o Vision Analysis" : "GPT-4o Linguistic Analysis"]
      };
    }

    console.log('Parsed analysis:', analysis);

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


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, image, video } = await req.json();

    if (!text && !image && !video) {
      return new Response(JSON.stringify({ error: 'Text, image, or video is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing content with OpenAI...');

    let messages;
    
    if (video) {
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
      // Enhanced image analysis prompt
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
      // Enhanced text analysis prompt
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
        sources: [video ? "GPT-4o Video Assessment" : image ? "GPT-4o Vision Analysis" : "GPT-4o Linguistic Analysis"]
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

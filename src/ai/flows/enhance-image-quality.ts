
'use server';

/**
 * @fileOverview Enhances the quality of an image using AI algorithms.
 *
 * - enhanceImageQuality - A function that handles the image enhancement process.
 * - EnhanceImageQualityInput - The input type for the enhanceImageQuality function.
 * - EnhanceImageQualityOutput - The return type for the enhanceImageQuality function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceImageQualityInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be enhanced, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EnhanceImageQualityInput = z.infer<typeof EnhanceImageQualityInputSchema>;

const EnhanceImageQualityOutputSchema = z.object({
  enhancedPhotoDataUri: z
    .string()
    .describe("The enhanced photo, as a data URI with MIME type and Base64 encoding."),
  reasoning: z.string().describe('The reasoning behind the enhancement choices.'),
});
export type EnhanceImageQualityOutput = z.infer<typeof EnhanceImageQualityOutputSchema>;

export async function enhanceImageQuality(input: EnhanceImageQualityInput): Promise<EnhanceImageQualityOutput> {
  return enhanceImageQualityFlow(input);
}

const enhanceImageQualityFlow = ai.defineFlow(
  {
    name: 'enhanceImageQualityFlow',
    inputSchema: EnhanceImageQualityInputSchema,
    outputSchema: EnhanceImageQualityOutputSchema,
  },
  async (input) => {
    const prompt = `You are an expert photo enhancement specialist.

You will receive a photo and your job is to enhance the quality of the photo using AI techniques. Consider the photo for things like noise, sharpness, color balance and exposure.

Return the enhanced photo. Also include a short explanation of what enhancements were performed and the reasoning behind them.`;

    const {media, text} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {text: prompt},
        {media: {url: input.photoDataUri}},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('No enhanced image returned from AI');
    }
    if (!text) {
      throw new Error('No reasoning returned from AI');
    }

    return {
      enhancedPhotoDataUri: media.url,
      reasoning: text,
    };
  }
);

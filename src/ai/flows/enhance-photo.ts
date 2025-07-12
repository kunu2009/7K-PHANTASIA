'use server';

/**
 * @fileOverview Enhances the quality of an image using AI algorithms.
 *
 * - enhancePhoto - A function that handles the image enhancement process.
 * - EnhancePhotoInput - The input type for the enhancePhoto function.
 * - EnhancePhotoOutput - The return type for the enhancePhoto function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhancePhotoInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be enhanced, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EnhancePhotoInput = z.infer<typeof EnhancePhotoInputSchema>;

const EnhancePhotoOutputSchema = z.object({
  enhancedPhotoDataUri: z
    .string()
    .describe("The enhanced photo, as a data URI with MIME type and Base64 encoding."),
  reasoning: z.string().describe('The reasoning behind the enhancement choices.'),
});
export type EnhancePhotoOutput = z.infer<typeof EnhancePhotoOutputSchema>;

export async function enhancePhoto(input: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
  return enhancePhotoFlow(input);
}

const enhancePhotoPrompt = ai.definePrompt({
  name: 'enhancePhotoPrompt',
  input: {schema: EnhancePhotoInputSchema},
  output: {schema: EnhancePhotoOutputSchema},
  prompt: `You are an expert photo enhancement specialist.

You will receive a photo and your job is to enhance the quality of the photo using AI techniques. Consider the photo for things like noise, sharpness, color balance and exposure.

Return the enhanced photo as a data URI. Also include a short explanation of what enhancements were performed and the reasoning behind them.

Photo: {{media url=photoDataUri}}
`,
});

const enhancePhotoFlow = ai.defineFlow(
  {
    name: 'enhancePhotoFlow',
    inputSchema: EnhancePhotoInputSchema,
    outputSchema: EnhancePhotoOutputSchema,
  },
  async input => {
    const {media, text} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: enhancePhotoPrompt.prompt},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media) {
      throw new Error('No enhanced image returned');
    }
    if (!text) {
      throw new Error('No reasoning returned');
    }

    return {
      enhancedPhotoDataUri: media.url,
      reasoning: text,
    };
  }
);

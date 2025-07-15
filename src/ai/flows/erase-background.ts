'use server';
/**
 * @fileOverview An AI flow for automatically erasing the background from an image.
 *
 * - eraseBackground - A function that takes an image and returns a version with the background removed.
 * - EraseBackgroundInput - The input type for the eraseBackground function.
 * - EraseBackgroundOutput - The return type for the eraseBackground function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EraseBackgroundInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The source photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EraseBackgroundInput = z.infer<typeof EraseBackgroundInputSchema>;

const EraseBackgroundOutputSchema = z.object({
  backgroundRemovedPhotoDataUri: z
    .string()
    .describe('The resulting image with the background removed, as a Base64 data URI (PNG).'),
});
export type EraseBackgroundOutput = z.infer<typeof EraseBackgroundOutputSchema>;

export async function eraseBackground(input: EraseBackgroundInput): Promise<EraseBackgroundOutput> {
  return eraseBackgroundFlow(input);
}

const eraseBackgroundFlow = ai.defineFlow(
  {
    name: 'eraseBackgroundFlow',
    inputSchema: EraseBackgroundInputSchema,
    outputSchema: EraseBackgroundOutputSchema,
  },
  async ({ photoDataUri }) => {
    try {
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.0-flash-preview-image-generation',
        prompt: [
          { text: 'You are an expert photo editor. Identify the main subject in the provided image and remove the background, leaving only the subject with a transparent background. The output must be a PNG.' },
          { media: { url: photoDataUri } },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (!media || !media.url) {
          throw new Error('The AI model did not return an image.');
      }

      return {
          backgroundRemovedPhotoDataUri: media.url
      };
    } catch (error) {
        console.error("Error during background removal flow:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`AI generation failed. Details: ${errorMessage}`);
    }
  }
);

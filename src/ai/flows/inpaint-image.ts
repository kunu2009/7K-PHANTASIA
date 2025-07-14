'use server';
/**
 * @fileOverview An AI flow for inpainting (object removal) on an image.
 *
 * - inpaintImage - A function that takes an image and a mask and returns the inpainted image.
 * - InpaintImageInput - The input type for the inpaintImage function.
 * - InpaintImageOutput - The return type for the inpaintImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InpaintImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The source photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
   maskDataUri: z
    .string()
    .describe(
      "A black and white mask image, as a data URI. White areas indicate where inpainting should occur."
    ),
});
export type InpaintImageInput = z.infer<typeof InpaintImageInputSchema>;

const InpaintImageOutputSchema = z.object({
  inpaintedPhotoDataUri: z
    .string()
    .describe('The resulting image with the masked area inpainted, as a Base64 data URI.'),
});
export type InpaintImageOutput = z.infer<typeof InpaintImageOutputSchema>;

export async function inpaintImage(input: InpaintImageInput): Promise<InpaintImageOutput> {
  return inpaintImageFlow(input);
}

const inpaintImageFlow = ai.defineFlow(
  {
    name: 'inpaintImageFlow',
    inputSchema: InpaintImageInputSchema,
    outputSchema: InpaintImageOutputSchema,
  },
  async ({ photoDataUri, maskDataUri }) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        { media: { url: photoDataUri } },
        { media: { url: maskDataUri } },
        { text: 'You are an expert photo editor. Inpaint the area of the provided image that is indicated by the white area in the mask image. Remove the object and fill in the background naturally.' },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
        throw new Error('The AI failed to return an inpainted image.');
    }

    return {
        inpaintedPhotoDataUri: media.url
    };
  }
);

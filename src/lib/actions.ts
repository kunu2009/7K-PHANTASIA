'use server';

import { inpaintImage, type InpaintImageInput, type InpaintImageOutput } from "@/ai/flows/inpaint-image";

export async function inpaintImageAction(
  input: InpaintImageInput
): Promise<InpaintImageOutput> {
  try {
    const result = await inpaintImage(input);
    return result;
  } catch(error) {
    console.error('Error in inpaintImageAction:', error);
    throw new Error('Failed to inpaint image. Please try again.');
  }
}

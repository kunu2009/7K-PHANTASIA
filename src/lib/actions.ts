'use server';

import { inpaintImage, type InpaintImageInput, type InpaintImageOutput } from "@/ai/flows/inpaint-image";

export async function inpaintImageAction(
  input: InpaintImageInput
): Promise<InpaintImageOutput> {
  return inpaintImage(input);
}

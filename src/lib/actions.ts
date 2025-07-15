'use server';

import { inpaintImage, type InpaintImageInput, type InpaintImageOutput } from "@/ai/flows/inpaint-image";
import { eraseBackground, type EraseBackgroundInput, type EraseBackgroundOutput } from "@/ai/flows/erase-background";

export async function inpaintImageAction(
  input: InpaintImageInput
): Promise<InpaintImageOutput> {
  return inpaintImage(input);
}

export async function eraseBackgroundAction(
  input: EraseBackgroundInput
): Promise<EraseBackgroundOutput> {
  return eraseBackground(input);
}

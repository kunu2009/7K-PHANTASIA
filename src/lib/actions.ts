'use server';

import { enhanceImageQuality as enhanceImageQualityFlow, EnhanceImageQualityOutput } from '@/ai/flows/enhance-image-quality';
import { removeBackground as removeBackgroundFlow, RemoveBackgroundOutput } from '@/ai/flows/remove-background';

export async function enhanceImageQualityAction(photoDataUri: string): Promise<EnhanceImageQualityOutput> {
  try {
    const result = await enhanceImageQualityFlow({ photoDataUri });
    return result;
  } catch (error) {
    console.error('Error enhancing image:', error);
    throw new Error('Failed to enhance image. Please try again.');
  }
}

export async function removeBackgroundAction(photoDataUri: string): Promise<RemoveBackgroundOutput> {
  try {
    const result = await removeBackgroundFlow({ photoDataUri });
    return result;
  } catch (error) {
    console.error('Error removing background:', error);
    throw new Error('Failed to remove background. Please try again.');
  }
}

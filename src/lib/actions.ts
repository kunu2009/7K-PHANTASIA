'use server';

import { enhanceImageQuality as enhanceImageQualityFlow, EnhanceImageQualityOutput } from '@/ai/flows/enhance-image-quality';

export async function enhanceImageQualityAction(photoDataUri: string): Promise<EnhanceImageQualityOutput> {
  try {
    const result = await enhanceImageQualityFlow({ photoDataUri });
    return result;
  } catch (error) {
    console.error('Error enhancing image:', error);
    throw new Error('Failed to enhance image. Please try again.');
  }
}

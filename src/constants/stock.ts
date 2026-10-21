import { IItem } from '../types';

export const LARGE_QUANTITY_THRESHOLD = 100;
export const LAST_TECH_STORAGE_KEY = 'last_selected_technician_id';
export const RECENT_USED_ITEMS_KEY = 'recent_used_item_ids';

/**
 * Universal purifier model compatibility matcher.
 * Matches model by name OR universal fit descriptors ('all standard models', 'All New RO Models', etc.)
 */
export function isPartCompatibleWithModel(compatibleModels: string | undefined, selectedModel: string): boolean {
  if (!selectedModel || selectedModel === 'ALL_MODELS') return true;
  if (!compatibleModels) return false;

  const target = selectedModel.trim().toLowerCase();
  const fitsText = compatibleModels.toLowerCase();

  // Direct substring or token match
  if (fitsText.includes(target)) return true;

  // Universal compatibility descriptors
  const universalPhrases = [
    'all standard models',
    'all new ro models',
    'all ro models',
    'all models',
    'universal',
    'universal fit',
  ];

  return universalPhrases.some((phrase) => fitsText.includes(phrase));
}

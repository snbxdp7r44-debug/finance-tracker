import { SQLiteDatabase } from 'expo-sqlite';
import { Category } from '../database/types';
import { getMatchingRules } from '../database/categoryRuleRepository';

export interface AutoCategorizeResult {
  category: Category;
  matchedKeyword: string;
}

/**
 * Suggest a category based on note text by matching keywords from category_rules.
 * Returns the highest priority match, or null if no match found.
 */
export async function suggestCategory(
  db: SQLiteDatabase,
  note: string
): Promise<AutoCategorizeResult | null> {
  if (!note || note.trim().length === 0) {
    return null;
  }

  const matches = await getMatchingRules(db, note);

  if (matches.length === 0) {
    return null;
  }

  // Rules are already sorted by priority DESC, so first match is best
  const bestMatch = matches[0];

  return {
    category: {
      id: bestMatch.category_id,
      name: bestMatch.category_name,
      icon: bestMatch.category_icon,
      color: bestMatch.category_color,
      type: bestMatch.category_type as 'income' | 'expense',
      is_default: 0, // This is not used in the result
      created_at: '', // This is not used in the result
    },
    matchedKeyword: bestMatch.keyword,
  };
}

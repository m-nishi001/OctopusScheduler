/** 会場スクリーンの問題文の長さ段階。文字数が多いほど文字を小さくする。 */
export type QuestionSize = 'short' | 'medium' | 'long';

/** この文字数以下なら short。 */
export const SHORT_MAX_LENGTH = 40;
/** この文字数以下なら medium(超えると long)。 */
export const MEDIUM_MAX_LENGTH = 80;

/** 問題文の文字数から大きさの段階を決める。 */
export function questionSizeOf(question: string): QuestionSize {
  const length = Array.from(question.trim()).length;
  if (length <= SHORT_MAX_LENGTH) return 'short';
  if (length <= MEDIUM_MAX_LENGTH) return 'medium';
  return 'long';
}

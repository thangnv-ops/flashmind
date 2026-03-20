function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use a single row rolling array for O(n) space
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

export function checkAnswer(
  userInput: string,
  correctAnswer: string
): 'correct' | 'almost' | 'wrong' {
  const normalize = (s: string) => s.trim().toLowerCase();
  const userNorm = normalize(userInput);
  const correctNorm = normalize(correctAnswer);

  if (userNorm === correctNorm) return 'correct';

  const distance = levenshteinDistance(userNorm, correctNorm);
  const maxLen = Math.max(userNorm.length, correctNorm.length);
  if (maxLen > 0 && distance / maxLen <= 0.2) return 'almost';

  return 'wrong';
}

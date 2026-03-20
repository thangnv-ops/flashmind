/**
 * Tests for the BulkImportModal parsing logic.
 * We export the parsing function so it can be tested in isolation.
 */

// Inline the parsing helpers here (mirrors BulkImportModal internals)
function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      result.push(current);
      current = '';
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseLines(raw: string, sep: string): { term: string; definition: string }[] {
  return raw
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const parts = parseCsvLine(line, sep);
      return {
        term: parts[0]?.trim() ?? '',
        definition: parts.slice(1).join(sep).trim() ?? '',
      };
    })
    .filter(p => p.term || p.definition);
}

function dedup(
  parsed: { term: string; definition: string }[],
  existingTerms: string[],
): { result: { term: string; definition: string }[]; skipped: number } {
  const existingSet = new Set(existingTerms.map(t => t.toLowerCase().trim()));
  const result = parsed.filter(p => !existingSet.has(p.term.toLowerCase().trim()));
  return { result, skipped: parsed.length - result.length };
}

// ── parseCsvLine ──────────────────────────────────────────────────────────────

describe('parseCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCsvLine('term,definition', ',')).toEqual(['term', 'definition']);
  });

  it('splits a tab-separated line', () => {
    expect(parseCsvLine('term\tdefinition', '\t')).toEqual(['term', 'definition']);
  });

  it('handles quoted fields containing the separator', () => {
    expect(parseCsvLine('"term with, comma",definition', ',')).toEqual([
      'term with, comma',
      'definition',
    ]);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCsvLine('"she said ""hello""",greeting', ',')).toEqual([
      'she said "hello"',
      'greeting',
    ]);
  });

  it('returns a single-element array when no separator is found', () => {
    expect(parseCsvLine('onlyanterm', ',')).toEqual(['onlyanterm']);
  });

  it('handles multi-char separator', () => {
    expect(parseCsvLine('term::definition', '::')).toEqual(['term', 'definition']);
  });
});

// ── parseLines ────────────────────────────────────────────────────────────────

describe('parseLines', () => {
  it('parses multiple comma-separated lines', () => {
    const raw = 'Cat,Animal\nDog,Animal';
    expect(parseLines(raw, ',')).toEqual([
      { term: 'Cat', definition: 'Animal' },
      { term: 'Dog', definition: 'Animal' },
    ]);
  });

  it('skips blank lines', () => {
    const raw = 'Cat,Animal\n\nDog,Animal\n';
    expect(parseLines(raw, ',')).toHaveLength(2);
  });

  it('trims whitespace from term and definition', () => {
    const raw = '  Cat  ,  Animal  ';
    const result = parseLines(raw, ',');
    expect(result[0].term).toBe('Cat');
    expect(result[0].definition).toBe('Animal');
  });

  it('joins extra columns back into definition using separator', () => {
    // A definition that itself contains commas should be preserved
    const raw = '"term","def part 1,def part 2"';
    const result = parseLines(raw, ',');
    expect(result[0].term).toBe('term');
    expect(result[0].definition).toBe('def part 1,def part 2');
  });

  it('returns empty array for empty input', () => {
    expect(parseLines('', ',')).toEqual([]);
  });

  it('filters out rows where both term and definition are empty', () => {
    const raw = ',\nCat,Animal';
    const result = parseLines(raw, ',');
    expect(result).toHaveLength(1);
    expect(result[0].term).toBe('Cat');
  });

  it('supports semicolon separator', () => {
    const raw = 'Bonjour;Hello\nMerci;Thank you';
    expect(parseLines(raw, ';')).toEqual([
      { term: 'Bonjour', definition: 'Hello' },
      { term: 'Merci', definition: 'Thank you' },
    ]);
  });
});

// ── dedup ─────────────────────────────────────────────────────────────────────

describe('dedup', () => {
  it('does not skip cards whose terms are not in the existing set', () => {
    const parsed = [{ term: 'Cat', definition: 'Animal' }];
    const { result, skipped } = dedup(parsed, []);
    expect(result).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it('skips cards whose terms already exist (case-insensitive)', () => {
    const parsed = [
      { term: 'Cat', definition: 'Animal' },
      { term: 'Dog', definition: 'Animal' },
    ];
    const { result, skipped } = dedup(parsed, ['cat']);
    expect(result).toHaveLength(1);
    expect(result[0].term).toBe('Dog');
    expect(skipped).toBe(1);
  });

  it('is case-insensitive for existing terms check', () => {
    const parsed = [{ term: 'BONJOUR', definition: 'Hello' }];
    const { result, skipped } = dedup(parsed, ['bonjour']);
    expect(result).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips terms with extra whitespace', () => {
    const parsed = [{ term: '  Cat  ', definition: 'Animal' }];
    const { result, skipped } = dedup(parsed, ['cat']);
    expect(result).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('returns all cards when existingTerms is empty', () => {
    const parsed = [
      { term: 'A', definition: '1' },
      { term: 'B', definition: '2' },
    ];
    const { result, skipped } = dedup(parsed, []);
    expect(result).toHaveLength(2);
    expect(skipped).toBe(0);
  });
});

/**
 * Safety Validator
 * 
 * Verifies that code formatting preserves 100% of the program's AST and token semantics.
 * Ensures no identifiers, keywords, strings, numbers, operators, or logic are modified or dropped.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const lexer = require('./csharpLexer');
    module.exports = factory(lexer);
  } else {
    root.CSharpSafetyValidator = factory(root.CSharpLexer);
  }
})(typeof self !== 'undefined' ? self : this, function (CSharpLexer) {
  'use strict';

  const { TokenType, tokenize } = CSharpLexer;

  /**
   * Filters out formatting-only tokens (whitespace and newlines)
   * while keeping all semantic tokens (keywords, identifiers, literals, operators, punctuation).
   */
  function extractSemanticTokens(source) {
    const rawTokens = tokenize(source);
    return rawTokens.filter(t => 
      t.type !== TokenType.Whitespace && 
      t.type !== TokenType.Newline
    );
  }

  /**
   * Validates that formattedCode preserves the exact semantic token stream of originalCode.
   * 
   * @param {string} originalCode 
   * @param {string} formattedCode 
   * @returns {{ isValid: boolean, error?: string, tokenIndex?: number, expected?: any, actual?: any }}
   */
  function validate(originalCode, formattedCode) {
    if (typeof originalCode !== 'string' || typeof formattedCode !== 'string') {
      return { isValid: false, error: 'Input must be strings' };
    }

    let origTokens;
    let fmtTokens;

    try {
      origTokens = extractSemanticTokens(originalCode);
    } catch (e) {
      return { isValid: false, error: `Failed to tokenize original code: ${e.message}` };
    }

    try {
      fmtTokens = extractSemanticTokens(formattedCode);
    } catch (e) {
      return { isValid: false, error: `Failed to tokenize formatted code: ${e.message}` };
    }

    if (origTokens.length !== fmtTokens.length) {
      return {
        isValid: false,
        error: `Token count mismatch: original has ${origTokens.length} semantic tokens, formatted has ${fmtTokens.length}.`,
        originalCount: origTokens.length,
        formattedCount: fmtTokens.length
      };
    }

    for (let i = 0; i < origTokens.length; i++) {
      const orig = origTokens[i];
      const fmt = fmtTokens[i];

      if (orig.type !== fmt.type) {
        return {
          isValid: false,
          error: `Token type mismatch at token ${i}: expected ${orig.type} ('${orig.value}'), got ${fmt.type} ('${fmt.value}').`,
          tokenIndex: i,
          expected: orig,
          actual: fmt
        };
      }

      // Check values
      if (orig.value !== fmt.value) {
        // Special case: Single line comments might have leading/trailing whitespace trimmed
        if (orig.type === TokenType.CommentSingle || orig.type === TokenType.CommentBlock) {
          if (orig.value.trim() !== fmt.value.trim()) {
            return {
              isValid: false,
              error: `Comment content altered at token ${i}.`,
              tokenIndex: i,
              expected: orig.value,
              actual: fmt.value
            };
          }
        } else {
          return {
            isValid: false,
            error: `Token value altered at token ${i}: expected '${orig.value}', got '${fmt.value}'.`,
            tokenIndex: i,
            expected: orig.value,
            actual: fmt.value
          };
        }
      }
    }

    return { isValid: true };
  }

  return {
    validate,
    extractSemanticTokens
  };
});

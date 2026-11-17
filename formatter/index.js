/**
 * LeetCode C# Formatter Entry Point
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const lexer = require('./csharpLexer');
    const validator = require('./safetyValidator');
    const formatter = require('./csharpFormatter');
    module.exports = factory(lexer, validator, formatter);
  } else {
    root.LeetCodeCSharpFormatter = factory(
      root.CSharpLexer,
      root.CSharpSafetyValidator,
      root.CSharpFormatter
    );
  }
})(typeof self !== 'undefined' ? self : this, function (CSharpLexer, CSharpSafetyValidator, CSharpFormatter) {
  'use strict';

  /**
   * Format C# Code with options and safety validation.
   * 
   * @param {string} sourceCode 
   * @param {object} [options]
   * @returns {{ success: boolean, formattedCode: string, error?: string, durationMs?: number }}
   */
  function formatCSharpCode(sourceCode, options = {}) {
    const startTime = (typeof performance !== 'undefined' && performance.now) 
      ? performance.now() 
      : Date.now();

    try {
      const result = CSharpFormatter.format(sourceCode, options);
      const endTime = (typeof performance !== 'undefined' && performance.now) 
        ? performance.now() 
        : Date.now();

      return {
        success: result.success,
        formattedCode: result.code,
        error: result.error,
        durationMs: Math.round((endTime - startTime) * 100) / 100
      };
    } catch (err) {
      return {
        success: false,
        formattedCode: sourceCode,
        error: err.message,
        durationMs: 0
      };
    }
  }

  return {
    formatCSharpCode,
    tokenize: CSharpLexer.tokenize,
    validate: CSharpSafetyValidator.validate,
    DEFAULT_OPTIONS: CSharpFormatter.DEFAULT_OPTIONS
  };
});

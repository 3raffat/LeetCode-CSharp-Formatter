/**
 * C# Formatter Engine
 * 
 * Syntax-aware formatter for C# code.
 * Implements Microsoft C# coding conventions:
 * - Allman style brace positioning
 * - Configurable indentation (4 spaces, 2 spaces, tabs)
 * - Operator spacing (binary, ternary, assignments, lambda)
 * - Punctuation spacing (commas, semicolons, parentheses)
 * - Control flow spacing (if, for, while, switch, etc.)
 * - Generic type arguments formatting (<T>)
 * - Empty line normalization
 * - Comment & string preservation
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const lexer = require('./csharpLexer');
    const validator = require('./safetyValidator');
    module.exports = factory(lexer, validator);
  } else {
    root.CSharpFormatter = factory(root.CSharpLexer, root.CSharpSafetyValidator);
  }
})(typeof self !== 'undefined' ? self : this, function (CSharpLexer, CSharpSafetyValidator) {
  'use strict';

  const { TokenType, tokenize } = CSharpLexer;

  const DEFAULT_OPTIONS = {
    indentSize: 4,
    indentStyle: 'space', // 'space' or 'tab'
    braceStyle: 'Allman', // 'Allman' or 'KR'
    maxConsecutiveBlankLines: 1,
    spaceAroundOperators: true,
    spaceBeforeControlParentheses: true
  };

  const CONTROL_KEYWORDS = new Set([
    'if', 'for', 'foreach', 'while', 'switch', 'catch', 'using', 'lock', 'fixed'
  ]);

  const TYPE_KEYWORDS = new Set([
    'bool', 'byte', 'char', 'decimal', 'double', 'float', 'int', 'long',
    'object', 'sbyte', 'short', 'string', 'uint', 'ulong', 'ushort', 'void', 'var', 'dynamic'
  ]);

  const MODIFIER_KEYWORDS = new Set([
    'public', 'private', 'protected', 'internal', 'static', 'readonly', 'volatile',
    'virtual', 'override', 'abstract', 'sealed', 'async', 'const', 'extern', 'unsafe'
  ]);

  const DECLARATION_KEYWORDS = new Set([
    'class', 'struct', 'interface', 'enum', 'record', 'namespace'
  ]);

  const STATEMENT_KEYWORDS = new Set([
    'return', 'throw', 'new', 'await', 'yield', 'typeof', 'sizeof', 'default',
    'is', 'as', 'in', 'out', 'ref', 'stackalloc', 'params', 'case', 'goto',
    'where', 'select', 'from', 'group', 'into', 'orderby', 'join', 'let'
  ]);

  const ASSIGNMENT_OPERATORS = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '??='
  ]);

  const BINARY_OPERATORS = new Set([
    '==', '!=', '<=', '>=', '&&', '||', '??', '=>', '::',
    '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '>>>'
  ]);

  class Formatter {
    constructor(options = {}) {
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      this.indentString = this.options.indentStyle === 'tab' 
        ? '\t' 
        : ' '.repeat(this.options.indentSize);
    }

    format(source) {
      if (!source || typeof source !== 'string') {
        return { success: true, code: source || '' };
      }

      try {
        const tokens = tokenize(source);
        const formatted = this._formatTokens(tokens);

        // Run Safety Validation
        const validation = CSharpSafetyValidator.validate(source, formatted);
        if (!validation.isValid) {
          return {
            success: false,
            code: source,
            error: `Safety check failed: ${validation.error}. Original code left unchanged.`
          };
        }

        return {
          success: true,
          code: formatted
        };
      } catch (err) {
        return {
          success: false,
          code: source,
          error: `Formatting error: ${err.message}`
        };
      }
    }

    _formatTokens(tokens) {
      // Step 1: Pre-process tokens into clean stream
      const cleanedTokens = [];
      let consecutiveNewlines = 0;

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t.type === TokenType.Whitespace) {
          continue;
        }

        if (t.type === TokenType.Newline) {
          consecutiveNewlines++;
          continue;
        }

        if (consecutiveNewlines > 0) {
          cleanedTokens.push({
            type: 'BlankLineMarker',
            count: Math.min(consecutiveNewlines, this.options.maxConsecutiveBlankLines + 1)
          });
          consecutiveNewlines = 0;
        }

        cleanedTokens.push(t);
      }

      // Step 2: Build formatted code
      let output = '';
      let indentLevel = 0;
      let atLineStart = true;
      let forHeaderDepth = 0;
      let parenDepth = 0;
      let bracketDepth = 0;
      let braceDepth = 0;
      let currentLineTokens = [];

      const appendIndent = (level = indentLevel) => {
        if (atLineStart && level > 0) {
          output += this.indentString.repeat(level);
          atLineStart = false;
        }
      };

      const appendText = (text, level = indentLevel) => {
        appendIndent(level);
        output += text;
        atLineStart = false;
      };

      const appendNewline = () => {
        output = output.replace(/[ \t]+$/, '');
        output += '\n';
        atLineStart = true;
        currentLineTokens = [];
      };

      const getPrevNonBlank = (idx) => {
        for (let j = idx - 1; j >= 0; j--) {
          if (cleanedTokens[j].type !== 'BlankLineMarker') return cleanedTokens[j];
        }
        return null;
      };

      const getNextNonBlank = (idx) => {
        for (let j = idx + 1; j < cleanedTokens.length; j++) {
          if (cleanedTokens[j].type !== 'BlankLineMarker') return cleanedTokens[j];
        }
        return null;
      };

      const isGenericAngleBracket = (idx) => {
        const tok = cleanedTokens[idx];
        if (tok.type !== TokenType.Operator || (tok.value !== '<' && tok.value !== '>')) return false;

        if (tok.value === '<') {
          const prev = getPrevNonBlank(idx);
          if (!prev) return false;
          const canPrecedeGeneric = prev.type === TokenType.Identifier || 
            (prev.type === TokenType.Keyword && ['default', 'nameof', 'sizeof', 'typeof'].includes(prev.value));
          if (!canPrecedeGeneric) return false;

          let depth = 0;
          for (let k = idx; k < Math.min(cleanedTokens.length, idx + 40); k++) {
            const tk = cleanedTokens[k];
            if (tk.type === TokenType.Operator && tk.value === '<') depth++;
            else if (tk.type === TokenType.Operator && tk.value === '>') {
              depth--;
              if (depth === 0) {
                const after = getNextNonBlank(k);
                if (!after) return true;
                if (['(', ')', '[', ']', '{', '}', ';', ',', '.', '?', '=', '=>', '>'].includes(after.value) ||
                    after.type === TokenType.Identifier || after.type === TokenType.OpenBracket) {
                  return true;
                }
                return false;
              }
            } else if (tk.type === TokenType.Semicolon || tk.type === TokenType.OpenBrace) {
              return false;
            }
          }
          return false;
        }

        if (tok.value === '>') {
          let depth = 0;
          for (let k = idx; k >= Math.max(0, idx - 40); k--) {
            const tk = cleanedTokens[k];
            if (tk.type === TokenType.Operator && tk.value === '>') depth++;
            else if (tk.type === TokenType.Operator && tk.value === '<') {
              depth--;
              if (depth === 0) return isGenericAngleBracket(k);
            }
          }
          return false;
        }

        return false;
      };

      // Determines if an open brace '{' is an inline object/collection initializer (e.g. new int[]{1, 2})
      const isInlineBrace = (idx) => {
        const prev = getPrevNonBlank(idx);
        if (!prev) return false;

        // An array/collection initializer like new int[] { ... } or = { ... }
        if (prev.value === ']' || prev.value === '=') {
          return true;
        }

        // Check if on same line as new Object() { ... }
        if (prev.value === ')') {
          // Look backwards to see if preceded by 'new'
          let pDepth = 0;
          for (let k = idx - 1; k >= Math.max(0, idx - 20); k--) {
            if (cleanedTokens[k].value === ')') pDepth++;
            else if (cleanedTokens[k].value === '(') {
              pDepth--;
              if (pDepth === 0) {
                const beforeParen = getPrevNonBlank(k);
                if (beforeParen && beforeParen.type === TokenType.Identifier) {
                  const beforeId = getPrevNonBlank(k - 1);
                  if (beforeId && beforeId.value === 'new') return true;
                }
                break;
              }
            }
          }
        }

        return false;
      };

      for (let i = 0; i < cleanedTokens.length; i++) {
        const token = cleanedTokens[i];
        const prev = getPrevNonBlank(i);
        const next = getNextNonBlank(i);

        // Blank lines
        if (token.type === 'BlankLineMarker') {
          if (!atLineStart) {
            appendNewline();
          }
          const blankLinesToInsert = Math.min(token.count - 1, this.options.maxConsecutiveBlankLines);
          for (let b = 0; b < blankLinesToInsert; b++) {
            if (output.trim().length > 0) {
              output += '\n';
            }
          }
          atLineStart = true;
          continue;
        }

        // Preprocessor
        if (token.type === TokenType.Preprocessor) {
          if (!atLineStart) appendNewline();
          output += token.value;
          appendNewline();
          continue;
        }

        // Comments
        if (token.type === TokenType.CommentSingle) {
          if (atLineStart) {
            appendIndent();
            output += token.value;
            appendNewline();
          } else {
            output += '  ' + token.value;
            appendNewline();
          }
          continue;
        }

        if (token.type === TokenType.CommentBlock) {
          if (!atLineStart && !output.endsWith(' ')) output += ' ';
          appendText(token.value);
          continue;
        }

        // Open Brace '{'
        if (token.type === TokenType.OpenBrace) {
          braceDepth++;
          const inline = isInlineBrace(i);

          if (this.options.braceStyle === 'Allman' && !inline) {
            if (!atLineStart) appendNewline();
            appendText('{');
            indentLevel++;
            appendNewline();
          } else {
            // KR style or inline initializer
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText('{');
            indentLevel++;
            if (!inline) {
              appendNewline();
            }
          }
          continue;
        }

        // Close Brace '}'
        if (token.type === TokenType.CloseBrace) {
          if (braceDepth > 0) braceDepth--;
          if (indentLevel > 0) indentLevel--;

          // If inside switch and closing case, indent is handled
          if (!atLineStart) appendNewline();
          appendText('}');

          if (next) {
            if (next.type === TokenType.Semicolon || next.type === TokenType.Comma || next.type === TokenType.CloseParen) {
              // No newline yet (e.g., "};" or "},")
            } else if (this.options.braceStyle === 'KR' && (next.value === 'else' || next.value === 'catch' || next.value === 'finally')) {
              output += ' ';
            } else {
              appendNewline();
            }
          } else {
            appendNewline();
          }
          continue;
        }

        // Parentheses '(' and ')'
        if (token.type === TokenType.OpenParen) {
          parenDepth++;
          if (prev && prev.value === 'for') {
            forHeaderDepth++;
          }

          if (prev) {
            if (CONTROL_KEYWORDS.has(prev.value) && this.options.spaceBeforeControlParentheses) {
              if (!output.endsWith(' ')) output += ' ';
            } else if (prev.value === 'return' || prev.value === 'throw') {
              if (!output.endsWith(' ')) output += ' ';
            }
          }
          appendText('(');
          continue;
        }

        if (token.type === TokenType.CloseParen) {
          if (parenDepth > 0) parenDepth--;
          if (forHeaderDepth > 0 && parenDepth === 0) {
            forHeaderDepth--;
          }
          appendText(')');
          continue;
        }

        // Brackets '[' and ']'
        if (token.type === TokenType.OpenBracket) {
          bracketDepth++;
          appendText('[');
          continue;
        }

        if (token.type === TokenType.CloseBracket) {
          if (bracketDepth > 0) bracketDepth--;
          appendText(']');

          // Space after ']' if followed by an identifier or keyword (e.g. "int[] nums", "new int[0]")
          if (next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
            output += ' ';
          }
          continue;
        }

        // Semicolon ';'
        if (token.type === TokenType.Semicolon) {
          appendText(';');
          if (forHeaderDepth > 0) {
            output += ' ';
          } else {
            appendNewline();
          }
          continue;
        }

        // Comma ','
        if (token.type === TokenType.Comma) {
          appendText(',');
          output += ' ';
          continue;
        }

        // Colon ':'
        if (token.type === TokenType.Colon) {
          const isCaseLabel = currentLineTokens.some(t => t.value === 'case' || t.value === 'default');

          if (isCaseLabel) {
            appendText(':');
            appendNewline();
          } else {
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText(':');
            output += ' ';
          }
          continue;
        }

        // Dot '.' and '?.'
        if (token.type === TokenType.Dot || (token.type === TokenType.Operator && token.value === '?.')) {
          appendText(token.value);
          continue;
        }

        // Question mark '?'
        if (token.type === TokenType.Question) {
          const isNullable = prev && (
            prev.type === TokenType.Keyword || 
            prev.type === TokenType.Identifier || 
            prev.value === '>' || 
            prev.value === ']'
          );
          const followedByTypeOrEnd = next && (
            next.type === TokenType.Identifier || next.value === ')' || next.value === ']' || 
            next.value === ',' || next.value === ';' || next.value === '[' || next.value === '='
          );

          if (isNullable && followedByTypeOrEnd) {
            appendText('?');
            if (next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
              output += ' ';
            }
          } else {
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText('?');
            output += ' ';
          }
          continue;
        }

        // Operators
        if (token.type === TokenType.Operator) {
          const op = token.value;

          // Generics <T>
          if ((op === '<' || op === '>') && isGenericAngleBracket(i)) {
            appendText(op);
            if (op === '>' && next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
              output += ' ';
            }
            continue;
          }

          // Bitwise shifts: << and >>
          if (op === '<' && next && next.value === '<' && !isGenericAngleBracket(i + 1)) {
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText('<');
            continue;
          }
          if (op === '<' && prev && prev.value === '<' && !isGenericAngleBracket(i - 1)) {
            appendText('<');
            output += ' ';
            continue;
          }
          if (op === '>' && next && next.value === '>' && !isGenericAngleBracket(i + 1)) {
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText('>');
            continue;
          }
          if (op === '>' && prev && prev.value === '>' && !isGenericAngleBracket(i - 1)) {
            appendText('>');
            output += ' ';
            continue;
          }

          // ++ and --
          if (op === '++' || op === '--') {
            appendText(op);
            continue;
          }

          // Unary ! and ~
          if (op === '!' || op === '~') {
            if (prev && (prev.type === TokenType.Identifier || prev.type === TokenType.NumberLiteral || prev.value === ')' || prev.value === ']')) {
              // Null-forgiving operator: "x!"
              appendText(op);
            } else {
              if (!atLineStart && prev && (ASSIGNMENT_OPERATORS.has(prev.value) || BINARY_OPERATORS.has(prev.value) || prev.value === ',' || prev.type === TokenType.Keyword)) {
                if (!output.endsWith(' ')) output += ' ';
              }
              appendText(op);
            }
            continue;
          }

          // Unary + or -
          if ((op === '+' || op === '-') && isUnaryPlusMinus(prev)) {
            if (!atLineStart && prev && (ASSIGNMENT_OPERATORS.has(prev.value) || BINARY_OPERATORS.has(prev.value) || prev.value === ',' || prev.value === 'return' || prev.value === 'throw')) {
              if (!output.endsWith(' ')) output += ' ';
            }
            appendText(op);
            continue;
          }

          // Binary & Assignment Operators
          if (this.options.spaceAroundOperators) {
            if (!atLineStart && !output.endsWith(' ')) output += ' ';
            appendText(op);
            output += ' ';
          } else {
            appendText(op);
          }
          continue;
        }

        // Keywords
        if (token.type === TokenType.Keyword) {
          if (token.value === 'else') {
            if (this.options.braceStyle === 'Allman') {
              if (!atLineStart) appendNewline();
            } else {
              if (!output.endsWith(' ')) output += ' ';
            }
            appendText('else');
            if (next && next.value === 'if') {
              output += ' ';
            } else if (next && next.type === TokenType.OpenBrace && this.options.braceStyle === 'KR') {
              output += ' ';
            } else if (this.options.braceStyle === 'Allman' && next && next.type === TokenType.OpenBrace) {
              appendNewline();
            } else {
              output += ' ';
            }
            currentLineTokens.push(token);
            continue;
          }

          if (token.value === 'case' || token.value === 'default') {
            if (!atLineStart) appendNewline();
            appendText(token.value);
            if (token.value === 'case') output += ' ';
            currentLineTokens.push(token);
            continue;
          }

          // Space before keyword if preceded by ')' e.g. "(int) x"
          if (prev && prev.value === ')' && !atLineStart && !output.endsWith(' ')) {
            output += ' ';
          }

          appendText(token.value);

          // Space after keyword when followed by identifier or another keyword or number or literal
          if (TYPE_KEYWORDS.has(token.value) || 
              MODIFIER_KEYWORDS.has(token.value) || 
              DECLARATION_KEYWORDS.has(token.value) || 
              STATEMENT_KEYWORDS.has(token.value)) {
            if (next && next.type !== TokenType.Semicolon && next.type !== TokenType.Comma && 
                next.type !== TokenType.CloseParen && next.type !== TokenType.OpenBracket &&
                next.type !== TokenType.OpenBrace && next.type !== TokenType.Question &&
                next.type !== TokenType.Dot && (next.type !== TokenType.Operator || next.value === '<')) {
              if (next.type !== TokenType.Operator || next.value !== '<') {
                output += ' ';
              }
            }
          }

          currentLineTokens.push(token);
          continue;
        }

        // Identifiers, Numbers, Strings, Chars
        if (prev && prev.value === ')' && !atLineStart && !output.endsWith(' ')) {
          output += ' ';
        }

        appendText(token.value);
        currentLineTokens.push(token);

        if (next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
          output += ' ';
        }
      }

      // Step 3: Final cleanup
      output = output
        .split('\n')
        .map(line => line.replace(/[ \t]+$/, ''))
        .join('\n');

      if (!output.endsWith('\n')) {
        output += '\n';
      }

      return output;
    }
  }

  function isUnaryPlusMinus(prev) {
    if (!prev) return true;
    if (BINARY_OPERATORS.has(prev.value) || ASSIGNMENT_OPERATORS.has(prev.value)) return true;
    const unaryPreceders = [
      '(', '[', '{', ',', ';', ':', '!', '?', '=>',
      'return', 'throw', 'case', 'yield'
    ];
    return unaryPreceders.includes(prev.value) || prev.type === 'BlankLineMarker';
  }

  return {
    Formatter,
    DEFAULT_OPTIONS,
    format: (code, options) => new Formatter(options).format(code)
  };
});

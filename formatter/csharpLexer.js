/**
 * C# Lexer / Tokenizer
 * 
 * Tokenizes C# source code into a robust stream of tokens, preserving exact string contents,
 * comments, preprocessor directives, numeric literals, and punctuation.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CSharpLexer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TokenType = {
    Whitespace: 'Whitespace',
    Newline: 'Newline',
    CommentSingle: 'CommentSingle',
    CommentBlock: 'CommentBlock',
    Preprocessor: 'Preprocessor',
    Keyword: 'Keyword',
    Identifier: 'Identifier',
    NumberLiteral: 'NumberLiteral',
    StringLiteral: 'StringLiteral',
    CharLiteral: 'CharLiteral',
    OpenBrace: 'OpenBrace',         // {
    CloseBrace: 'CloseBrace',       // }
    OpenParen: 'OpenParen',         // (
    CloseParen: 'CloseParen',       // )
    OpenBracket: 'OpenBracket',     // [
    CloseBracket: 'CloseBracket',   // ]
    Semicolon: 'Semicolon',         // ;
    Colon: 'Colon',                 // :
    Comma: 'Comma',                 // ,
    Dot: 'Dot',                     // .
    Question: 'Question',           // ?
    Operator: 'Operator',           // +, -, *, /, ==, !=, =>, etc.
    Unknown: 'Unknown'
  };

  const KEYWORDS = new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
    'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
    'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
    'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
    'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
    'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed',
    'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort',
    'using', 'virtual', 'void', 'volatile', 'while',
    // Contextual keywords frequently used in LeetCode algorithms:
    'add', 'alias', 'and', 'ascending', 'async', 'await', 'by', 'descending', 'dynamic',
    'equals', 'from', 'get', 'global', 'group', 'init', 'into', 'join', 'let', 'nameof',
    'nint', 'not', 'notnull', 'nuint', 'on', 'or', 'orderby', 'partial', 'record', 'remove',
    'required', 'scoped', 'select', 'set', 'value', 'var', 'when', 'where', 'with', 'yield'
  ]);

  const MULTI_CHAR_OPERATORS = [
    '>>>=', '<<=', '>>=', '??=', '=>', '==', '!=', '<=', '>=',
    '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=',
    '%=', '&=', '|=', '^='
  ];

  class Token {
    constructor(type, value, line, column, raw) {
      this.type = type;
      this.value = value;
      this.line = line;
      this.column = column;
      this.raw = raw !== undefined ? raw : value;
    }
  }

  class Lexer {
    constructor(source) {
      this.source = source || '';
      this.length = this.source.length;
      this.index = 0;
      this.line = 1;
      this.column = 1;
    }

    peek(offset = 0) {
      const pos = this.index + offset;
      return pos < this.length ? this.source[pos] : '';
    }

    advance(count = 1) {
      for (let i = 0; i < count; i++) {
        if (this.index >= this.length) break;
        const ch = this.source[this.index];
        if (ch === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.index++;
      }
    }

    tokenize() {
      const tokens = [];

      while (this.index < this.length) {
        const startLine = this.line;
        const startCol = this.column;
        const ch = this.source[this.index];

        // 1. Newlines
        if (ch === '\r') {
          if (this.peek(1) === '\n') {
            this.advance(2);
            tokens.push(new Token(TokenType.Newline, '\r\n', startLine, startCol));
          } else {
            this.advance(1);
            tokens.push(new Token(TokenType.Newline, '\r', startLine, startCol));
          }
          continue;
        }
        if (ch === '\n') {
          this.advance(1);
          tokens.push(new Token(TokenType.Newline, '\n', startLine, startCol));
          continue;
        }

        // 2. Whitespace (spaces and tabs)
        if (ch === ' ' || ch === '\t') {
          let ws = '';
          while (this.index < this.length && (this.peek() === ' ' || this.peek() === '\t')) {
            ws += this.peek();
            this.advance(1);
          }
          tokens.push(new Token(TokenType.Whitespace, ws, startLine, startCol));
          continue;
        }

        // 3. Comments or Division operator
        if (ch === '/') {
          const next = this.peek(1);
          if (next === '/') {
            // Single-line comment
            let comment = '';
            while (this.index < this.length && this.peek() !== '\n' && this.peek() !== '\r') {
              comment += this.peek();
              this.advance(1);
            }
            tokens.push(new Token(TokenType.CommentSingle, comment, startLine, startCol));
            continue;
          } else if (next === '*') {
            // Block comment
            let comment = '/*';
            this.advance(2);
            while (this.index < this.length) {
              if (this.peek() === '*' && this.peek(1) === '/') {
                comment += '*/';
                this.advance(2);
                break;
              }
              comment += this.peek();
              this.advance(1);
            }
            tokens.push(new Token(TokenType.CommentBlock, comment, startLine, startCol));
            continue;
          }
        }

        // 4. Preprocessor directives (#if, #region, #nullable, etc.)
        // A preprocessor line starts with '#' when it is the first non-whitespace character on the line
        if (ch === '#') {
          const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
          const isAtLineStart = !prevToken || prevToken.type === TokenType.Newline || 
            (tokens.length >= 2 && tokens[tokens.length - 1].type === TokenType.Whitespace && 
             tokens[tokens.length - 2].type === TokenType.Newline);

          if (isAtLineStart) {
            let directive = '';
            while (this.index < this.length && this.peek() !== '\n' && this.peek() !== '\r') {
              directive += this.peek();
              this.advance(1);
            }
            tokens.push(new Token(TokenType.Preprocessor, directive, startLine, startCol));
            continue;
          }
        }

        // 5. String Literals
        // 5a. Raw string literals: """ ... """ (C# 11+)
        if (this.source.substr(this.index, 3) === '"""') {
          let quoteCount = 0;
          while (this.peek(quoteCount) === '"') quoteCount++;
          const delimiter = '"'.repeat(quoteCount);
          let rawStr = delimiter;
          this.advance(quoteCount);

          while (this.index < this.length) {
            if (this.source.substr(this.index, quoteCount) === delimiter) {
              rawStr += delimiter;
              this.advance(quoteCount);
              break;
            }
            rawStr += this.peek();
            this.advance(1);
          }
          tokens.push(new Token(TokenType.StringLiteral, rawStr, startLine, startCol));
          continue;
        }

        // 5b. Interpolated verbatim string: $@"" or @$""
        if ((ch === '$' && this.peek(1) === '@' && this.peek(2) === '"') ||
            (ch === '@' && this.peek(1) === '$' && this.peek(2) === '"')) {
          const prefix = this.source.substr(this.index, 3);
          let str = prefix;
          this.advance(3);
          while (this.index < this.length) {
            if (this.peek() === '"') {
              if (this.peek(1) === '"') {
                str += '""';
                this.advance(2);
                continue;
              }
              str += '"';
              this.advance(1);
              break;
            }
            str += this.peek();
            this.advance(1);
          }
          tokens.push(new Token(TokenType.StringLiteral, str, startLine, startCol));
          continue;
        }

        // 5c. Verbatim string: @"..."
        if (ch === '@' && this.peek(1) === '"') {
          let str = '@"';
          this.advance(2);
          while (this.index < this.length) {
            if (this.peek() === '"') {
              if (this.peek(1) === '"') {
                str += '""';
                this.advance(2);
                continue;
              }
              str += '"';
              this.advance(1);
              break;
            }
            str += this.peek();
            this.advance(1);
          }
          tokens.push(new Token(TokenType.StringLiteral, str, startLine, startCol));
          continue;
        }

        // 5d. Interpolated string: $"..."
        if (ch === '$' && this.peek(1) === '"') {
          let str = '$"';
          this.advance(2);
          let braceDepth = 0;
          while (this.index < this.length) {
            const c = this.peek();
            if (c === '\\') {
              str += c + this.peek(1);
              this.advance(2);
              continue;
            }
            if (c === '{') {
              if (this.peek(1) === '{') {
                str += '{{';
                this.advance(2);
                continue;
              }
              braceDepth++;
            } else if (c === '}') {
              if (this.peek(1) === '}') {
                str += '}}';
                this.advance(2);
                continue;
              }
              if (braceDepth > 0) braceDepth--;
            } else if (c === '"' && braceDepth === 0) {
              str += '"';
              this.advance(1);
              break;
            }
            str += c;
            this.advance(1);
          }
          tokens.push(new Token(TokenType.StringLiteral, str, startLine, startCol));
          continue;
        }

        // 5e. Regular string: "..."
        if (ch === '"') {
          let str = '"';
          this.advance(1);
          while (this.index < this.length) {
            const c = this.peek();
            if (c === '\\') {
              str += c + this.peek(1);
              this.advance(2);
              continue;
            }
            if (c === '"') {
              str += '"';
              this.advance(1);
              break;
            }
            if (c === '\n' || c === '\r') {
              // Unclosed string literal before newline (error recovery)
              break;
            }
            str += c;
            this.advance(1);
          }
          tokens.push(new Token(TokenType.StringLiteral, str, startLine, startCol));
          continue;
        }

        // 6. Character literal: '...'
        if (ch === '\'') {
          let charVal = '\'';
          this.advance(1);
          while (this.index < this.length) {
            const c = this.peek();
            if (c === '\\') {
              charVal += c + this.peek(1);
              this.advance(2);
              continue;
            }
            if (c === '\'') {
              charVal += '\'';
              this.advance(1);
              break;
            }
            if (c === '\n' || c === '\r') break;
            charVal += c;
            this.advance(1);
          }
          tokens.push(new Token(TokenType.CharLiteral, charVal, startLine, startCol));
          continue;
        }

        // 7. Numbers (integers, hex, binary, floats, decimals)
        if (isDigit(ch) || (ch === '.' && isDigit(this.peek(1)))) {
          let num = '';
          if (ch === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
            // Hex
            num += this.source.substr(this.index, 2);
            this.advance(2);
            while (this.index < this.length && (isHexDigit(this.peek()) || this.peek() === '_')) {
              num += this.peek();
              this.advance(1);
            }
          } else if (ch === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
            // Binary
            num += this.source.substr(this.index, 2);
            this.advance(2);
            while (this.index < this.length && (this.peek() === '0' || this.peek() === '1' || this.peek() === '_')) {
              num += this.peek();
              this.advance(1);
            }
          } else {
            // Decimal / Float
            let hasDot = ch === '.';
            num += ch;
            this.advance(1);
            while (this.index < this.length) {
              const c = this.peek();
              if (c === '.' && !hasDot && isDigit(this.peek(1))) {
                hasDot = true;
                num += c;
                this.advance(1);
              } else if (isDigit(c) || c === '_') {
                num += c;
                this.advance(1);
              } else if (c === 'e' || c === 'E') {
                num += c;
                this.advance(1);
                if (this.peek() === '+' || this.peek() === '-') {
                  num += this.peek();
                  this.advance(1);
                }
                while (isDigit(this.peek()) || this.peek() === '_') {
                  num += this.peek();
                  this.advance(1);
                }
              } else {
                break;
              }
            }
          }
          // Number suffixes: u, l, ul, lu, f, d, m, etc.
          while (this.index < this.length && /[uUlLfFmMdD]/.test(this.peek())) {
            num += this.peek();
            this.advance(1);
          }
          tokens.push(new Token(TokenType.NumberLiteral, num, startLine, startCol));
          continue;
        }

        // 8. Identifiers and Keywords
        if (isIdentifierStart(ch) || (ch === '@' && isIdentifierStart(this.peek(1)))) {
          let id = ch;
          this.advance(1);
          while (this.index < this.length && isIdentifierPart(this.peek())) {
            id += this.peek();
            this.advance(1);
          }
          const cleanId = id.startsWith('@') ? id.substring(1) : id;
          const type = (!id.startsWith('@') && KEYWORDS.has(cleanId)) ? TokenType.Keyword : TokenType.Identifier;
          tokens.push(new Token(type, id, startLine, startCol));
          continue;
        }

        // 9. Single character delimiters
        if (ch === '{') {
          this.advance(1);
          tokens.push(new Token(TokenType.OpenBrace, '{', startLine, startCol));
          continue;
        }
        if (ch === '}') {
          this.advance(1);
          tokens.push(new Token(TokenType.CloseBrace, '}', startLine, startCol));
          continue;
        }
        if (ch === '(') {
          this.advance(1);
          tokens.push(new Token(TokenType.OpenParen, '(', startLine, startCol));
          continue;
        }
        if (ch === ')') {
          this.advance(1);
          tokens.push(new Token(TokenType.CloseParen, ')', startLine, startCol));
          continue;
        }
        if (ch === '[') {
          this.advance(1);
          tokens.push(new Token(TokenType.OpenBracket, '[', startLine, startCol));
          continue;
        }
        if (ch === ']') {
          this.advance(1);
          tokens.push(new Token(TokenType.CloseBracket, ']', startLine, startCol));
          continue;
        }
        if (ch === ';') {
          this.advance(1);
          tokens.push(new Token(TokenType.Semicolon, ';', startLine, startCol));
          continue;
        }
        if (ch === ':') {
          // Check for :: (namespace alias qualifier)
          if (this.peek(1) === ':') {
            this.advance(2);
            tokens.push(new Token(TokenType.Operator, '::', startLine, startCol));
          } else {
            this.advance(1);
            tokens.push(new Token(TokenType.Colon, ':', startLine, startCol));
          }
          continue;
        }
        if (ch === ',') {
          this.advance(1);
          tokens.push(new Token(TokenType.Comma, ',', startLine, startCol));
          continue;
        }
        if (ch === '.') {
          this.advance(1);
          tokens.push(new Token(TokenType.Dot, '.', startLine, startCol));
          continue;
        }
        if (ch === '?') {
          // Check for ??, ??=, ?.
          if (this.peek(1) === '?' && this.peek(2) === '=') {
            this.advance(3);
            tokens.push(new Token(TokenType.Operator, '??=', startLine, startCol));
          } else if (this.peek(1) === '?') {
            this.advance(2);
            tokens.push(new Token(TokenType.Operator, '??', startLine, startCol));
          } else if (this.peek(1) === '.') {
            this.advance(2);
            tokens.push(new Token(TokenType.Operator, '?.', startLine, startCol));
          } else {
            this.advance(1);
            tokens.push(new Token(TokenType.Question, '?', startLine, startCol));
          }
          continue;
        }

        // 10. Multi-character and single-character operators
        let matchedOp = null;
        for (const op of MULTI_CHAR_OPERATORS) {
          if (this.source.substr(this.index, op.length) === op) {
            matchedOp = op;
            break;
          }
        }
        if (matchedOp) {
          this.advance(matchedOp.length);
          tokens.push(new Token(TokenType.Operator, matchedOp, startLine, startCol));
          continue;
        }

        // Single character operators: +, -, *, /, %, =, <, >, !, &, |, ^, ~
        if ('+-*/%=<>!&|^~'.includes(ch)) {
          this.advance(1);
          tokens.push(new Token(TokenType.Operator, ch, startLine, startCol));
          continue;
        }

        // Unknown character fallback
        this.advance(1);
        tokens.push(new Token(TokenType.Unknown, ch, startLine, startCol));
      }

      return tokens;
    }
  }

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function isHexDigit(ch) {
    return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  function isIdentifierStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  function isIdentifierPart(ch) {
    return isIdentifierStart(ch) || isDigit(ch);
  }

  return {
    TokenType,
    Token,
    Lexer,
    tokenize: (src) => new Lexer(src).tokenize()
  };
});

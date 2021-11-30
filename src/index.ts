import { joinRegExp } from 'join-regexp'
import { annotate } from 'annotate-code'
import { createLexer, LexerToken, UnexpectedTokenError } from 'lexer-next'

export type Node = LexerToken | LexerToken[]

const regexp = joinRegExp(
  [
    /(?<ids>[a-z_][a-z0-9_]*)/,
    /(?<num>\d+(\.\d*)?)/,
    /(?<ops>[\[\]\(\)\",\-~+*\/%=<>?!:.|&^@$]{1})/,
    /(?<nul>\s+)/,
    /(?<err>.)/,
  ],
  'gi'
)

const tokenizer = (input: string) => input.matchAll(regexp)

const lexer = createLexer(tokenizer)

export const parse = (input: string) => {
  const { onerror, filter, peek, advance, expect } = lexer(input)

  filter((token: LexerToken) => token.group !== 'nul')

  const panic = (message: string, token: LexerToken) =>
    annotate({
      message: message + ` [${token.group}]: ${token.value}`,
      index: token.index,
      code: input,
    }).message

  onerror((error: Error) => {
    /* istanbul ignore next */
    if (error instanceof UnexpectedTokenError) {
      throw new SyntaxError(
        panic(
          `bad token - expected: [${error.expectedGroup}]`,
          error.currentToken
        )
      )
    } else {
      /* istanbul ignore next */
      throw error
    }
  })

  const expr_bp = (min_bp: number | null): Node => {
    const token = advance()

    let l_bp
    let r_bp

    let lhs
    let mhs
    let rhs

    switch (token.group) {
      case 'ids':
      case 'num':
        lhs = token
        break
      case 'ops':
        if (token.value === '(') {
          lhs = expr_bp(0)
          expect('ops', ')')
          break
        }

        const op = token
        const [, r_bp] = prefix_binding_power(op)
        const rhs = expr_bp(r_bp)
        lhs = [op, rhs]
        break
      default:
        throw new SyntaxError(panic('bad token', token))
    }

    loop: while (true) {
      const token = peek()

      let op
      switch (token.group) {
        case 'eof':
          break loop
        case 'ops':
          op = token
          break
        default:
          throw new SyntaxError(panic('bad token', token))
      }

      ;[l_bp] = postfix_binding_power(op)

      if (l_bp != null) {
        if (l_bp < min_bp!) break
        advance()

        if (op.value === '[') {
          rhs = expr_bp(0)
          expect('ops', ']')
          lhs = [op, lhs, rhs]
        } else {
          lhs = [op, lhs]
        }
        continue
      }

      ;[l_bp, r_bp] = infix_binding_power(op)

      if (l_bp != null || r_bp != null) {
        if (l_bp! < min_bp!) break
        advance()

        if (op.value === '?') {
          mhs = expr_bp(0)
          expect('ops', ':')
          rhs = expr_bp(r_bp)
          lhs = [op, lhs, mhs, rhs]
        } else {
          rhs = expr_bp(r_bp)
          lhs = [op, lhs, rhs]
        }
        continue
      }

      break
    }

    return lhs as LexerToken | LexerToken[]
  }

  const prefix_binding_power = (op: LexerToken) => {
    switch (op.value) {
      case '+':
      case '-':
        return [null, 9]
      default:
        throw new SyntaxError(panic('bad op', op))
    }
  }

  const postfix_binding_power = (op: LexerToken) => {
    switch (op.value) {
      case '!':
      case '[':
        return [11, null]
      default:
        return [null]
    }
  }

  const infix_binding_power = (op: LexerToken) => {
    switch (op.value) {
      case '=':
        return [2, 1]
      case '?':
        return [4, 3]
      case '+':
      case '-':
        return [5, 6]
      case '*':
      case '/':
        return [7, 8]
      case '.':
        return [14, 13]
      default:
        return [null]
    }
  }

  return expr_bp(0)
}

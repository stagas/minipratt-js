import { parse, Node } from '../'

let total = 0

function to_string(node: Node): string {
  total++
  if (total > 1500) {
    throw new Error('Tree too large')
  }

  if (Array.isArray(node)) {
    return '(' + node.map(child => to_string(child)).join(' ') + ')'
  }

  return node.value
}

describe('parse', () => {
  it('parses correctly', () => {
    let s

    s = parse('1')
    expect(to_string(s)).toEqual('1')

    s = parse('+1')
    expect(to_string(s)).toEqual('(+ 1)')

    s = parse('1 + +-1')
    expect(to_string(s)).toEqual('(+ 1 (+ (- 1)))')

    s = parse('1 + 2 * 3')
    expect(to_string(s)).toEqual('(+ 1 (* 2 3))')

    s = parse('a + b * c * d + e')
    expect(to_string(s)).toEqual('(+ (+ a (* (* b c) d)) e)')

    s = parse('f . g . h')
    expect(to_string(s)).toEqual('(. f (. g h))')

    s = parse('1 + 2 + f . g . h * 3 * 4')
    expect(to_string(s)).toEqual('(+ (+ 1 2) (* (* (. f (. g h)) 3) 4))')

    s = parse('--1 * 2')
    expect(to_string(s)).toEqual('(* (- (- 1)) 2)')

    s = parse('--f . g')
    expect(to_string(s)).toEqual('(- (- (. f g)))')

    s = parse('-9!')
    expect(to_string(s)).toEqual('(- (! 9))')

    s = parse('f . g !')
    expect(to_string(s)).toEqual('(! (. f g))')

    s = parse('(((0)))')
    expect(to_string(s)).toEqual('0')

    s = parse('x[0][1]')
    expect(to_string(s)).toEqual('([ ([ x 0) 1)')

    s = parse(`
      a ? b :
      c ? d
      : e
    `)
    expect(to_string(s)).toEqual('(? a b (? c d e))')

    s = parse('a = 0 ? b : c = d')
    expect(to_string(s)).toEqual('(= a (= (? 0 b c) d))')
  })

  it('throws on errors', () => {
    expect(() => parse('%')).toThrow('bad op')
    expect(() => parse('1+%')).toThrow('bad op')
    expect(() => parse("1'")).toThrow('bad token')
    expect(() => parse("'")).toThrow('bad token')
    expect(() => parse('(')).toThrow('bad token')
    expect(() => parse('(1')).toThrow('bad token')
    expect(() => parse('a[')).toThrow('bad token')
    expect(() => parse('a[1')).toThrow('bad token')
    expect(() => parse('')).toThrow('bad token')
  })
})

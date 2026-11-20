import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isJsonEqual } from './is-json-equal.ts'

test('filter values compare by content, including arrays and omitted undefined keys', () => {
  const filters = { query: '200710', group: null, hideCompleted: true, versions: ['1.0', '1.1'] }
  assert.equal(isJsonEqual(filters, { ...filters, versions: ['1.0', '1.1'] }), true)
  assert.equal(isJsonEqual(filters, { ...filters, versions: ['1.0'] }), false)
  assert.equal(isJsonEqual(filters, { ...filters, versions: ['1.1', '1.0'] }), false)
  assert.equal(isJsonEqual(filters, { ...filters, query: '200711' }), false)
  assert.equal(isJsonEqual(filters, { ...filters, group: 2007 }), false)
  assert.equal(isJsonEqual(filters, { ...filters, hideCompleted: false }), false)
  assert.equal(isJsonEqual({ value: undefined }, {}), true)
  assert.equal(isJsonEqual({ nested: { value: undefined } }, { nested: {} }), true)
})

test('JSON equality distinguishes arrays, objects and primitive types and accepts NaN', () => {
  assert.equal(isJsonEqual(NaN, NaN), true)
  assert.equal(isJsonEqual(null, {}), false)
  assert.equal(isJsonEqual([], {}), false)
  assert.equal(isJsonEqual({}, []), false)
  assert.equal(isJsonEqual(1, '1'), false)
})

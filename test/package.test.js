const assert = require('node:assert/strict')
const { test } = require('node:test')

test('package can be required without a DOM or a Vue SFC transform (#61)', () => {
  const component = require('..')
  assert.equal(component.name, 'vueSignature')
  assert.equal(typeof component.render, 'function')
  assert.equal(typeof component.methods.save, 'function')
})

test('compiled component also supports an ES module default import', async () => {
  const { default: component } = await import('../dist/vue-signature.js')
  assert.equal(component.name, 'vueSignature')
  assert.equal(typeof component.render, 'function')
})

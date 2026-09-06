const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

const source = fs.readFileSync(path.join(__dirname, '../src/components/vueSignature.vue'), 'utf8')

function setup(props = {}, { width = 300, height = 150, ratio = 1, observer = true } = {}) {
  const listeners = new Map()
  const images = []
  const pads = []
  const observers = []
  const context = () => ({
    scale() {}, setTransform() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    drawImage(...args) { this.images.push(args) },
    fillText(...args) { this.text.push(args) }, strokeText(...args) { this.text.push(args) },
    images: [], text: []
  })
  const makeCanvas = () => {
    const ctx = context()
    return { width: 300, height: 150, offsetWidth: width, offsetHeight: height,
      getBoundingClientRect: () => ({ width, height }), getContext: () => ctx,
      toDataURL: () => 'data:image/png;base64,saved', style: {} }
  }
  const canvas = makeCanvas()
  const container = { clientWidth: width, clientHeight: height,
    getBoundingClientRect: () => ({ width: container.clientWidth, height: container.clientHeight }) }
  class Pad {
    constructor(element, options) {
      this.canvas = element; this.options = options; this.data = []; this.events = new Map()
      this.onCount = 0; this.offCount = 0; pads.push(this)
    }
    on() { this.onCount++ }
    off() { this.offCount++ }
    clear() { this.data = []; this._isEmpty = true }
    isEmpty() { return this.data.length === 0 && this._isEmpty !== false }
    toData() { return this.data }
    fromData(data) { this.data = data.slice(); this._isEmpty = data.length === 0 }
    toDataURL() { return 'data:image/png;base64,saved' }
    fromDataURL() { this._isEmpty = false; return Promise.resolve() }
    addEventListener(name, fn) { this.events.set(name, fn) }
    removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name) }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe(target) { this.target = target }
    disconnect() { this.disconnected = true }
  }
  class Image {
    constructor() { this.width = 100; this.height = 50; images.push(this) }
    set src(value) { this.url = value }
  }
  const win = { devicePixelRatio: ratio,
    addEventListener(name, fn) { if (typeof fn === 'function') listeners.set(name, fn) },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name) }
  }
  if (observer) win.ResizeObserver = ResizeObserver
  const component = vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import SignaturePad from 'signature_pad'/, '')
    .replace('export default', 'module.exports ='),
  { module: { exports: {} }, SignaturePad: Pad, window: win, Image,
    ResizeObserver: observer ? ResizeObserver : undefined,
    document: { getElementById: () => canvas, createElement: () => makeCanvas() } })
  const instance = { ...component.data(), _uid: 1, $refs: { canvas }, $el: container,
    $emit(name, event) { this.emitted.push([name, event]) }, emitted: [],
    $nextTick(callback) { return Promise.resolve().then(callback) }
  }
  for (const [name, definition] of Object.entries(component.props)) {
    instance[name] = name in props ? props[name] : typeof definition.default === 'function'
      ? definition.default() : definition.default
  }
  for (const [name, method] of Object.entries(component.methods)) instance[name] = method.bind(instance)
  component.created.call(instance)
  return { component, instance, canvas, container, listeners, pads, observers, images, win }
}

test('registers a callable resize listener and keeps draw idempotent', () => {
  const h = setup()
  h.instance.draw()
  assert.equal(typeof h.listeners.get('resize'), 'function')
  h.instance.draw()
  assert.equal(h.pads.length, 1)
  assert.equal(h.pads[0].events.size, 4)
})

test('observes hidden container becoming visible without a window resize (#71, #47, #65)', () => {
  const h = setup({}, { width: 0, height: 0 })
  h.instance.draw()
  assert.equal(h.observers.length, 1)
  h.container.clientWidth = 420
  h.container.clientHeight = 180
  h.canvas.offsetWidth = 420
  h.canvas.offsetHeight = 180
  h.observers[0].callback()
  assert.equal(h.canvas.width, 420)
  assert.equal(h.canvas.height, 180)
})

test('resizes for device pixel ratio and preserves undoable stroke data (#54)', () => {
  const h = setup({}, { ratio: 2 })
  h.instance.draw()
  assert.equal(h.canvas.width, 600)
  assert.equal(h.canvas.height, 300)
  h.instance.sig.data = [{ points: [1] }, { points: [2] }]
  h.container.clientWidth = 400
  h.canvas.offsetWidth = 400
  h.listeners.get('resize')()
  assert.equal(h.canvas.width, 800)
  assert.equal(h.instance.sig.toData().length, 2)
  h.instance.undo()
  assert.equal(h.instance.sig.toData().length, 1)
})

test('clearOnResize clears only when the backing dimensions change', () => {
  const h = setup({ clearOnResize: true })
  h.instance.draw()
  h.instance.sig.data = [{ points: [1] }]
  h.listeners.get('resize')()
  assert.equal(h.instance.isEmpty(), false)
  h.container.clientWidth = 400
  h.canvas.offsetWidth = 400
  h.listeners.get('resize')()
  assert.equal(h.instance.isEmpty(), true)
})

test('destroy releases pad, event forwarding, window listener and observer (#27)', () => {
  const h = setup()
  h.instance.draw()
  const pad = h.instance.sig
  h.component.beforeDestroy.call(h.instance)
  assert.ok(pad.offCount > 0)
  assert.equal(pad.events.size, 0)
  assert.equal(h.listeners.size, 0)
  assert.equal(h.observers[0].disconnected, true)
})

test('supports resize fallback and disabled transitions', () => {
  const h = setup({ disabled: true }, { observer: false })
  h.component.watch.disabled.call(h.instance, true)
  h.instance.draw()
  assert.ok(h.instance.sig.offCount > 0)
  h.component.watch.disabled.call(h.instance, false)
  assert.ok(h.instance.sig.onCount > 0)
  assert.equal(typeof h.listeners.get('resize'), 'function')
})

test('watermarks accept zero coordinates and preserve canvas styles', () => {
  const h = setup()
  h.instance.draw()
  h.instance.addWaterMark({ text: 'zero', x: 0, y: 0, sx: 0, sy: 0, style: 'all' })
  assert.deepEqual(h.canvas.getContext('2d').text.slice(-2), [['zero', 0, 0], ['zero', 0, 0]])
  assert.equal(h.instance.isEmpty(), false)
  h.instance.clear()
  assert.equal(h.instance.isEmpty(), true)
})

test('image loading returns a promise and accepts SVG data URLs (#73)', async () => {
  const h = setup()
  h.instance.draw()
  const pending = h.instance.fromDataURL('data:image/svg+xml;base64,PHN2Zy8+')
  assert.equal(typeof pending.then, 'function')
  if (h.images[0]) h.images[0].onload()
  await pending
  assert.equal(h.instance.isEmpty(), false)
})

test('clear cancels pending images so they cannot reappear later', async () => {
  const h = setup()
  h.instance.draw()
  const pending = h.instance.fromDataURL('data:image/png;base64,saved')
  h.instance.clear()
  if (h.images[0]) h.images[0].onload()
  await pending
  assert.equal(h.instance.isEmpty(), true)
})

test('hidden imports use the first measured size, including clearOnResize and high DPI', async () => {
  const h = setup({ clearOnResize: true }, { width: 0, height: 0, ratio: 2 })
  h.instance.draw()
  const pending = h.instance.fromDataURL('data:image/svg+xml;base64,PHN2Zy8+')
  h.images[0].onload()
  await pending
  h.container.clientWidth = 400
  h.container.clientHeight = 200
  h.canvas.offsetWidth = 400
  h.canvas.offsetHeight = 200
  h.observers[0].callback()
  const draw = h.canvas.getContext('2d').images.at(-1)
  assert.deepEqual(draw.slice(1), [0, 0, 400, 200])
  assert.equal(h.instance.isEmpty(), false)
})

test('canvas uses its own displayed size when the root includes padding', () => {
  const h = setup()
  h.container.clientWidth = 340
  h.container.clientHeight = 190
  h.instance.draw()
  assert.equal(h.canvas.width, 300)
  assert.equal(h.canvas.height, 150)
  assert.equal(h.observers[0].target, h.canvas)
})

test('destroy before the mounted next tick does not initialize a pad', async () => {
  const h = setup()
  h.component.mounted.call(h.instance)
  h.component.beforeDestroy.call(h.instance)
  await Promise.resolve()
  assert.equal(h.pads.length, 0)
})

test('newer imports win and failed loads reject without changing the canvas', async () => {
  const h = setup()
  h.instance.draw()
  const first = h.instance.fromDataURL('first')
  const second = h.instance.fromDataURL('second', { width: 80, height: 40, xOffset: 0, yOffset: 10 })
  h.images[1].onload()
  await second
  h.images[0].onload()
  await first
  assert.equal(h.canvas.getContext('2d').images.at(-1)[0].url, 'second')
  assert.deepEqual(h.canvas.getContext('2d').images.at(-1).slice(1), [0, 10, 80, 40])
  const failed = h.instance.fromDataURL('invalid')
  h.images[2].onerror()
  await assert.rejects(failed, /Could not load signature image/)
  assert.equal(h.instance.isEmpty(), false)
})

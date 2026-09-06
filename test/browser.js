/* global Vue, vueSignature */
;(async function () {
  const results = document.getElementById('results')
  const fixtures = document.getElementById('fixtures')
  const mounted = []
  let failed = 0
  let passed = 0
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const mount = async (props = {}, hidden = false) => {
    const host = document.createElement('div')
    host.style.cssText = 'width: 300px; height: 150px;'
    if (hidden) host.style.display = 'none'
    fixtures.appendChild(host)
    const component = new (Vue.extend(vueSignature))({ propsData: props })
    host.appendChild(component.$mount().$el)
    mounted.push(component)
    await Vue.nextTick()
    await frame()
    return { component, host, canvas: component.$refs.canvas }
  }
  const stroke = (x = 10) => ({
    penColor: '#000', dotSize: 2, minWidth: 1, maxWidth: 3, velocityFilterWeight: 0.7,
    compositeOperation: 'source-over',
    points: [
      { x, y: 20, time: 1, pressure: 0.5 },
      { x: x + 10, y: 25, time: 20, pressure: 0.5 },
      { x: x + 20, y: 35, time: 40, pressure: 0.5 },
      { x: x + 30, y: 40, time: 60, pressure: 0.5 }
    ]
  })
  const pixel = (canvas, x, y) => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    return canvas.getContext('2d').getImageData(Math.floor(x * ratio), Math.floor(y * ratio), 1, 1).data
  }
  const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect x="10" y="10" width="50" height="50" fill="red"/></svg>')
  const run = async (name, fn) => {
    const item = document.createElement('li')
    try { await fn(); passed++; item.textContent = 'PASS: ' + name }
    catch (error) { failed++; item.textContent = 'FAIL: ' + name + ': ' + error.message }
    results.appendChild(item)
  }

  await run('Hidden modal becomes measurable without window resize (#71, #47, #65)', async () => {
    const { host, canvas } = await mount({}, true)
    host.style.display = 'block'
    await frame()
    assert(canvas.width === Math.round(300 * devicePixelRatio), 'wrong backing width after show')
    assert(canvas.height === Math.round(150 * devicePixelRatio), 'wrong backing height after show')
  })
  await run('Pixel ratio affects bitmap only; resize preserves strokes and undo (#54)', async () => {
    const { component, host, canvas } = await mount()
    component.sig.fromData([stroke(), stroke(70)])
    const before = component.save('image/svg+xml')
    host.style.width = '400px'
    await frame()
    assert(canvas.offsetWidth === 400, 'CSS width changed with pixel ratio')
    assert(canvas.width === Math.round(400 * devicePixelRatio), 'bitmap width not updated')
    assert(component.sig.toData().length === 2, 'resize lost strokes')
    assert(before.includes('data:image/svg+xml'), 'SVG export missing')
    component.undo()
    assert(component.sig.toData().length === 1, 'undo lost point history')
    component.undo()
    assert(component.isEmpty(), 'undo did not clear last stroke')
  })
  await run('SVG import survives resize and undo of new strokes (#73)', async () => {
    const { component, host, canvas } = await mount()
    await component.fromDataURL(svg)
    assert(!component.isEmpty(), 'loaded image considered empty')
    assert(pixel(canvas, 20, 20)[0] === 255 && pixel(canvas, 20, 20)[1] === 0, 'SVG not painted red')
    host.style.width = '400px'
    await frame()
    component.sig.fromData([stroke(90)], { clear: false })
    component.undo()
    assert(pixel(canvas, 20, 20)[1] === 0, 'resize or undo erased imported image')
    component.clear()
    assert(component.isEmpty(), 'clear retained imported image')
  })
  await run('Hidden SVG import uses first visible dimensions, even with clearOnResize', async () => {
    const { component, host, canvas } = await mount({ clearOnResize: true }, true)
    await component.fromDataURL(svg)
    host.style.width = '600px'
    host.style.height = '300px'
    host.style.display = 'block'
    await frame()
    assert(!component.isEmpty(), 'first visible layout cleared imported image')
    assert(pixel(canvas, 90, 90)[1] === 0, 'image used hidden default canvas dimensions')
  })
  await run('Clear and destroy cancel pending imports; image errors reject', async () => {
    const { component } = await mount()
    const pending = component.fromDataURL(svg)
    component.clear()
    await pending
    assert(component.isEmpty(), 'stale image repainted after clear')
    let rejected = false
    try { await component.fromDataURL('data:image/png;base64,invalid') } catch (_) { rejected = true }
    assert(rejected, 'invalid image did not reject')
    const destroyed = component.fromDataURL(svg)
    component.$destroy()
    await destroyed
  })
  await run('Repeated draw keeps one instance; destroy removes forwarded events (#27)', async () => {
    const { component } = await mount()
    const pad = component.sig
    component.draw()
    assert(component.sig === pad, 'draw replaced SignaturePad')
    let forwarded = 0
    component.$on('endStroke', () => forwarded++)
    pad.dispatchEvent(new CustomEvent('endStroke'))
    assert(forwarded === 1, 'event forwarding duplicated')
    component.$destroy()
    pad.dispatchEvent(new CustomEvent('endStroke'))
    assert(forwarded === 1, 'event forwarded after destroy')
  })
  await run('Pen options pass through; watermarks keep zero coordinates and drawing style (#59)', async () => {
    const { component, canvas } = await mount({ sigOption: { minWidth: 2, maxWidth: 4 } })
    assert(component.sig.minWidth === 2 && component.sig.maxWidth === 4, 'pen widths ignored')
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#00ff00'
    component.addWaterMark({ text: 'mark', x: 0, y: 20, fillStyle: '#ff0000' })
    assert(ctx.fillStyle === '#00ff00', 'watermark leaked canvas styles')
    assert(!component.isEmpty(), 'watermark considered empty')
    component.clear()
    assert(component.isEmpty(), 'watermark not cleared')
  })
  await run('clearOnResize ignores unchanged dimensions and clears actual resize', async () => {
    const { component, host } = await mount({ clearOnResize: true })
    component.sig.fromData([stroke()])
    window.dispatchEvent(new Event('resize'))
    assert(!component.isEmpty(), 'unchanged resize erased strokes')
    host.style.width = '400px'
    await frame()
    assert(component.isEmpty(), 'changed resize kept strokes')
  })
  await run('Unrelated canvas keeps its intrinsic size', async () => {
    const canvas = document.createElement('canvas')
    fixtures.appendChild(canvas)
    assert(canvas.offsetWidth === 300 && canvas.offsetHeight === 150, 'global canvas CSS leaked')
  })
  await run('Multiple signature pads draw and clear independently (#74)', async () => {
    const first = await mount()
    const second = await mount()
    first.component.sig.fromData([stroke()])
    second.component.sig.fromData([stroke(70)])
    assert(first.component.sig.canvas === first.canvas, 'first pad bound to another canvas')
    assert(second.component.sig.canvas === second.canvas, 'second pad bound to another canvas')
    first.component.clear()
    assert(first.component.isEmpty(), 'first pad did not clear')
    assert(!second.component.isEmpty(), 'clearing first pad erased the second')
    assert(pixel(second.canvas, 80, 25)[0] < 255, 'second pad did not render')
  })
  await run('SSR hydration initializes the retained canvas through its ref (#74)', async () => {
    const host = document.createElement('div')
    host.style.cssText = 'width: 300px; height: 150px;'
    const serverRoot = document.createElement('div')
    serverRoot.setAttribute('data-server-rendered', 'true')
    serverRoot.style.cssText = 'width: 100%; height: 100%;'
    serverRoot.innerHTML = '<canvas id="server-canvas" class="canvas" data-uid="server-canvas" style="display: block; width: 100%; height: 100%;"></canvas>'
    const serverCanvas = serverRoot.firstChild
    host.appendChild(serverRoot)
    fixtures.appendChild(host)
    const component = new (Vue.extend(vueSignature))()
    mounted.push(component)
    assert(serverCanvas.id !== component.uid, 'test did not start with differing server/client IDs')
    component.$mount(serverRoot, true)
    await Vue.nextTick()
    await frame()
    assert(component.$refs.canvas === serverCanvas, 'hydration replaced server canvas')
    assert(component.sig.canvas === serverCanvas, 'pad did not bind the hydrated canvas')
    component.sig.fromData([stroke()])
    assert(!component.isEmpty(), 'hydrated pad cannot draw')
  })
  await run('Padded component keeps pointer and bitmap coordinates aligned', async () => {
    const { component, canvas } = await mount()
    component.$el.style.padding = '20px'
    await frame()
    assert(canvas.width === Math.round(canvas.offsetWidth * devicePixelRatio), 'root padding enlarged bitmap')
    const rect = canvas.getBoundingClientRect()
    const input = { pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true,
      clientX: rect.left + 100, clientY: rect.top + 50, button: 0 }
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...input, buttons: 1 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...input, buttons: 0 }))
    assert(!component.isEmpty(), 'pointer input did not draw')
    assert(pixel(canvas, 100, 50)[0] < 100, 'dot missed pointer location')
    component.clear()
    component.disabled = true
    await Vue.nextTick()
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...input, buttons: 1 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...input, buttons: 0 }))
    assert(component.isEmpty(), 'disabled component accepted pointer input')
  })
  mounted.forEach(component => { if (!component._isDestroyed) component.$destroy() })
  fixtures.remove()
  document.getElementById('status').textContent = passed + ' passed, ' + failed + ' failed'
})()

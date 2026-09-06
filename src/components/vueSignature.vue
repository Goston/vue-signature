<template>
	<div :style="{ width: w, height: h }" @touchmove.prevent>
		<canvas ref="canvas" :id="uid" class="canvas" :data-uid="uid" :disabled="disabled"
			style="display: block; width: 100%; height: 100%;"></canvas>
	</div>
</template>

<script>
import SignaturePad from 'signature_pad'

export default {
	name: 'vueSignature',
	props: {
		sigOption: {
			type: Object,
			default: () => ({ backgroundColor: 'rgb(255,255,255)', penColor: 'rgb(0, 0, 0)' })
		},
		w: { type: String, default: '100%' },
		h: { type: String, default: '100%' },
		clearOnResize: { type: Boolean, default: false },
		waterMark: { type: Object, default: () => ({}) },
		disabled: { type: Boolean, default: false },
		defaultUrl: { type: String, default: '' }
	},
	data() {
		return { sig: null, option: {}, uid: '' }
	},
	watch: {
		disabled(value) {
			if (this.sig) this.sig[value ? 'off' : 'on']()
		},
		w() { this.$nextTick(this.resizeCanvas) },
		h() { this.$nextTick(this.resizeCanvas) }
	},
	created() {
		this.uid = 'canvas' + this._uid
		this.option = Object.assign({
			backgroundColor: 'rgb(255,255,255)', penColor: 'rgb(0, 0, 0)'
		}, this.sigOption)
		this._strokeListeners = []
		this._waterMarks = []
		this._backgroundImage = null
		this._imageRequest = 0
		this._disposed = false
	},
	methods: {
		draw() {
			if (this._disposed) return
			if (this.sig) {
				this.resizeCanvas()
				return
			}
			this.sig = new SignaturePad(this.$refs.canvas, this.option)
			this.attachEventListeners()
			window.addEventListener('resize', this.resizeCanvas)
			if (window.ResizeObserver) {
				this._resizeObserver = new window.ResizeObserver(this.resizeCanvas)
				this._resizeObserver.observe(this.$refs.canvas)
			}
			if (Object.keys(this.waterMark).length) this._waterMarks.push(this.waterMark)
			this.resizeCanvas()
			if (this.defaultUrl) {
				this.fromDataURL(this.defaultUrl).catch(error => {
					if (!this._disposed) this.$emit('error', error)
				})
			}
			if (this.disabled) this.sig.off()
		},
		resizeCanvas() {
			if (!this.sig || this._disposed) return
			const canvas = this.$refs.canvas
			const width = canvas.offsetWidth
			const height = canvas.offsetHeight
			// Hidden containers must keep their existing bitmap and stroke history.
			if (!width || !height) return
			const ratio = Math.max(window.devicePixelRatio || 1, 1)
			const pixelWidth = Math.round(width * ratio)
			const pixelHeight = Math.round(height * ratio)
			if (canvas.width === pixelWidth && canvas.height === pixelHeight && this._canvasRatio === ratio) return
			const shouldClear = this.clearOnResize && this._canvasRatio !== undefined
			const data = shouldClear ? [] : this.sig.toData()
			if (shouldClear) {
				this._backgroundImage = null
				this._imageRequest++
				this._waterMarks = Object.keys(this.waterMark).length ? [this.waterMark] : []
			}
			canvas.width = pixelWidth
			canvas.height = pixelHeight
			canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0)
			this._canvasRatio = ratio
			this.redraw(data)
		},
		redraw(data) {
			this.sig.clear()
			const background = this._backgroundImage
			if (background && this._canvasRatio !== undefined) {
				const canvas = this.$refs.canvas
				const ratio = background.ratio || this._canvasRatio
				// Defer default image bounds until a hidden container has a real size.
				if (background.width === undefined) background.width = canvas.width / ratio
				if (background.height === undefined) background.height = canvas.height / ratio
				canvas.getContext('2d').drawImage(background.image,
					background.x, background.y, background.width, background.height)
			}
			// Keep point data, so undo and SVG export still work after a resize.
			this.sig.fromData(data, { clear: false })
			this._waterMarks.forEach(mark => this.paintWaterMark(mark))
		},
		clear() {
			this._imageRequest++
			this._backgroundImage = null
			this._waterMarks = []
			if (this.sig) this.sig.clear()
		},
		save(format) {
			return this.sig.toDataURL(format)
		},
		fromDataURL(url, options = {}) {
			const request = ++this._imageRequest
			return new Promise((resolve, reject) => {
				const image = new Image()
				image.crossOrigin = 'anonymous'
				image.onload = () => {
					if (this._disposed || request !== this._imageRequest) return resolve()
					this._backgroundImage = {
						image,
						ratio: options.ratio,
						width: options.width,
						height: options.height,
						x: options.xOffset || 0,
						y: options.yOffset || 0
					}
					this.redraw(this.sig.toData())
					resolve()
				}
				image.onerror = () => {
					if (this._disposed || request !== this._imageRequest) return resolve()
					reject(new Error('Could not load signature image'))
				}
				image.src = url
			})
		},
		isEmpty() {
			return !this._backgroundImage && !this._waterMarks.length && (!this.sig || this.sig.isEmpty())
		},
		undo() {
			const data = this.sig.toData().slice()
			if (data.length) {
				data.pop()
				this.redraw(data)
			}
		},
		addWaterMark(data) {
			if (Object.prototype.toString.call(data) !== '[object Object]') {
				throw new Error('Expected Object, got ' + typeof data + '.')
			}
			this._waterMarks.push(Object.assign({}, data))
			this.paintWaterMark(data)
		},
		paintWaterMark(data) {
			const ctx = this.$refs.canvas.getContext('2d')
			ctx.save()
			ctx.font = data.font || '20px sans-serif'
			ctx.fillStyle = data.fillStyle || '#333'
			ctx.strokeStyle = data.strokeStyle || '#333'
			const text = data.text || ''
			if (data.style !== 'stroke') {
				ctx.fillText(text, data.x === undefined ? 20 : data.x, data.y === undefined ? 20 : data.y)
			}
			if (data.style === 'all' || data.style === 'stroke') {
				ctx.strokeText(text, data.sx === undefined ? 40 : data.sx, data.sy === undefined ? 40 : data.sy)
			}
			ctx.restore()
		},
		attachEventListeners() {
			const events = ['beginStroke', 'endStroke', 'beforeUpdateStroke', 'afterUpdateStroke']
			events.forEach(name => {
				const listener = event => this.$emit(name, event)
				this.sig.addEventListener(name, listener)
				this._strokeListeners.push({ name, listener })
			})
		}
	},
	mounted() {
		this.$nextTick(this.draw)
	},
	beforeDestroy() {
		this._disposed = true
		this._imageRequest++
		window.removeEventListener('resize', this.resizeCanvas)
		if (this._resizeObserver) this._resizeObserver.disconnect()
		if (this.sig) {
			this.sig.off()
			this._strokeListeners.forEach(({ name, listener }) => this.sig.removeEventListener(name, listener))
		}
		this._strokeListeners = []
		this._backgroundImage = null
		this._waterMarks = []
		this.sig = null
	}
}
</script>

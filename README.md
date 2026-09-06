# vue-signature

> A electronic signature component by Vue.js

## For Vue 3

[vue3-signature](https://github.com/WangShayne/vue3-signature)

## Reference and Thanks

[signature_pad](https://github.com/szimek/signature_pad)

## API

---

### Props

> w,h need units,like 100px or 100%

|     name      |   type    |                            default                            |            description             |
| :-----------: | :-------: | :-----------------------------------------------------------: | :--------------------------------: |
|   sigOption   | `Object`  | {penColor:"rgb(0, 0, 0)", backgroundColor:"rgb(255,255,255)"} | SignaturePad constructor options, including minWidth and maxWidth |
|       w       | `String`  |                            "100%"                             |       parent container width       |
|       h       | `String`  |                            "100%"                             |      parent container height       |
| clearOnResize | `Boolean` |                             false                             | Clear when canvas size or pixel ratio changes |
|   waterMark   | `Object`  |                              {}                               |      check Usage addWaterMark      |
|   disabled    | `Boolean` |                             false                             |              disabled              |
|  defaultUrl   | `String`  |                              ""                               |   you want show image by default   |

### Methods

|     name     |               params                |                       description                        |
| :----------: | :---------------------------------: | :------------------------------------------------------: |
|     save     | ()/("image/jpeg")/("image/svg+xml") |                save image as PNG/JPEG/SVG                |
|    clear     |                                     |                       clear canvas                       |
|   isEmpty    |                                     | Returns true if canvas is empty, otherwise returns false |
|     undo     |                                     |               remove the last dot or line                |
| addWaterMark |   {} // check Usage addWaterMark    |                       addWaterMark                       |
| fromDataURL  |            (url, options?)          | Load a PNG/JPEG/SVG image; returns a Promise. |
|     draw     |                                     | Initialize once, then refresh the canvas size. |

### Events

The components emits the following events:

`beginStroke` - Triggered before stroke begins.

`endStroke` - Triggered after stroke ends.

`beforeUpdateStroke` - Triggered before stroke update.

`afterUpdateStroke` - Triggered after stroke update.

`error` - An image supplied through `defaultUrl` failed to load. Calls to
`fromDataURL()` reject their returned promise instead.

### Sizing and hidden containers

Percentage sizes need a parent with a measurable width and height. For example:

```vue
<div style="width: 100%; height: 200px">
  <vueSignature ref="signature" />
</div>
```

The component observes its container, including when a modal or Ionic view becomes
visible. Browsers without `ResizeObserver` still handle window resize events; call
`this.$refs.signature.draw()` after showing the container on those browsers.
Repeated `draw()` calls reuse the same signature pad and event listeners.

The canvas bitmap is multiplied by `devicePixelRatio` for sharp rendering. A
400px-wide canvas may have `width="800"` on a Retina screen, including Safari;
its displayed width remains 400 CSS pixels. With `clearOnResize: false`, strokes
keep their original coordinates and remain undoable. A smaller canvas clips the
visible area; it does not scale the signature to fit. Hidden, zero-size containers
do not clear existing content.

### Pen thickness

Set `sigOption.minWidth` and `sigOption.maxWidth` when creating the component.
Set both to the same number for a constant-width pen:

```js
option: { penColor: '#000', minWidth: 2, maxWidth: 2 }
```

These options are read at initialization. To change thickness on an existing pad,
set `this.$refs.signature.sig.minWidth` and `.maxWidth`.

### Restoring a saved SVG

`save('image/svg+xml')` returns an SVG data URL that can be loaded directly:

```js
const svgUrl = this.$refs.signature.save('image/svg+xml')
await this.$refs.signature.fromDataURL(svgUrl)
```

For raw SVG markup, create a data URL first:

```js
await this.$refs.signature.fromDataURL(
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup)
)
```

Optional `ratio`, `width`, `height`, `xOffset`, and `yOffset` control image placement.
Await loading before saving. Remote image URLs require the image server to allow
cross-origin access. Imported images are a background layer; they survive resize
and undoing newly drawn strokes. Loading another image replaces that background.
`clear()` removes images, strokes, and watermarks and cancels pending imports.
Destroying the component also cancels pending imports.

Imported images and watermarks contain no editable stroke data. PNG/JPEG export
includes them; SVG export contains the pen strokes recorded by SignaturePad.

### Jest and CommonJS

The package entry is a compiled UMD component, usable through either
`import vueSignature from 'vue-signature'` or `require('vue-signature')`.
It can be imported without a browser DOM or a `.vue` transform. Mounting the
component in Jest still needs a DOM environment and a canvas mock.
The source component remains available at `vue-signature/src/components/vueSignature.vue`
for applications that intentionally compile dependencies themselves.

## Usage

---

```bash
npm install vue-signature
```

A.vue

```vue
<template>
  <div id="app">
    <vueSignature
      ref="signature"
      :sigOption="option"
      :w="'800px'"
      :h="'400px'"
      :disabled="disabled"
      :defaultUrl="dataUrl"
    ></vueSignature>
    <vueSignature ref="signature1" :sigOption="option"></vueSignature>
    <button @click="save">Save</button>
    <button @click="clear">Clear</button>
    <button @click="undo">Undo</button>
    <button @click="addWaterMark">addWaterMark</button>
    <button @click="handleDisabled">disabled</button>
  </div>
</template>

<script>
import vueSignature from "vue-signature";
export default {
  name: "app",
  components: {
    vueSignature,
  },
  data() {
    return {
      option: {
        penColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255,255,255)",
      },
      disabled: false,
      dataUrl: "https://avatars2.githubusercontent.com/u/17644818?s=460&v=4",
    };
  },
  methods: {
    save() {
      var _this = this;
      var png = _this.$refs.signature.save();
      var jpeg = _this.$refs.signature.save("image/jpeg");
      var svg = _this.$refs.signature.save("image/svg+xml");
      console.log(png);
      console.log(jpeg);
      console.log(svg);
    },
    clear() {
      var _this = this;
      _this.$refs.signature.clear();
    },
    undo() {
      var _this = this;
      _this.$refs.signature.undo();
    },
    addWaterMark() {
      var _this = this;
      _this.$refs.signature.addWaterMark({
        text: "mark text", // watermark text, > default ''
        font: "20px Arial", // mark font, > default '20px sans-serif'
        style: "all", // fillText and strokeText,  'all'/'stroke'/'fill', > default 'fill
        fillStyle: "red", // fillcolor, > default '#333'
        strokeStyle: "blue", // strokecolor, > default '#333'
        x: 100, // fill positionX, > default 20
        y: 200, // fill positionY, > default 20
        sx: 100, // stroke positionX, > default 40
        sy: 200, // stroke positionY, > default 40
      });
    },
    fromDataURL(url) {
      return this.$refs.signature.fromDataURL(url);
    },
    handleDisabled() {
      var _this = this;
      _this.disabled = !_this.disabled;
    },
  },
};
</script>
```

## Development

Use Node.js 18.12 or newer and npm. The repository uses `package-lock.json` as its
dependency lock; the obsolete Yarn lock was removed during the build update.

```bash
npm ci
npm test
npm run dev
```

`npm test` builds the production library and runs component and CommonJS regression
tests. The local demo supports drawing, resize, undo, PNG export and SVG import.
Open `/test/browser.html` on the development server for real Vue/Canvas regression
tests. `npm run build` writes `dist/vue-signature.js`; `npm pack` rebuilds it before
packaging. The UMD browser global is `vueSignature`.

## License

---

Released under the [MIT License](https://opensource.org/licenses/MIT).



[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")

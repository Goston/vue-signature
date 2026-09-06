const path = require('path')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = {
  entry: './src/main.js',
  context: __dirname,
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.vue$/, use: 'vue-loader' }
    ]
  },
  plugins: [new VueLoaderPlugin()],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'vue-signature.js',
    library: { name: 'vueSignature', type: 'umd', export: 'default' },
    globalObject: 'typeof self !== "undefined" ? self : this',
    clean: true
  },
  devServer: {
    static: [
      { directory: __dirname },
      { directory: path.resolve(__dirname, 'node_modules/vue/dist'), publicPath: '/vendor/vue' }
    ],
    devMiddleware: { publicPath: '/dist/' }
  }
}

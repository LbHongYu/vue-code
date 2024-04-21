
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
// const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const tsImportPlugin = require('ts-import-plugin');
const resourceRules = require('./resource-rules');

module.exports =  () => {
  return {
    mode: 'development',

    devtool: 'eval-cheap-source-map',

    stats: 'errors-only',
    // 在初始构建之后，webpack 将继续监听任何已解析文件的更改
    watch: true,

    watchOptions: {
      // 时间内进行的任何其他更改都聚合到一次重新构建里。以毫秒为单位
      aggregateTimeout: 600,
      // 被排除监听的文件
      ignored: ['**/node_modules'], 
    },

    entry: {
      index: path.resolve(__dirname, '../src/main.ts'),
    },
  
    output: {
      publicPath: '/vue-code/',
      path: path.resolve(__dirname, '../vue-code'),
      filename:  '[name].[contenthash].js',
    },
  
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
      alias: {
        '@': path.resolve(__dirname, '../src'),
        // 'assets': path.resolve(__dirname, './src/assets')
      }
    },
  
    module: {
      rules: [
        ...resourceRules,
        { 
          test: /\.([cm]?ts|tsx)$/, 
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {
            appendTsSuffixTo: [/.vue$/],
            transpileOnly: true,
            getCustomTransformers: () => ({
              before: [tsImportPlugin({
                libraryName: 'vant',
                libraryDirectory: 'es',
                style: true,
                camel2DashComponentName: true,
              })]
            }),
            compilerOptions: {
              module: 'es2015'
            }
          },
        },

      ]
    },
    devServer: {
      // contentBase: './webpack-vue',
      // NOTE:
      // hot: true，从 webpack-dev-server v4 开始，HMR 是默认启用的。
      // 它会自动应用 webpack.HotModuleReplacementPlugin，这是启用 HMR 所必需的。
      // 因此当 hot 设置为 true 或者通过 CLI 设置 --hot，你不需要在你的 webpack.config.js 添加该插件。
      hot: true,

      // 在服务器已经启动后打开浏览器
      open: true,
      
      port: 6060,
      
      // 启用 gzip compression
      compress: true, 
      
      client: {
        // 当出现编译错误或警告时，在浏览器中显示全屏覆盖
        overlay: { // 只想显示错误信息
          errors: true,
          warnings: false,
        }, 
      },

      // 使用的是 http-proxy-middleware 
      proxy: { 
        '/api': 'http://localhost:3000',
      },
    },
    plugins: [
      // new FriendlyErrorsWebpackPlugin(),
      new CleanWebpackPlugin(),
      new webpack.ProgressPlugin(),
  
      // NOTE: 这个插件是必须的！ 它的职责是将你定义过的其它规则复制并应用到 .vue 文件里相应语言的块。
      //       例如，如果你有一条匹配 /\.js$/ 的规则，那么它会应用到 .vue 文件里的 <script> 块。
      new VueLoaderPlugin(),
  
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, '../index.html'),
      }),
      // new webpack.HotModuleReplacementPlugin()
    ]
  }

};
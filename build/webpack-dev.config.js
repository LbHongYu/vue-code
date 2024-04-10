
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
// const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const tsImportPlugin = require('ts-import-plugin');

module.exports =  (...args) => {
  return {
    // watch: true,
    mode: 'development',
    devtool: 'eval-cheap-source-map',
    stats: 'errors-only',
    entry: {
      index: path.resolve(__dirname, './src/main.ts'),
    },
  
    output: {
      publicPath: '/w-hrms-mobile/',
      path: path.resolve(__dirname, './w-hrms-mobile'),
      filename: '[name]-[hash].js'
    },
  
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // 'assets': path.resolve(__dirname, './src/assets')
      }
    },
  
    module: {
      rules: [
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
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: ['cache-loader', 'thread-loader', 'babel-loader']
        }, {
          test: /\.s[ac]ss$/i,
          use: [
            'vue-style-loader',
            'css-loader',
            'postcss-loader',
            'sass-loader',
            {
              loader: 'style-resources-loader', // 如果使用了variables , mixins , functions 等功能，必须添加这个插件
              options: {
                patterns: path.resolve(__dirname, './src/assets/scss/file.scss') // 使用 variables , mixins , functions 等功能的文件
              }
            }
          ]
        },
  
        {
          test: /\.css$/i,
          // exclude: /node_modules/,
          use: [
            'style-loader',
            'css-loader'
          ]
        },
  
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          exclude: /node_modules/,
          type: 'asset/resource',
          generator: {
            filename: 'img/[hash][ext][query]'
          }
        },
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
          exclude: /node_modules/,
          type: 'asset/resource',
          generator: {
            filename: 'media/[hash][ext][query]'
          }
        },
  
        {
          test: /\.(woff2?|woff|svg|eot|ttf|otf)(\?.*)?$/i,
          exclude: /node_modules/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[hash][ext][query]'
          }
        },
        {
          test: /\.vue$/,
          exclude: /node_modules/,
          use: ['vue-loader']
        }
      ]
    },
    devServer: {
      // contentBase: './webpack-vue',
      // NOTE:
      // hot: true，启用 webpack 的 Hot Module Replacement 功能，
      // 也可以在 plugins 数组中引入 HotModuleReplacementPlugin
      hot: true,
      port: 9527,
  
      proxy: {
      }    
    },
    plugins: [
      // new FriendlyErrorsWebpackPlugin(),
      new CleanWebpackPlugin(),
      new webpack.ProgressPlugin(),
  
      // NOTE: 这个插件是必须的！ 它的职责是将你定义过的其它规则复制并应用到 .vue 文件里相应语言的块。
      //       例如，如果你有一条匹配 /\.js$/ 的规则，那么它会应用到 .vue 文件里的 <script> 块。
      new VueLoaderPlugin(),
  
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, './index.html'),
      }),
      // new webpack.HotModuleReplacementPlugin()
    ]
  }

};
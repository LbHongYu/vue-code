
/**
  * webpack.prod.js
  *
  * 正式环境的打包配置
  *
  *
*/

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const PreloadPlugin = require('@vue/preload-webpack-plugin')

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin');
// const HardSourcePlugin = require('hard-source-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const tsImportPlugin = require('ts-import-plugin');

module.exports =  {
  mode: 'production',

  devtool: 'source-map',

  stats: 'errors-only',

  entry: {
    index: path.resolve(__dirname, './src/main.ts'),
  },

  output: {
    publicPath: '/w-hrms-mobile/',
    path: path.resolve(__dirname, './w-hrms-mobile'),
    filename: 'js/[name].js'
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
      }, 
      {
        test: /\.s[ac]ss$/i,
        use: [
          MiniCssExtractPlugin.loader, // 在生产环境下使用 CSS 提取
          'css-loader',
          'postcss-loader',
          'sass-loader',
          // {
          //   loader: 'style-resources-loader', // 如果使用了variables , mixins , functions 等功能，必须添加这个插件
          //   options: {
          //     patterns: path.resolve(__dirname, './src/assets/scss/file.scss') // 使用 variables , mixins , functions 等功能的文件
          //   }
          // }
        ]
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader, // 在生产环境下使用 CSS 提取
          'css-loader',
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

  optimization: {
    chunkIds: 'deterministic',
    minimizer: [
       // 压缩CSS
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              // Remove all comments
              discardComments: { removeAll: true },
            },
          ],
        }
      }),
      // 压缩 js
      new TerserPlugin({
        exclude: /\/node_modules/,
      })
    ],
    splitChunks: {
      name: false,
      chunks: 'all',
      minSize: 20000,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        // vue: {
        //   chunks: 'all',
        //   name: 'chunk-vue',
        //   priority: 10,
        //   test:  /[\\/]node_modules[\\/]vue[\\/]/
        // },
        _vue: {
          chunks: 'all',
          name: 'chunk_vue',
          priority: 10,
          test:  /vue\.esm\.browser/
        }
      },
    },
  },

  plugins: [
    new FriendlyErrorsPlugin(),
    new CleanWebpackPlugin(),
    new webpack.ProgressPlugin(),
    new webpack.ids.HashedModuleIdsPlugin({
      hashDigest: 'hex'
    }),
    /* NOTE: 在这里利用 hash 做缓存 */
    // new webpack.NamedChunksPlugin(chunk => {
    //   if (chunk.name) {
    //     return chunk.name;
    //   }

    //   const hash = require('hash-sum');
    //   const joinedHash = hash(
    //     Array.from(chunk.modulesIterable, m => m.id).join('_')
    //   );

    //   return 'chunk-' + joinedHash;
    // }),

    // 定义的 rule 运用在vue单文件中的代码
    new VueLoaderPlugin(),

    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './index.html'),
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        collapseBooleanAttributes: true,
        removeScriptTypeAttributes: true,
        minifyJS: true
      }
    }),

    new PreloadPlugin({
      rel: 'preload',
      as(entry) {
        if (/\.css$/.test(entry)) return 'style';
        if (/\.woff$/.test(entry)) return 'font';
        if (/\.(png|jpg|jpeg|gif)$/.test(entry)) return 'image';
        return 'script';
      },

      include: 'initial',
      fileBlacklist: [
        /\.map$/,
        /hot-update\.js$/
      ]
    }),

    new PreloadPlugin(
      {
        rel: 'prefetch',
        include: 'asyncChunks'
      }
    ),

    // 抽离CSS 文件,并使用 contenthash 命名，然后打包的文件放在css文件中
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].css',
      ignoreOrder: true
    }),

    new CompressionPlugin(),

    // new HardSourcePlugin({
    //   cachePrune: {
    //     // Caches younger than `maxAge` are not considered for deletion. They must
    //     // be at least this (default: 2 days) old in milliseconds.
    //     maxAge: 5 * 24 * 60 * 60 * 1000,
    //     // All caches together must be larger than `sizeThreshold` before any
    //     // caches will be deleted. Together they must be at least this
    //     // (default: 50 MB) big in bytes.
    //     sizeThreshold: 100 * 1024 * 1024
    //   },
    // }),

    // new HardSourcePlugin.ExcludeModulePlugin([
    //   {
    //     // HardSource works with mini-css-extract-plugin but due to how
    //     // mini-css emits assets, assets are not emitted on repeated builds with
    //     // mini-css and hard-source together. Ignoring the mini-css loader
    //     // modules, but not the other css loader modules, excludes the modules
    //     // that mini-css needs rebuilt to output assets every time.
    //     test: /mini-css-extract-plugin[\\/]dist[\\/]loader/,
    //   }
    // ]),

    new CopyWebpackPlugin(
      [{
        from: path.resolve(__dirname, './public'),
        to: path.resolve(__dirname, './w-hrms-mobile'),
        toType: 'dir',
        ignore: [
          'index.html',
          '.DS_Store'
        ]
      }]
    ),

    new SpeedMeasurePlugin()
  ]
};
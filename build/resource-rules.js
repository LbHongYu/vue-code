module.exports = [
  {
    test: /\.vue$/,
    exclude: /node_modules/,
    use: ['vue-loader']
  },  
  {
    test: /\.js$/,
    exclude: /node_modules/,
    use: ['cache-loader', 'thread-loader', 'babel-loader']
  },   
  {
    test: /\.s[ac]ss$/i,
    use: [
      'vue-style-loader',
      'css-loader',
      'postcss-loader',
      'sass-loader',
      {
        loader: 'style-resources-loader', // 如果使用了variables , mixins , functions 等功能，必须添加这个插件
        options: {
          // patterns: path.resolve(__dirname, './src/assets/scss/file.scss') // 使用 variables , mixins , functions 等功能的文件
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
  }   
]
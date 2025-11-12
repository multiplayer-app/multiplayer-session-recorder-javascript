const { resolve } = require('path')
const webpack = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const packageJson = require('./package.json')

const isProduction = process.env.NODE_ENV === 'production'

const baseConfig = {
  entry: './src/index.ts',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@src': resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {}
        },
        exclude: /node_modules/
      },
      {
        test: /\.scss$/,
        use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.css$/,
        use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader']
      }
    ]
  },
  optimization: {
    minimizer: [...(isProduction ? [new CssMinimizerPlugin()] : [])],
    minimize: true,
    usedExports: true
  },
  plugins: [
    ...(isProduction
      ? [
          new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css'
          })
        ]
      : []),
    new webpack.DefinePlugin({
      'process.env.MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE': JSON.stringify(''),
      PACKAGE_VERSION: JSON.stringify(packageJson.version)
    })
  ],
  devtool: isProduction ? false : 'source-map',
  mode: isProduction ? 'production' : 'development'
}

const esmBundle = {
  ...baseConfig,
  output: {
    filename: 'index.js',
    path: resolve(__dirname, 'dist'),
    module: true,
    library: {
      type: 'module'
    },
    chunkFormat: 'module'
  },
  experiments: {
    outputModule: true
  },
  externals: {
    // '@opentelemetry/auto-instrumentations-web': '@opentelemetry/auto-instrumentations-web',
    // '@opentelemetry/context-zone': '@opentelemetry/context-zone',
    // '@opentelemetry/core': '@opentelemetry/core',
    // '@opentelemetry/exporter-trace-otlp-http': '@opentelemetry/exporter-trace-otlp-http',
    // '@opentelemetry/instrumentation': '@opentelemetry/instrumentation',
    // '@opentelemetry/resources': '@opentelemetry/resources',
    // '@opentelemetry/sdk-trace-web': '@opentelemetry/sdk-trace-web',
    // '@opentelemetry/semantic-conventions': '@opentelemetry/semantic-conventions',
    // 'socket.io-client': 'socket.io-client',
  },
  plugins: [
    ...baseConfig.plugins,
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['index.js', '*.css']
    })
  ]
}

const umdBundle = {
  ...baseConfig,
  output: {
    filename: 'index.umd.js',
    path: resolve(__dirname, 'dist'),
    library: {
      name: 'SessionRecorder',
      type: 'umd'
    },
    globalObject: 'this'
  },
  externals: {
    // '@opentelemetry/auto-instrumentations-web': '@opentelemetry/auto-instrumentations-web',
    // '@opentelemetry/context-zone': '@opentelemetry/context-zone',
    // '@opentelemetry/core': '@opentelemetry/core',
    // '@opentelemetry/exporter-trace-otlp-http': '@opentelemetry/exporter-trace-otlp-http',
    // '@opentelemetry/instrumentation': '@opentelemetry/instrumentation',
    // '@opentelemetry/resources': '@opentelemetry/resources',
    // '@opentelemetry/sdk-trace-web': '@opentelemetry/sdk-trace-web',
    // '@opentelemetry/semantic-conventions': '@opentelemetry/semantic-conventions',
    // 'socket.io-client': 'socket.io-client',
  },
  plugins: [
    ...baseConfig.plugins,
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['index.umd.js', '*.css']
    })
  ]
}

const browserBundle = {
  ...baseConfig,
  mode: 'development',
  optimization: { minimize: false },
  devtool: false,
  target: 'web',
  output: {
    filename: 'index.js',
    path: resolve(__dirname, 'dist/browser'),
    library: {
      type: 'umd',
      name: 'SessionRecorder'
    },
    globalObject: 'this'
  },
  externals: [],
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      buffer: false,
      stream: false,
      util: false,
      assert: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
      timers: false
    }
  },
  plugins: [
    ...baseConfig.plugins,
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['index.js', '*.css']
    })
  ]
}

const exportersBundle = {
  ...baseConfig,
  entry: './src/exporters.ts',
  target: 'web',
  output: {
    filename: 'index.js',
    path: resolve(__dirname, 'dist/exporters'),
    module: true,
    library: {
      type: 'module'
    },
    globalObject: 'this'
  },
  experiments: {
    outputModule: true
  },
  optimization: { minimize: true },
  externals: [],
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      buffer: false,
      stream: false,
      util: false,
      assert: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
      timers: false
    }
  },
  plugins: [
    ...baseConfig.plugins,
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['exporters.js', '*.css']
    })
  ]
}

module.exports = [esmBundle, umdBundle, browserBundle, exportersBundle]

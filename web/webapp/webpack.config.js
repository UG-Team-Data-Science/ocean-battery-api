const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require("webpack");

module.exports = {
    performance: {
        maxEntrypointSize: 8000000,
        maxAssetSize: 8000000
    },
    entry: path.join(__dirname, "src", "index.js"),
    output: {
        path: path.resolve(__dirname, "./build"),
        filename: "[name].js",
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "public", "index.html"),
      }),
      new webpack.ProvidePlugin({Buffer: ['buffer', 'Buffer'],}),
    ],
    module: {
        rules: [
            {
              test: /\.(woff|woff2|eot|ttf|otf)$/i,
              type: 'asset/resource',
            },
            {
                test: /\.?js$/,
                exclude: /node_modules/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ['@babel/preset-env', '@babel/preset-react']
                  }
                }
            },
            {
              test: /\.(mp4)$/i,
              use: {loader: 'url-loader', options: { limit: 8192, }},
              type: 'javascript/auto'
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|webp|m4s)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.wasm$/,
                type: "asset/inline",
            },
        ]
      },
  devServer: {
    port: 3000,
  },
  resolve: {
      extensions: [".js", ".json", ".ts", ".tsx"],
      fallback: {
        buffer: require.resolve('buffer/'),
        util: require.resolve("util/"),
        fs: false,
        crypto: false,
        path: false
    },
  },
  ignoreWarnings: [
    /Critical dependency\: Accessing import\.meta directly is unsupported/,
  ],
};



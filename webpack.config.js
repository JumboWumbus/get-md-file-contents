const path = require('path');

module.exports = {
  entry: ['./src/index.ts'],
  mode: 'production',
  module: {
    rules: [
      {
        test: /.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      handlebars: 'handlebars/dist/handlebars.js',
    },
  },
  output: {
    filename: 'mdfileread.js',
    path: path.resolve(__dirname, 'build'),
  },
  target: 'node',
};
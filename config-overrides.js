const webpack = require('webpack');

module.exports = function override(config) {
  // Fix "process/browser" for strict ESM modules
  config.resolve.alias = {
    ...config.resolve.alias,
    'process/browser': require.resolve('process/browser.js'),
  };

  // Add Node.js polyfills for webpack 5
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: false,
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    vm: false,
  };

  // Provide process and Buffer globally
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  // Allow imports without extensions in ESM modules
  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false,
    },
  });

  return config;
};
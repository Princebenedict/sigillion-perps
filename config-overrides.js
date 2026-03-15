const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser.js'),
  };

  config.resolve.alias = {
    ...config.resolve.alias,
    'process/browser': require.resolve('process/browser.js'),
    'process/browser.js': require.resolve('process/browser.js'),
  };

  // Fix for ESM modules that use 'process/browser' without extension
  config.module.rules = config.module.rules.map((rule) => {
    if (rule.oneOf) {
      rule.oneOf = rule.oneOf.map((oneOfRule) => {
        if (oneOfRule.loader && oneOfRule.loader.includes('babel-loader')) {
          return oneOfRule;
        }
        return oneOfRule;
      });
    }
    return rule;
  });

  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
    include: /node_modules/,
  });

  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    })
  );

  return config;
};
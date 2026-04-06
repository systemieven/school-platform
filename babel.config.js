module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: 3,
        targets: {
          browsers: [
            '>0.2%',
            'not dead',
            'not op_mini all',
            'ie 11'
          ]
        }
      }
    ]
  ]
};
module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ["plugin:vue/essential", "@vue/airbnb"],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "linebreak-style": 0,
    "comma-dangle": 0,
    "eol-last": 0,
    "function-paren-newline": 0,
    "no-shadow": 0,
    "no-alert": 0,
    quotes: 0,
    "no-param-reassign": 0,
    "no-return-assign": 0,
    "max-len": ["error", { code: 200 }],
    "no-underscore-dangle": 0,
    "operator-linebreak": 0,
    "object-curly-newline": 0,
    "arrow-parens": 0,
    "implicit-arrow-linebreak": 0,
    "space-before-function-paren": 0,
    "unexpected-character-in-unquoted-attribute-value": 0,
    "import/named": 0,
    "import/prefer-default-export": 0,
    "no-undef": 0
  },
  parserOptions: {
    parser: "babel-eslint"
  }
};

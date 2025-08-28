Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: '加载中...'
    },
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    type: {
      type: String,
      value: 'spinner' // spinner, dots
    }
  }
});
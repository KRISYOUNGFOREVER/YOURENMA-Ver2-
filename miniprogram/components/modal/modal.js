Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    content: {
      type: String,
      value: ''
    },
    showCancel: {
      type: Boolean,
      value: true
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    confirmText: {
      type: String,
      value: '确定'
    },
    maskClosable: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onMaskTap() {
      if (this.properties.maskClosable) {
        this.onCancel();
      }
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    onConfirm() {
      this.triggerEvent('confirm');
    },

    // 阻止事件冒泡
    onModalTap() {
      // 空函数，阻止冒泡
    }
  }
});
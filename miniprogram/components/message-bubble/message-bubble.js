Component({
  properties: {
    message: {
      type: Object,
      value: {}
    },
    isSelf: {
      type: Boolean,
      value: false
    },
    showAvatar: {
      type: Boolean,
      value: true
    },
    showTime: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) { // 1分钟内
        return '刚刚';
      } else if (diff < 3600000) { // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`;
      } else if (diff < 86400000) { // 24小时内
        return `${Math.floor(diff / 3600000)}小时前`;
      } else {
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }
    },

    onAvatarTap() {
      this.triggerEvent('avatarTap', {
        userId: this.properties.message.senderId
      });
    },

    onMessageTap() {
      this.triggerEvent('messageTap', {
        message: this.properties.message
      });
    }
  }
});
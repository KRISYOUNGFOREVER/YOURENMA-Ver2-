// components/avatar/avatar.js
Component({
  properties: {
    src: {
      type: String,
      value: ''
    },
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    shape: {
      type: String,
      value: 'circle' // circle, square
    },
    showBorder: {
      type: Boolean,
      value: false
    },
    clickable: {
      type: Boolean,
      value: false
    }
  },

  data: {
    defaultAvatar: '/images/mock_avatar.png',
    displaySrc: '/images/mock_avatar.png'
  },

  observers: {
    'src': function (newSrc) {
      this.updateDisplaySrc(newSrc);
    }
  },

  lifetimes: {
    attached() {
      this.updateDisplaySrc(this.properties.src);
    }
  },

  methods: {
    updateDisplaySrc(src) {
      // 颜色值或空值 -> 默认头像
      if (!src || (typeof src === 'string' && src.trim().startsWith('#'))) {
        this.setData({ displaySrc: this.data.defaultAvatar });
      } else {
        this.setData({ displaySrc: src });
      }
    },

    onImageError() {
      this.setData({
        displaySrc: this.data.defaultAvatar
      });
    },

    onAvatarTap() {
      if (this.properties.clickable) {
        this.triggerEvent('avatarTap', {
          src: this.data.displaySrc
        });
      }
    }
  }
});
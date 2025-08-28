Component({
  properties: {
    user: {
      type: Object,
      value: {}
    },
    distance: {
      type: Number,
      value: 0
    },
    showDistance: {
      type: Boolean,
      value: true
    },
    showActions: {
      type: Boolean,
      value: true
    },
    compact: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    formatDistance(distance) {
      if (distance < 1000) {
        return `${Math.round(distance)}m`;
      } else {
        return `${(distance / 1000).toFixed(1)}km`;
      }
    },

    onChatTap() {
      this.triggerEvent('chat', {
        user: this.properties.user
      });
    },

    onReportTap() {
      this.triggerEvent('report', {
        user: this.properties.user
      });
    },

    onCardTap() {
      this.triggerEvent('cardTap', {
        user: this.properties.user
      });
    }
  }
});
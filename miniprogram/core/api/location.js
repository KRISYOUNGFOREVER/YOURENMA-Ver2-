module.exports = (apiClient) => {
  return {
    // 地理编码（地址转坐标）
    async geocode(address) {
      try {
        // 这里可以集成第三方地理编码服务
        // 暂时返回模拟数据
        return {
          latitude: 0,
          longitude: 0,
          address
        };
      } catch (error) {
        apiClient.handleError(error, '地理编码');
      }
    },

    // 逆地理编码（坐标转地址）
    async reverseGeocode(latitude, longitude) {
      try {
        // 这里可以集成第三方逆地理编码服务
        // 暂时返回模拟数据
        return {
          address: '未知位置',
          province: '',
          city: '',
          district: ''
        };
      } catch (error) {
        apiClient.handleError(error, '逆地理编码');
      }
    },

    // 计算距离
    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // 地球半径（米）
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    },

    // 检查两点是否在指定范围内
    isInRange(lat1, lon1, lat2, lon2, maxDistance = 1000) {
      const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
      return distance <= maxDistance;
    }
  };
};
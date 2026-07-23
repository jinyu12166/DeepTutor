const { logout } = require('../../utils/auth');

Page({
  data: {
    userInfo: null,
    menuList: [
      { icon: '👤', name: '个人信息', path: '' },
      { icon: '⭐', name: '会员中心', path: '' },
      { icon: '📖', name: '年级设置', path: '' },
      { icon: '💬', name: '帮助与反馈', path: '' },
      { icon: 'ℹ️', name: '关于和平树', path: '' }
    ]
  },

  onShow() {
    this.setData({
      userInfo: getApp().globalData.userInfo
    });
  },

  onMenuTap(e) {
    const { item } = e.currentTarget.dataset;
    if (!item.path) {
      wx.showToast({ title: '功能开发中', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: item.path });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
          wx.showToast({ title: '已退出登录', icon: 'success' });
          this.setData({ userInfo: null });
        }
      }
    });
  }
});

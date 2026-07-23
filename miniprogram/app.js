// app.js
const { checkLogin } = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'https://your-server-domain.com', // 生产环境需替换为真实域名
    wsUrl: 'wss://your-server-domain.com/api/v1/ws',
    knowledgeBase: '山东-初中数学-人教版',
    grade: '九年级',
    subject: '数学',
    pendingImage: null
  },

  onLaunch() {
    console.log('和平树AI初中 小程序启动');
    this.initStorage();
    checkLogin();
  },

  onShow() {
    // 每次显示时检查登录态
  },

  initStorage() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) this.globalData.token = token;
    if (userInfo) this.globalData.userInfo = userInfo;
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
  },

  setToken(token) {
    this.globalData.token = token;
    wx.setStorageSync('token', token);
  }
});

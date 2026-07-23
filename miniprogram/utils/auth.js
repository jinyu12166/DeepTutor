const { API, post } = require('./api');

/**
 * 微信登录并换取 JWT Token
 */
function wechatLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('获取微信登录 code 失败'));
          return;
        }
        post(API.wechatLogin, { code: res.code })
          .then((data) => {
            if (data.ok && data.token) {
              const app = getApp();
              app.setToken(data.token);
              app.setUserInfo({
                userId: data.user_id,
                nickname: data.nickname,
                avatarUrl: data.avatar_url,
                role: data.role,
                isAdmin: data.is_admin
              });
              resolve(data);
            } else {
              reject(new Error(data.detail || '登录失败'));
            }
          })
          .catch(reject);
      },
      fail: reject
    });
  });
}

/**
 * 检查登录状态，未登录则静默登录
 */
function checkLogin(force = false) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    if (token && !force) {
      resolve({ token });
      return;
    }
    wechatLogin().then(resolve).catch(reject);
  });
}

/**
 * 退出登录
 */
function logout() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  getApp().globalData.token = null;
  getApp().globalData.userInfo = null;
}

module.exports = {
  wechatLogin,
  checkLogin,
  logout
};

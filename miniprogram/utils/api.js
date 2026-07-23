const API = {
  baseUrl: '',

  // 认证
  wechatLogin: '/api/v1/auth/wechat/login',

  // 知识库
  knowledgeBase: '/api/v1/knowledge',

  // 出题
  question: '/api/v1/question',

  // 反馈
  feedback: '/api/v1/feedback/action',

  // 用户
  profile: '/api/v1/auth/profile'
};

function getBaseUrl() {
  return getApp().globalData.baseUrl || API.baseUrl;
}

function getToken() {
  return wx.getStorageSync('token');
}

function request(options) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.request({
      url: getBaseUrl() + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      timeout: options.timeout || 30000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token 失效，跳转登录
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          reject(res);
        } else {
          wx.showToast({
            title: res.data?.detail || `请求失败(${res.statusCode})`,
            icon: 'none'
          });
          reject(res);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络请求失败，请检查网络', icon: 'none' });
        reject(err);
      }
    });
  });
}

function get(url, data) {
  return request({ url, method: 'GET', data });
}

function post(url, data) {
  return request({ url, method: 'POST', data });
}

module.exports = {
  API,
  request,
  get,
  post,
  getBaseUrl,
  getToken
};

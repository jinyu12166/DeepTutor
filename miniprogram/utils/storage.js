const StorageKeys = {
  TOKEN: 'token',
  USER_INFO: 'userInfo',
  RECENT_QUESTIONS: 'recent_questions',
  LEARN_STATS: 'learn_stats',
  SETTINGS: 'settings',
  KNOWLEDGE_PROGRESS: 'knowledge_progress'
};

function get(key, defaultValue = null) {
  try {
    const value = wx.getStorageSync(key);
    return value === '' ? defaultValue : value;
  } catch (e) {
    return defaultValue;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.error('Storage set failed:', e);
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.error('Storage remove failed:', e);
  }
}

module.exports = {
  StorageKeys,
  get,
  set,
  remove
};

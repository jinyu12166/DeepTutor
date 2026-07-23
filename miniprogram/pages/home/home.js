const { checkLogin } = require('../../utils/auth');
const { get: storageGet, set: storageSet, StorageKeys } = require('../../utils/storage');

Page({
  data: {
    userInfo: null,
    todayStats: {
      learnedCount: 0,
      practiceCount: 0,
      duration: 0
    },
    aiSuggestion: '',
    recentRecords: [],
    quickEntries: [
      { icon: '🎯', name: '智能练习', path: '/pages/practice/practice' },
      { icon: '📋', name: '我的错题', path: '/pages/practice/practice?tab=wrong' },
      { icon: '📊', name: '学情报告', path: '/pages/report/report' },
      { icon: '📖', name: '知识图谱', path: '/pages/practice/practice?tab=topics' }
    ]
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.loadRecentRecords();
    this.loadTodayStats();
  },

  onPullDownRefresh() {
    this.initPage().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async initPage() {
    try {
      await checkLogin();
      const userInfo = getApp().globalData.userInfo;
      this.setData({ userInfo });
      this.loadTodayStats();
      this.loadRecentRecords();
      this.loadAiSuggestion();
    } catch (err) {
      console.error('首页初始化失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  },

  loadTodayStats() {
    const stats = storageGet(StorageKeys.LEARN_STATS, {
      learnedCount: 0,
      practiceCount: 0,
      duration: 0
    });
    this.setData({ todayStats: stats });
  },

  loadRecentRecords() {
    const records = storageGet(StorageKeys.RECENT_QUESTIONS, []);
    this.setData({ recentRecords: records.slice(0, 3) });
  },

  loadAiSuggestion() {
    // MVP 阶段先使用本地缓存建议，后续可调用 Chat API
    const cached = storageGet('ai_suggestion', null);
    const lastUpdate = storageGet('ai_suggestion_time', 0);
    const oneDay = 24 * 60 * 60 * 1000;

    if (cached && Date.now() - lastUpdate < oneDay) {
      this.setData({ aiSuggestion: cached });
      return;
    }

    const suggestions = [
      '二次函数是你的薄弱点，建议今天做3道相关练习',
      '最近方程掌握得不错，继续巩固几何证明题',
      '今天来挑战一道函数与几何综合题吧'
    ];
    const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    this.setData({ aiSuggestion: suggestion });
    storageSet('ai_suggestion', suggestion);
    storageSet('ai_suggestion_time', Date.now());
  },

  onPhotoSearch() {
    wx.navigateTo({ url: '/pages/photo/photo' });
  },

  onTextQuestion() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  onQuickEntry(e) {
    const { path } = e.currentTarget.dataset;
    if (path.startsWith('/pages/practice/practice')) {
      wx.switchTab({ url: path });
    } else {
      wx.navigateTo({ url: path });
    }
  },

  onRecordTap(e) {
    const { item } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat/chat?sessionId=${item.sessionId || ''}&question=${encodeURIComponent(item.question || '')}`
    });
  }
});

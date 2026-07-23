const { get: storageGet, StorageKeys } = require('../../utils/storage');

Page({
  data: {
    grade: '九年级',
    textbook: '人教版',
    recommendations: [],
    knowledgeProgress: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const app = getApp();
    this.setData({
      grade: app.globalData.grade,
      textbook: '人教版'
    });

    // 今日推荐（MVP 阶段本地模拟）
    const recommendations = [
      { id: 1, topic: '二次函数应用题', difficulty: '中等', type: 'written' },
      { id: 2, topic: '相似三角形证明', difficulty: '较难', type: 'written' },
      { id: 3, topic: '概率计算', difficulty: '简单', type: 'choice' }
    ];

    // 知识点进度（本地模拟）
    const progress = storageGet(StorageKeys.KNOWLEDGE_PROGRESS, [
      { category: '代数', percent: 85, chapters: ['方程与不等式', '函数'] },
      { category: '几何', percent: 42, chapters: ['三角形', '四边形与圆'] },
      { category: '统计与概率', percent: 95, chapters: ['数据分析', '概率'] }
    ]);

    this.setData({
      recommendations,
      knowledgeProgress: progress
    });
  },

  onStartPractice(e) {
    const { item } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/quiz/quiz?topic=${encodeURIComponent(item.topic)}&type=${item.type}`
    });
  },

  onChapterTap(e) {
    const { chapter } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/quiz/quiz?topic=${encodeURIComponent(chapter)}`
    });
  }
});

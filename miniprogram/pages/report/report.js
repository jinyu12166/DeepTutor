const { get: storageGet, StorageKeys } = require('../../utils/storage');

Page({
  data: {
    masteryData: [
      { subject: '代数', score: 85 },
      { subject: '几何', score: 42 },
      { subject: '统计', score: 95 },
      { subject: '函数', score: 68 },
      { subject: '综合', score: 55 }
    ],
    weakPoints: [
      { name: '圆的性质', reason: '连续2题答错' },
      { name: '二次函数图像', reason: '正确率低于40%' }
    ],
    stats: {
      totalQuestions: 128,
      correctRate: 72,
      learnDays: 15,
      masteredCount: 23
    }
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const progress = storageGet(StorageKeys.KNOWLEDGE_PROGRESS, []);
    if (progress.length > 0) {
      const masteryData = progress.map(item => ({
        subject: item.category,
        score: item.percent
      }));
      this.setData({ masteryData }, () => {
        this.drawRadarChart();
      });
    } else {
      this.drawRadarChart();
    }
  },

  drawRadarChart() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#radarCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = res[0].width * dpr;
      const height = res[0].height * dpr;
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);

      const centerX = res[0].width / 2;
      const centerY = res[0].height / 2;
      const radius = Math.min(centerX, centerY) - 40;
      const data = this.data.masteryData;
      const count = data.length || 1;
      const angleStep = (Math.PI * 2) / count;

      // 清空画布
      ctx.clearRect(0, 0, res[0].width, res[0].height);

      // 绘制网格
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      for (let level = 1; level <= 4; level++) {
        ctx.beginPath();
        const r = (radius / 4) * level;
        for (let i = 0; i <= count; i++) {
          const angle = i * angleStep - Math.PI / 2;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 绘制轴线和标签
      ctx.strokeStyle = '#CCCCCC';
      ctx.fillStyle = '#666666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      data.forEach((item, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();

        const labelX = centerX + Math.cos(angle) * (radius + 20);
        const labelY = centerY + Math.sin(angle) * (radius + 20);
        ctx.fillText(item.subject, labelX, labelY);
      });

      // 绘制数据区域
      if (data.length > 0) {
        ctx.beginPath();
        data.forEach((item, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const r = (item.score / 100) * radius;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 105, 56, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#006938';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制数据点
        data.forEach((item, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const r = (item.score / 100) * radius;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#006938';
          ctx.fill();
        });
      }
    });
  },

  onRadarTap() {
    wx.showToast({ title: '点击可查看详情', icon: 'none' });
  },

  onWeakPointTap(e) {
    const { name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/quiz/quiz?topic=${encodeURIComponent(name)}`
    });
  }
});

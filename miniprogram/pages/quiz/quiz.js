const { get: storageGet, set: storageSet, StorageKeys } = require('../../utils/storage');
const { processMarkdown } = require('../../utils/latex');

Page({
  data: {
    topic: '',
    currentIndex: 0,
    totalCount: 5,
    question: null,
    selectedOption: '',
    fillAnswer: '',
    writtenAnswer: '',
    submitted: false,
    isCorrect: false,
    explanation: '',
    loading: true
  },

  onLoad(options) {
    const topic = options.topic || '综合练习';
    this.setData({ topic });
    this.loadQuestion();
  },

  loadQuestion() {
    // MVP 阶段使用本地模拟题目
    this.setData({ loading: true });

    setTimeout(() => {
      const mockQuestions = this.getMockQuestions();
      const question = mockQuestions[this.data.currentIndex % mockQuestions.length];
      question.renderedContent = processMarkdown(question.content);
      question.renderedExplanation = processMarkdown(question.explanation);
      this.setData({
        question,
        selectedOption: '',
        fillAnswer: '',
        writtenAnswer: '',
        submitted: false,
        loading: false
      });
    }, 500);
  },

  getMockQuestions() {
    return [
      {
        id: 1,
        type: 'choice',
        content: '已知二次函数 y = x² - 4x + 3，该函数的顶点坐标是？',
        options: ['A. (2, -1)', 'B. (-2, 1)', 'C. (2, 1)', 'D. (-2, -1)'],
        correctAnswer: 'A',
        explanation: '顶点坐标公式：x = -b/(2a)。当 x = 2 时，y = -1，所以选 A。'
      },
      {
        id: 2,
        type: 'fill_in_blank',
        content: '一元二次方程 x² - 5x + 6 = 0 的解为 x₁ = ____，x₂ = ____。',
        correctAnswer: '2,3',
        explanation: '因式分解得 (x-2)(x-3)=0，所以 x₁=2，x₂=3。'
      },
      {
        id: 3,
        type: 'written',
        content: '证明：等腰三角形两底角相等。',
        correctAnswer: '',
        explanation: '作顶角平分线，利用全等三角形证明两底角相等。'
      }
    ];
  },

  onSelectOption(e) {
    if (this.data.submitted) return;
    this.setData({ selectedOption: e.currentTarget.dataset.value });
  },

  onFillInput(e) {
    this.setData({ fillAnswer: e.detail.value });
  },

  onWrittenInput(e) {
    this.setData({ writtenAnswer: e.detail.value });
  },

  onSubmit() {
    if (this.data.submitted) return;

    const { question, selectedOption, fillAnswer, writtenAnswer } = this.data;
    let isCorrect = false;
    let userAnswer = '';

    if (question.type === 'choice') {
      userAnswer = selectedOption;
      isCorrect = selectedOption === question.correctAnswer;
    } else if (question.type === 'fill_in_blank') {
      userAnswer = fillAnswer;
      const normalized = fillAnswer.replace(/\s/g, '').replace(/，/g, ',');
      isCorrect = normalized === question.correctAnswer;
    } else if (question.type === 'written') {
      userAnswer = writtenAnswer;
      // 解答题默认正确，由 AI 后续批改
      isCorrect = true;
    }

    this.setData({
      submitted: true,
      isCorrect,
      explanation: question.explanation
    });

    this.saveQuizResult(question, isCorrect);
  },

  saveQuizResult(question, isCorrect) {
    const stats = storageGet(StorageKeys.LEARN_STATS, {
      learnedCount: 0,
      practiceCount: 0,
      duration: 0
    });
    stats.practiceCount += 1;
    storageSet(StorageKeys.LEARN_STATS, stats);
  },

  onNext() {
    if (this.data.currentIndex < this.data.totalCount - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 });
      this.loadQuestion();
    } else {
      wx.showToast({ title: '练习完成', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  }
});

const wsManager = require('../../utils/ws');
const { checkLogin } = require('../../utils/auth');
const { get: storageGet, set: storageSet, StorageKeys } = require('../../utils/storage');
const { processMarkdown } = require('../../utils/latex');

Page({
  data: {
    messages: [],
    inputValue: '',
    isThinking: false,
    scrollToMessage: '',
    sessionId: '',
    pendingImage: null
  },

  onLoad(options) {
    const sessionId = options.sessionId || wsManager.generateSessionId();
    this.setData({ sessionId });

    // 处理拍照搜题传入的图片
    if (options.imageKey) {
      const pending = getApp().globalData.pendingImage;
      if (pending && pending.key === options.imageKey) {
        this.setData({
          pendingImage: pending.base64,
          inputValue: pending.text || ''
        });
      }
    }

    // 如果有预设问题
    if (options.question) {
      this.addMessage({
        id: Date.now(),
        role: 'user',
        content: decodeURIComponent(options.question)
      });
    }

    checkLogin().then(() => {
      this.connectWebSocket();
    }).catch((err) => {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    });
  },

  onUnload() {
    wsManager.close();
  },

  connectWebSocket() {
    wsManager.connect(this.data.sessionId);
    wsManager.on('content', this.onWSContent.bind(this));
    wsManager.on('end', this.onWSEnd.bind(this));
    wsManager.on('sources', this.onWSSources.bind(this));
    wsManager.on('error', this.onWSError.bind(this));
    wsManager.on('close', this.onWSClose.bind(this));
  },

  onWSContent(data) {
    const messages = this.data.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.isComplete) {
      lastMessage.content += data.content || '';
      lastMessage.renderedContent = processMarkdown(lastMessage.content);
      this.setData({ messages });
    } else {
      this.addMessage({
        id: Date.now(),
        role: 'assistant',
        content: data.content || '',
        renderedContent: processMarkdown(data.content || ''),
        isComplete: false
      });
    }
  },

  onWSEnd(data) {
    const messages = this.data.messages;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.isComplete = true;
      lastMessage.renderedContent = processMarkdown(lastMessage.content);
      // sources 可能在 done 事件的 metadata.sources，也可能来自独立的 sources 事件
      lastMessage.sources = data.sources || data.metadata?.sources || [];
      this.setData({ messages, isThinking: false });
    }
    this.saveRecentQuestion(lastMessage);
  },

  onWSSources(data) {
    const messages = this.data.messages;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const newSources = (data.metadata && data.metadata.sources) || [];
      lastMessage.sources = (lastMessage.sources || []).concat(newSources);
      this.setData({ messages });
    }
  },

  onWSError() {
    this.setData({ isThinking: false });
    wx.showToast({ title: '连接失败，请重试', icon: 'none' });
  },

  onWSClose() {
    this.setData({ isThinking: false });
  },

  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSend() {
    const content = this.data.inputValue.trim() || '请帮我看看这道题';
    const image = this.data.pendingImage;

    this.addMessage({
      id: Date.now(),
      role: 'user',
      content: content,
      image: image
    });

    this.setData({ inputValue: '', pendingImage: null, isThinking: true });

    wsManager.sendUserMessage(content, {
      knowledgeBase: getApp().globalData.knowledgeBase,
      image: image
    });
  },

  onClearImage() {
    this.setData({ pendingImage: null });
  },

  addMessage(message) {
    if (message.content && !message.renderedContent) {
      message.renderedContent = processMarkdown(message.content);
    }
    const messages = this.data.messages.concat(message);
    this.setData({
      messages,
      scrollToMessage: `msg-${message.id}`
    });
  },

  saveRecentQuestion(message) {
    if (!message || !message.content) return;
    const records = storageGet(StorageKeys.RECENT_QUESTIONS, []);
    records.unshift({
      id: Date.now(),
      topic: message.content.slice(0, 30),
      status: 'learning',
      statusText: '学习中',
      sessionId: this.data.sessionId
    });
    storageSet(StorageKeys.RECENT_QUESTIONS, records.slice(0, 10));
  },

  onFeedback(e) {
    const { action, index } = e.currentTarget.dataset;
    const message = this.data.messages[index];
    if (!message) return;

    const { API, post } = require('../../utils/api');
    post(API.feedback, {
      session_id: this.data.sessionId,
      message_id: String(message.id),
      action: action,
      question_text: ''
    }).then(() => {
      wx.showToast({ title: '感谢您的反馈', icon: 'none' });
    }).catch(() => {
      wx.showToast({ title: '反馈提交失败', icon: 'none' });
    });
  },

  onAddImage() {
    wx.navigateTo({ url: '/pages/photo/photo' });
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({ urls: [src], current: src });
  }
});

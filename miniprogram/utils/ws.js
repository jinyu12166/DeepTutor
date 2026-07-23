const app = getApp();

class WSManager {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelays = [1000, 2000, 4000, 8000, 16000];
    this.listeners = {};
    this.isConnecting = false;
    this.pingTimer = null;
    this.pongTimer = null;
  }

  connect(sessionId) {
    if (this.isConnecting || (this.socket && this.socket.readyState === 1)) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.sessionId = sessionId || this.generateSessionId();

    const token = wx.getStorageSync('token');
    const wsUrl = app.globalData.wsUrl;

    return new Promise((resolve, reject) => {
      this.socket = wx.connectSocket({
        url: wsUrl,
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        protocols: []
      });

      this.socket.onOpen(() => {
        console.log('WebSocket 已连接');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // 订阅会话
        this.send({
          type: 'subscribe_session',
          session_id: this.sessionId
        });
        this.emit('open', {});
        resolve();
      });

      this.socket.onMessage((res) => {
        try {
          const data = JSON.parse(res.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('WebSocket 消息解析失败:', res.data);
        }
      });

      this.socket.onClose(() => {
        console.log('WebSocket 已关闭');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('close', {});
        this.reconnect();
      });

      this.socket.onError((err) => {
        console.error('WebSocket 错误:', err);
        this.isConnecting = false;
        this.emit('error', err);
        reject(err);
      });
    });
  }

  handleMessage(data) {
    // 心跳响应
    if (data.type === 'pong') {
      clearTimeout(this.pongTimer);
      return;
    }

    // 协议适配：后端 done 事件在前端以 end 透出，便于业务层统一监听
    const eventType = data.type === 'done' ? 'end' : (data.type || 'message');

    // 透传给业务层
    this.emit(eventType, data);
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== 1) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }
    this.socket.send({
      data: JSON.stringify(message)
    });
    return true;
  }

  sendUserMessage(content, options = {}) {
    const kb = options.knowledgeBase || app.globalData.knowledgeBase;
    const payload = {
      type: 'start_turn',
      content: content,
      session_id: this.sessionId,
      knowledge_bases: kb ? [kb] : [],
      capability: options.capability || 'chat',
      language: 'zh'
    };

    if (options.image) {
      payload.attachments = [{
        type: 'image',
        base64: options.image,
        mime_type: 'image/jpeg',
        filename: 'photo.jpg'
      }];
    }

    return this.send(payload);
  }

  regenerate() {
    return this.send({
      type: 'regenerate',
      session_id: this.sessionId
    });
  }

  cancel() {
    return this.send({
      type: 'cancel_turn',
      session_id: this.sessionId
    });
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('WebSocket 重连次数已达上限');
      this.emit('reconnect_failed', {});
      return;
    }

    const delay = this.reconnectDelays[this.reconnectAttempts] || 16000;
    this.reconnectAttempts++;

    console.log(`WebSocket ${delay}ms 后第 ${this.reconnectAttempts} 次重连...`);

    setTimeout(() => {
      this.connect(this.sessionId);
    }, delay);
  }

  startHeartbeat() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
      this.pongTimer = setTimeout(() => {
        console.warn('WebSocket 心跳超时，准备重连');
        this.close();
        this.reconnect();
      }, 10000);
    }, 30000);
  }

  stopHeartbeat() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
  }

  close() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('WebSocket 事件处理错误:', e);
      }
    });
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

const wsManager = new WSManager();

module.exports = wsManager;

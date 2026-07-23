Page({
  data: {
    photoUrl: '',
    base64Image: '',
    supplementText: '',
    isCompressing: false
  },

  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        this.compressAndEncode(tempFile.tempFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
      }
    });
  },

  compressAndEncode(filePath) {
    this.setData({ isCompressing: true });

    wx.compressImage({
      src: filePath,
      quality: 80,
      compressedHeight: 1024,
      success: (res) => {
        this.setData({ photoUrl: res.tempFilePath });
        this.fileToBase64(res.tempFilePath);
      },
      fail: (err) => {
        console.error('压缩失败:', err);
        wx.showToast({ title: '图片压缩失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isCompressing: false });
      }
    });
  },

  fileToBase64(filePath) {
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success: (res) => {
        const base64 = `data:image/jpeg;base64,${res.data}`;
        this.setData({ base64Image: base64 });
      },
      fail: (err) => {
        console.error('Base64 编码失败:', err);
        wx.showToast({ title: '图片读取失败', icon: 'none' });
      }
    });
  },

  onRetake() {
    this.setData({
      photoUrl: '',
      base64Image: '',
      supplementText: ''
    });
  },

  onSupplementInput(e) {
    this.setData({ supplementText: e.detail.value });
  },

  onSubmit() {
    if (!this.data.base64Image) {
      wx.showToast({ title: '请先拍照', icon: 'none' });
      return;
    }

    // URL 长度有限，base64 图片通过 globalData 中转
    const app = getApp();
    const imageKey = `img_${Date.now()}`;
    app.globalData.pendingImage = {
      key: imageKey,
      base64: this.data.base64Image,
      text: this.data.supplementText
    };

    wx.navigateTo({
      url: `/pages/chat/chat?imageKey=${imageKey}`
    });
  }
});

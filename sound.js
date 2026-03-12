// 音效系统 - 纸张翻页声
// 简洁优雅的点击音效，配合页面过渡动画

const SoundEffect = {
    context: null,
    enabled: true,

    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playPageTurn() {
        if (!this.enabled) return;

        try {
            this.init();

            const now = this.context.currentTime;
            const duration = 0.2;

            // 创建粉红噪音缓冲 - 更自然的声音
            const bufferSize = this.context.sampleRate * duration;
            const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
            const data = buffer.getChannelData(0);

            // 生成粉红噪音 (1/f noise)
            let b0, b1, b2, b3, b4, b5, b6;
            b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11; // 调整音量
                b6 = white * 0.115926;
            }

            // 噪音源
            const noise = this.context.createBufferSource();
            noise.buffer = buffer;

            // 双层滤波器 - 模拟纸张的中高频
            const filter1 = this.context.createBiquadFilter();
            filter1.type = 'bandpass';
            filter1.frequency.value = 2500;
            filter1.Q.value = 1;

            const filter2 = this.context.createBiquadFilter();
            filter2.type = 'highpass';
            filter2.frequency.value = 1500;

            // 音量包络 - 自然的起落
            const gain = this.context.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.02); // 20ms 攻击
            gain.gain.setTargetAtTime(0.001, now + 0.05, 0.04); // 缓慢衰减

            // 连接节点
            noise.connect(filter1);
            filter1.connect(filter2);
            filter2.connect(gain);
            gain.connect(this.context.destination);

            // 播放
            noise.start(now);
            noise.stop(now + duration);
        } catch (e) {
            // 静默失败，不影响用户体验
            console.debug('Sound effect error:', e);
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
};

// 初始化点击音效
document.addEventListener('DOMContentLoaded', () => {
    // 首次用户交互后初始化 AudioContext（浏览器策略要求）
    const initAudio = () => {
        SoundEffect.init();
        document.body.removeEventListener('click', initAudio);
    };
    document.body.addEventListener('click', initAudio, { once: true });

    // 为所有内部链接添加音效
    document.querySelectorAll('a[href$=".html"]').forEach(link => {
        link.addEventListener('click', (e) => {
            SoundEffect.playPageTurn();
        });
    });

    // Chat CTA 按钮
    document.querySelectorAll('.chat-cta').forEach(link => {
        link.addEventListener('click', (e) => {
            SoundEffect.playPageTurn();
        });
    });
});

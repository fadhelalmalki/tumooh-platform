(function () {
    const config = window.TUMOOH_MOCK_SESSION || {};
    const sessionId = config.sessionId;
    const feedbackBase = config.feedbackBasePath || '/mock-interview/feedback/';
    const duration = config.durationSeconds || 30;

    const timerEl = document.getElementById('timer');
    const videoEl = document.getElementById('webcam');
    const fallbackEl = document.getElementById('camera-fallback');
    const submittingOverlay = document.getElementById('submitting-overlay');
    const liveTranscriptEl = document.getElementById('live-transcript');

    let remaining = duration;
    let mediaStream = null;
    let audioContext = null;
    let analyser = null;
    let monitorInterval = null;
    let timerInterval = null;
    let redirectStarted = false;
    let sessionReady = false;

    let speechActiveSeconds = 0;
    let peakAudioLevel = 0;
    let transcriptParts = [];
    let pendingInterimTranscript = '';
    let speechRecognition = null;
    let speechApiAvailable = false;

    const SPEECH_LEVEL_THRESHOLD = 0.06;
    const SAMPLE_MS = 200;

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.max(0, seconds % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function showSubmittingOverlay(message) {
        if (!submittingOverlay) {
            return;
        }
        submittingOverlay.classList.remove('hidden');
        if (message) {
            const msgEl = submittingOverlay.querySelector('[data-overlay-message]');
            if (msgEl) {
                msgEl.textContent = message;
            }
        }
    }

    function showCameraRequired(message) {
        sessionReady = false;
        if (fallbackEl) {
            fallbackEl.textContent = message;
            fallbackEl.classList.remove('hidden');
        }
        if (videoEl) {
            videoEl.classList.add('hidden');
        }
        if (timerEl) {
            timerEl.textContent = '—';
        }
    }

    function isVideoLive(stream) {
        const track = stream.getVideoTracks()[0];
        return track && track.readyState === 'live' && track.enabled && !track.muted;
    }

    function isAudioLive(stream) {
        const track = stream.getAudioTracks()[0];
        return track && track.readyState === 'live' && track.enabled;
    }

    function getQuestionsFromDom() {
        const list = document.getElementById('question-list');
        if (!list) {
            return [];
        }
        return Array.from(list.querySelectorAll('li')).map(function (li) {
            return li.textContent.trim();
        }).filter(Boolean);
    }

    function currentTranscriptText() {
        return (transcriptParts.join(' ') + ' ' + pendingInterimTranscript).trim();
    }

    function updateLiveTranscriptView() {
        if (!liveTranscriptEl) {
            return;
        }
        const text = currentTranscriptText();
        if (text) {
            liveTranscriptEl.textContent = text;
            liveTranscriptEl.classList.remove('italic', 'text-white/60');
            liveTranscriptEl.classList.add('text-white/90');
        } else if (speechApiAvailable) {
            liveTranscriptEl.textContent = 'Listening… speak clearly in English.';
        } else {
            liveTranscriptEl.textContent = 'Speech captions unavailable — check mic permissions.';
        }
    }

    function buildSessionNotes() {
        const transcript = currentTranscriptText();
        const spoke = speechActiveSeconds >= 1.5;
        const questions = getQuestionsFromDom();
        const questionsBlock = questions.map(function (q, i) {
            return (i + 1) + '. ' + q;
        }).join(' ');

        const cameraActive = mediaStream && isVideoLive(mediaStream);
        const microphoneActive = mediaStream && isAudioLive(mediaStream);

        const header = [
            'CAMERA_ACTIVE:' + (cameraActive ? 'true' : 'false'),
            'MICROPHONE_ACTIVE:' + (microphoneActive ? 'true' : 'false'),
            'SPEECH_TO_TEXT:' + (speechApiAvailable ? 'true' : 'false')
        ].join(' ');

        if (!spoke && !transcript) {
            return [
                header,
                'NO_SPEECH_DETECTED:true',
                'Questions shown: ' + questionsBlock,
                'The candidate remained silent for essentially the entire ' + duration + '-second session.',
                'Measured active speech time: ' + speechActiveSeconds.toFixed(1) + ' seconds.',
                'Peak microphone level (0-1): ' + peakAudioLevel.toFixed(3) + '.',
                'Transcript: (empty — no words captured).',
                'Do not assume engagement or answers; there was no verbal content to score against the questions.'
            ].join(' ');
        }

        return [
            header,
            'NO_SPEECH_DETECTED:false',
            'Questions shown: ' + questionsBlock,
            'Active speech time: approximately ' + speechActiveSeconds.toFixed(1) + ' seconds of ' + duration + '.',
            'Peak microphone level (0-1): ' + peakAudioLevel.toFixed(3) + '.',
            'Transcript: ' + transcript,
            'Evaluate how well the transcript answers each question.'
        ].join(' ');
    }

    async function redirectToFeedback() {
        if (redirectStarted || !sessionReady) {
            return;
        }
        redirectStarted = true;
        showSubmittingOverlay('Saving your session and generating AI feedback…');

        const notes = buildSessionNotes();
        stopMonitoring();

        try {
            const response = await fetch('/api/v1/mock-interviews/' + sessionId + '/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: notes,
                keepalive: true
            });
            if (!response.ok) {
                throw new Error('Telemetry save failed');
            }
        } catch (err) {
            redirectStarted = false;
            if (submittingOverlay) {
                submittingOverlay.classList.add('hidden');
            }
            showCameraRequired('Could not save your session data. Check your connection and refresh to try again.');
            return;
        }

        window.location.assign(feedbackBase + sessionId);
    }

    function startTimer() {
        remaining = duration;
        timerEl.textContent = formatTime(remaining);
        timerInterval = setInterval(function () {
            remaining -= 1;
            timerEl.textContent = formatTime(remaining);
            if (remaining <= 10) {
                timerEl.classList.add('text-red-400');
            }
            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                redirectToFeedback();
            }
        }, 1000);
    }

    function startAudioMonitoring(stream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        monitorInterval = setInterval(function () {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum += data[i];
            }
            const level = sum / (data.length * 255);
            if (level > peakAudioLevel) {
                peakAudioLevel = level;
            }
            if (level >= SPEECH_LEVEL_THRESHOLD) {
                speechActiveSeconds += SAMPLE_MS / 1000;
            }
        }, SAMPLE_MS);
    }

    function restartSpeechRecognition() {
        if (!speechRecognition || !sessionReady || redirectStarted) {
            return;
        }
        try {
            speechRecognition.start();
        } catch (e) {
            /* ignore restart race */
        }
    }

    function startSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            speechApiAvailable = false;
            updateLiveTranscriptView();
            return;
        }
        try {
            speechApiAvailable = true;
            speechRecognition = new SpeechRecognition();
            speechRecognition.continuous = true;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';
            speechRecognition.onresult = function (event) {
                pendingInterimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const piece = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        transcriptParts.push(piece);
                    } else {
                        pendingInterimTranscript += piece + ' ';
                    }
                }
                updateLiveTranscriptView();
            };
            speechRecognition.onend = function () {
                restartSpeechRecognition();
            };
            speechRecognition.onerror = function () {
                restartSpeechRecognition();
            };
            speechRecognition.start();
            updateLiveTranscriptView();
        } catch (e) {
            speechApiAvailable = false;
            updateLiveTranscriptView();
        }
    }

    function stopMonitoring() {
        if (speechRecognition) {
            try {
                speechRecognition.onend = null;
                speechRecognition.onerror = null;
                speechRecognition.stop();
            } catch (e) {
                /* ignore */
            }
            speechRecognition = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        if (audioContext) {
            audioContext.close().catch(function () {});
            audioContext = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(function (t) { t.stop(); });
            mediaStream = null;
        }
    }

    function waitForVideoFrames() {
        return new Promise(function (resolve, reject) {
            if (!videoEl) {
                reject(new Error('No video element'));
                return;
            }
            const timeout = setTimeout(function () {
                reject(new Error('Camera produced no video frames'));
            }, 5000);

            function check() {
                if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                    clearTimeout(timeout);
                    resolve();
                }
            }

            videoEl.addEventListener('loadeddata', check);
            videoEl.addEventListener('playing', check);
            check();
        });
    }

    async function initCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showCameraRequired('Camera and microphone are required. Use Chrome on localhost or HTTPS.');
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: true
            });

            if (!isAudioLive(mediaStream)) {
                throw new Error('Microphone not available');
            }

            const videoTrack = mediaStream.getVideoTracks()[0];
            if (!videoTrack || videoTrack.readyState !== 'live') {
                throw new Error('Camera not available');
            }

            if (fallbackEl) {
                fallbackEl.classList.add('hidden');
            }
            if (videoEl) {
                videoEl.classList.remove('hidden');
                videoEl.srcObject = mediaStream;
                await videoEl.play();
            }

            await waitForVideoFrames();

            if (!isVideoLive(mediaStream)) {
                throw new Error('Camera track muted or stopped');
            }

            sessionReady = true;
            startAudioMonitoring(mediaStream);
            startSpeechRecognition();
            startTimer();
        } catch (err) {
            stopMonitoring();
            showCameraRequired(
                'Camera and microphone are blocked or unavailable. In Chrome: click the '
                + 'camera icon in the address bar → Allow camera & microphone for this site, '
                + 'then reload. Also check macOS System Settings → Privacy → Camera/Microphone → Chrome.'
            );
        }
    }

    initCamera();

    window.addEventListener('beforeunload', stopMonitoring);
})();

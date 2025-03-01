const peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
    },
    debug: 2
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const generateLinkBtn = document.getElementById('generateLink');
const linkDisplay = document.getElementById('linkDisplay');
const copyLinkBtn = document.getElementById('copyLink');
const endBtn = document.getElementById('endBtn');
const videoOffBtn = document.getElementById('videoOffBtn');
const videoOnBtn = document.getElementById('videoOnBtn');
const micOffBtn = document.getElementById('micOffBtn');
const micOnBtn = document.getElementById('micOnBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const stopScreenShareBtn = document.getElementById('stopScreenShareBtn');
const status = document.getElementById('status');
const remoteStatus = document.getElementById('remoteStatus');

let localStream;
let currentCall;
let peerId;
let isScreenSharing = false;
let remoteVideoOn = false;
let remoteMicOn = false;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const joinId = urlParams.get('call');

// Initialize media
navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
}).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    updateButtonStates();
}).catch(err => {
    console.error('Media error:', err);
    alert('Could not access camera/microphone. Please check permissions.');
    status.textContent = 'Media access failed';
});

// Handle peer connection
peer.on('open', id => {
    peerId = id;
    if (joinId) {
        joinCall(joinId);
    } else {
        status.textContent = 'Ready to create a worldwide call';
    }
});

// Handle incoming calls
peer.on('call', call => {
    if (currentCall) {
        call.close();
        return;
    }
    
    currentCall = call;
    call.answer(localStream);
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected globally';
        toggleButtons(true);
        updateRemoteStatus(remoteStream);
    });
    
    call.on('close', () => endCall());
    call.on('error', err => {
        console.error('Call error:', err);
        endCall();
    });
});

// Button event listeners
generateLinkBtn.addEventListener('click', () => {
    const callLink = `${window.location.origin}?call=${peerId}`;
    linkDisplay.textContent = callLink;
    linkDisplay.style.display = 'block';
    copyLinkBtn.style.display = 'inline-block';
    generateLinkBtn.disabled = true;
    status.textContent = 'Waiting for global participants...';
});

copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(linkDisplay.textContent)
        .then(() => alert('Link copied! Share it worldwide!'))
        .catch(err => console.error('Failed to copy:', err));
});

videoOffBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getVideoTracks()[0].enabled = false;
        videoOffBtn.style.display = 'none';
        videoOnBtn.style.display = 'inline-block';
        updateButtonStates();
    }
});

videoOnBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getVideoTracks()[0].enabled = true;
        videoOffBtn.style.display = 'inline-block';
        videoOnBtn.style.display = 'none';
        updateButtonStates();
    }
});

micOffBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = false;
        micOffBtn.style.display = 'none';
        micOnBtn.style.display = 'inline-block';
        updateButtonStates();
    }
});

micOnBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = true;
        micOffBtn.style.display = 'inline-block';
        micOnBtn.style.display = 'none';
        updateButtonStates();
    }
});

screenShareBtn.addEventListener('click', async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
        // Stop existing video track
        localStream.getVideoTracks().forEach(track => track.stop());
        
        // Replace with screen stream
        localStream = screenStream;
        localVideo.srcObject = screenStream;
        
        if (currentCall) {
            const sender = currentCall.peerConnection.getSenders()
                .find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
        }
        
        isScreenSharing = true;
        screenShareBtn.style.display = 'none';
        stopScreenShareBtn.style.display = 'inline-block';
        updateButtonStates();
        
        screenStream.getVideoTracks()[0].onended = () => stopScreenSharing();
    } catch (err) {
        console.error('Screen share error:', err);
        status.textContent = 'Failed to start screen sharing';
    }
});

stopScreenShareBtn.addEventListener('click', stopScreenSharing);

endBtn.addEventListener('click', endCall);

function joinCall(remoteId) {
    status.textContent = 'Connecting across the world...';
    const call = peer.call(remoteId, localStream);
    currentCall = call;
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected globally';
        toggleButtons(true);
        updateRemoteStatus(remoteStream);
    });
    
    call.on('close', () => endCall());
    call.on('error', err => {
        console.error('Call error:', err);
        endCall();
    });
    
    setTimeout(() => {
        if (!remoteVideo.srcObject) {
            status.textContent = 'Connection timeout';
            endCall();
        }
    }, 30000);
}

async function stopScreenSharing() {
    if (!isScreenSharing) return;
    
    localStream.getTracks().forEach(track => track.stop());
    const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    
    localStream = newStream;
    localVideo.srcObject = newStream;
    
    if (currentCall) {
        const sender = currentCall.peerConnection.getSenders()
            .find(s => s.track && s.track.kind === 'video');
        if (sender) {
            await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
    }
    
    isScreenSharing = false;
    screenShareBtn.style.display = 'inline-block';
    stopScreenShareBtn.style.display = 'none';
    updateButtonStates();
}

function endCall() {
    if (currentCall) currentCall.close();
    currentCall = null;
    remoteVideo.srcObject = null;
    toggleButtons(false);
    remoteStatus.textContent = 'Not connected';
    if (!joinId) {
        generateLinkBtn.disabled = false;
        linkDisplay.style.display = 'none';
        copyLinkBtn.style.display = 'none';
        status.textContent = 'Ready to create a new worldwide call';
    } else {
        status.textContent = 'Call ended - Open a new link to join another call';
    }
}

function toggleButtons(isCallActive) {
    endBtn.disabled = !isCallActive;
}

function updateButtonStates() {
    if (localStream) {
        const videoEnabled = localStream.getVideoTracks()[0].enabled;
        videoOffBtn.className = videoEnabled ? 'on' : 'off';
        videoOnBtn.className = videoEnabled ? 'off' : 'on';
        
        const audioEnabled = localStream.getAudioTracks()[0].enabled;
        micOffBtn.className = audioEnabled ? 'on' : 'off';
        micOnBtn.className = audioEnabled ? 'off' : 'on';
        
        screenShareBtn.className = isScreenSharing ? 'off' : 'on';
        stopScreenShareBtn.className = isScreenSharing ? 'on' : 'off';
    }
}

function updateRemoteStatus(remoteStream) {
    if (!remoteStream) {
        remoteStatus.textContent = 'Not connected';
        return;
    }
    
    remoteVideoOn = remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled;
    remoteMicOn = remoteStream.getAudioTracks().length > 0 && remoteStream.getAudioTracks()[0].enabled;
    
    remoteStatus.textContent = `Connected - Video: ${remoteVideoOn ? 'On' : 'Off'}, Mic: ${remoteMicOn ? 'On' : 'Off'}`;
    
    // Periodically check status
    setTimeout(() => {
        if (remoteVideo.srcObject) updateRemoteStatus(remoteVideo.srcObject);
    }, 1000);
}

// Handle peer errors
peer.on('error', err => {
    console.error('Peer error:', err);
    if (err.type === 'peer-unavailable') {
        status.textContent = 'Unable to connect - host not available';
        endCall();
    } else if (err.type === 'network') {
        status.textContent = 'Network error - please check your connection';
        endCall();
    }
});

peer.on('disconnected', () => {
    status.textContent = 'Disconnected from signaling server';
    endCall();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (currentCall) currentCall.close();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    peer.destroy();
});

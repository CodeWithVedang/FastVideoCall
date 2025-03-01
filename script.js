// Initialize PeerJS with additional configuration for better global connectivity
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
    debug: 2 // Increased logging for debugging
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const generateLinkBtn = document.getElementById('generateLink');
const linkDisplay = document.getElementById('linkDisplay');
const copyLinkBtn = document.getElementById('copyLink');
const endBtn = document.getElementById('endBtn');
const status = document.getElementById('status');

let localStream;
let currentCall;
let peerId;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const joinId = urlParams.get('call');

// Initialize media with better constraints
navigator.mediaDevices.getUserMedia({
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
}).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
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
        call.close(); // Only allow one call at a time
        return;
    }
    
    currentCall = call;
    call.answer(localStream);
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected globally';
        toggleButtons(true);
    });
    
    call.on('close', () => {
        endCall();
    });
    
    call.on('error', err => {
        console.error('Call error:', err);
        endCall();
    });
});

// Generate link
generateLinkBtn.addEventListener('click', () => {
    const callLink = `${window.location.origin}?call=${peerId}`;
    linkDisplay.textContent = callLink;
    linkDisplay.style.display = 'block';
    copyLinkBtn.style.display = 'inline-block';
    generateLinkBtn.disabled = true;
    status.textContent = 'Waiting for global participants...';
});

// Copy link to clipboard
copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(linkDisplay.textContent)
        .then(() => alert('Link copied! Share it worldwide!'))
        .catch(err => console.error('Failed to copy:', err));
});

// End call
endBtn.addEventListener('click', endCall);

function joinCall(remoteId) {
    status.textContent = 'Connecting across the world...';
    const call = peer.call(remoteId, localStream);
    currentCall = call;
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected globally';
        toggleButtons(true);
    });
    
    call.on('close', () => {
        endCall();
    });
    
    call.on('error', err => {
        console.error('Call error:', err);
        endCall();
    });
    
    // Timeout if no connection after 30 seconds
    setTimeout(() => {
        if (!remoteVideo.srcObject) {
            status.textContent = 'Connection timeout';
            endCall();
        }
    }, 30000);
}

function endCall() {
    if (currentCall) {
        currentCall.close();
    }
    currentCall = null;
    remoteVideo.srcObject = null;
    toggleButtons(false);
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

// Monitor connection state
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

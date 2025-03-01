const peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true
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

// Initialize media
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
}).catch(err => {
    console.error('Error accessing media devices:', err);
    alert('Could not access camera/microphone. Please check permissions.');
});

// Handle peer connection
peer.on('open', id => {
    peerId = id;
    if (joinId) {
        joinCall(joinId);
    } else {
        status.textContent = 'Ready to create a call';
    }
});

// Handle incoming calls
peer.on('call', call => {
    currentCall = call;
    call.answer(localStream);
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected';
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
    status.textContent = 'Waiting for someone to join...';
});

// Copy link to clipboard
copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(linkDisplay.textContent)
        .then(() => alert('Link copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err));
});

// End call
endBtn.addEventListener('click', endCall);

function joinCall(remoteId) {
    status.textContent = 'Connecting...';
    const call = peer.call(remoteId, localStream);
    currentCall = call;
    
    call.on('stream', remoteStream => {
        remoteVideo.srcObject = remoteStream;
        status.textContent = 'Connected';
        toggleButtons(true);
    });
    
    call.on('close', () => {
        endCall();
    });
    
    call.on('error', err => {
        console.error('Call error:', err);
        endCall();
    });
}

function endCall() {
    if (currentCall) {
        currentCall.close();
    }
    remoteVideo.srcObject = null;
    toggleButtons(false);
    status.textContent = 'Call ended';
    if (!joinId) {
        generateLinkBtn.disabled = false;
        linkDisplay.style.display = 'none';
        copyLinkBtn.style.display = 'none';
        status.textContent = 'Ready to create a new call';
    }
}

function toggleButtons(isCallActive) {
    endBtn.disabled = !isCallActive;
}

// Handle peer errors
peer.on('error', err => {
    console.error('Peer error:', err);
    if (err.type === 'peer-unavailable') {
        status.textContent = 'Unable to connect - user not available';
        endCall();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (currentCall) currentCall.close();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    peer.destroy();
});

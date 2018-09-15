
import io from 'socket.io-client';
import {
    fromEvent,
    merge,
    Subject
} from 'rxjs';

export const dataChannelIncomingSubject = new Subject();
export const dataChannelOutgoingSubject = new Subject();

let socket = io('http://10.7.20.5:2013');

/****************************************************************************
 * Initial setup
 ****************************************************************************/

let configuration = {
    'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
    }]
};

// Create a random room if not already present in the URL.
let isInitiator;
let room = window.location.hash.substring(1);
if (!room) {
    room = window.location.hash = randomToken();
}


/****************************************************************************
 * Signaling server
 ****************************************************************************/

socket.on('ipaddr', function (ipaddr) {
    console.log('Server IP address is: ' + ipaddr);
});

socket.on('created', function (room, clientId) {
    console.log('Created room', room, '- my client ID is', clientId);
    isInitiator = true;
});

socket.on('joined', function (room, clientId) {
    console.log('This peer has joined room', room, 'with client ID', clientId);
    isInitiator = false;
    createPeerConnection(isInitiator, configuration);
});

socket.on('full', function (room) {
    alert('Room ' + room + ' is full. We will create a new room for you.');
    window.location.hash = '';
    window.location.reload();
});

socket.on('ready', function () {
    console.log('Socket is ready');
    createPeerConnection(isInitiator, configuration);
});

socket.on('log', function (array) {
    console.log.apply(console, array);
});

socket.on('message', function (message) {
    // console.log('Client received message:', message);
    signalingMessageCallback(message);
});

// Join a room
socket.emit('create or join', room);

if (location.hostname.match(/localhost|127\.0\.0/)) {
    socket.emit('ipaddr');
}

/**
 * Send message to signaling server
 */
function sendMessage(message) {
    // console.log('Client sending message: ', message);
    socket.emit('message', message);
}

/****************************************************************************
 * WebRTC peer connection and data channel
 ****************************************************************************/

let peerConn;
let dataChannel;

function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        // console.log('Got offer. Sending answer to peer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {},
            logError);
        peerConn.createAnswer(onLocalSessionCreated, logError);

    } else if (message.type === 'answer') {
        // console.log('Got answer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {},
            logError);

    } else if (message.type === 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));

    } else if (message === 'bye') {
        // TODO: cleanup RTC connection?
    }
}

function createPeerConnection(isInitiator, config) {
    // console.log('Creating Peer connection as initiator?', isInitiator, 'config:', config);
    peerConn = new RTCPeerConnection(config);

    // send any ice candidates to the other peer
    peerConn.onicecandidate = function (event) {
        // console.log('icecandidate event:', event);
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            // console.log('End of candidates.');
        }
    };

    if (isInitiator) {
        // console.log('Creating Data Channel');
        dataChannel = peerConn.createDataChannel('channel');
        onDataChannelCreated(dataChannel);

        // console.log('Creating an offer');
        peerConn.createOffer(onLocalSessionCreated, logError);
    } else {
        peerConn.ondatachannel = function (event) {
            // console.log('ondatachannel:', event.channel);
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {
    // console.log('local session created:', desc);
    peerConn.setLocalDescription(desc, function () {
        // console.log('sending local desc:', peerConn.localDescription);
        sendMessage(peerConn.localDescription);
    }, logError);
}

function onDataChannelCreated(channel) {
    // console.log('onDataChannelCreated:', channel);

    channel.onopen = function () {
        console.log('CHANNEL opened!!!');
        // channel.send('Sendinggggg' + isInitiator);
        dataChannelOutgoingSubject.subscribe( message => {
            channel.send(message);
        })
    };

    // channel.onmessage = (adapter.browserDetails.browser === 'firefox') ?
    //     receiveDataFirefoxFactory() : receiveDataChromeFactory();
    channel.onmessage = (message) => {
        // console.log(message);
        dataChannelIncomingSubject.next(message.data);
    }
}

function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
    console.log(err.toString(), err);
}
